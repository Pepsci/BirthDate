# iOS — Notification Service Extension (phase 2)

Rend les notifications de message **lisibles sur iOS** tout en gardant le E2E :
le serveur envoie le chiffré, l'extension le déchiffre localement avant affichage.

Rien ici n'est actif tant que tu n'as pas fait les étapes ci-dessous **sur macOS**.
Android n'est pas concerné.

## Fichiers fournis

| Fichier | Rôle |
|---------|------|
| `NotificationService.swift` | Logique : lit `cipher`+`senderPublicKey`, lit la clé privée dans le Keychain de l'App Group, déchiffre (swift-sodium), réécrit le corps de la notif. |
| `Info.plist` | Info.plist de l'extension (NSExtension → usernotifications.service). |
| `BirthReminderNSE.entitlements` | App Group + keychain-access-group pour l'extension. |
| `../plugins/withAppGroupEntitlement.js` | Config plugin : ajoute App Group + keychain group à **l'app principale**. |

## Étapes d'intégration

### 1. Activer le config plugin (entitlements app principale)

Dans `app.json` → `expo.plugins`, ajouter :

```json
"./plugins/withAppGroupEntitlement"
```

### 2. Stocker la clé privée dans le Keychain partagé

Dans `src/lib/crypto.ts`, passer l'`keychainAccessGroup` à expo-secure-store pour
que la clé soit accessible par l'extension :

```ts
const KEYCHAIN_GROUP = "group.com.birthreminder.app"; // iOS uniquement
const opts =
  Platform.OS === "ios" ? { keychainAccessGroup: KEYCHAIN_GROUP } : undefined;

export async function storePrivateKey(privateKeyBytes: Uint8Array) {
  await SecureStore.setItemAsync(PRIVATE_KEY_STORE, encodeBase64(privateKeyBytes), opts);
}
export async function getPrivateKey() {
  const b64 = await SecureStore.getItemAsync(PRIVATE_KEY_STORE, opts);
  return b64 ? decodeBase64(b64) : null;
}
export async function clearPrivateKey() {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE, opts);
}
```

> ⚠️ Après ce changement, les utilisateurs iOS existants devront se reconnecter
> une fois (la clé migre vers le groupe partagé). Prévoir un fallback : si
> `getPrivateKey()` renvoie null, re-déchiffrer via `setupE2EKeys` au login.

### 3. Créer la cible NSE

Deux options :

**Option A — Xcode (manuel, le plus simple pour valider)**
1. `npx expo prebuild --platform ios`
2. Ouvrir `ios/BirthReminder.xcworkspace`
3. File → New → Target → **Notification Service Extension**, nom `BirthReminderNSE`.
4. Remplacer le `NotificationService.swift` généré par celui de ce dossier.
5. Remplacer l'`Info.plist` et ajouter le fichier `.entitlements` (Build Settings →
   Code Signing Entitlements).
6. Activer les capabilities **App Groups** + **Keychain Sharing** sur la cible NSE
   (même groupe `group.com.birthreminder.app`).

**Option B — automatisé** via [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)
pour recréer la cible à chaque prebuild (à ajouter si tu veux du CI reproductible).

### 4. Ajouter swift-sodium (Pod)

Dans `ios/Podfile`, à l'intérieur du bloc `target 'BirthReminderNSE' do` :

```ruby
target 'BirthReminderNSE' do
  use_frameworks! :linkage => :static
  pod 'Sodium', '~> 0.9.1'
end
```

Puis `cd ios && pod install`.

### 5. Backend : déclencher la NSE sur iOS

La NSE ne s'exécute que si la push est une **alerte** avec `mutable-content: 1`.
Le `dataOnly: true` actuel (bon pour Android) doit devenir, pour iOS, un envoi
avec title/body fallback + `mutableContent`. Dans `pushService.js`, ajouter au
message Expo :

```js
msg.mutableContent = true;   // Expo mappe vers "mutable-content": 1
```

et pour iOS ne pas passer `dataOnly` (garder title/body fallback). On peut affiner
par plateforme plus tard ; en pratique envoyer title/body + `mutableContent: true`
+ les champs data marche pour Android (tâche de fond) **et** iOS (NSE).

### 6. Build & test

```bash
eas build --profile development --platform ios
```

Tester : appareil verrouillé/app tuée, envoyer un message → la notif doit afficher
le texte. En cas d'échec, elle affiche le fallback « 🔒 Nouveau message chiffré »
(aucune régression).

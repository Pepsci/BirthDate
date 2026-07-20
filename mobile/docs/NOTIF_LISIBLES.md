# Notifications de message lisibles (façon WhatsApp) — E2E préservé

Objectif : afficher le **texte du message** dans la notification, au lieu de
« 🔒 Nouveau message chiffré », **sans casser le chiffrement de bout en bout**.

Principe (identique à WhatsApp) : le serveur envoie le **chiffré** dans la push,
et c'est **l'appareil** qui le déchiffre localement (clé privée en Keychain/Keystore)
puis affiche une **notification locale** en clair.

---

## Ce qui est déjà fait côté mobile (`mobile/`)

| Fichier | Rôle |
|---------|------|
| `src/lib/notif-decrypt.ts` | Déchiffre le `cipher` reçu + affiche une notif locale. Tâche de fond (app tuée) + listener premier plan. |
| `src/app/_layout.tsx` | Enregistre la tâche de fond et le listener au démarrage. |
| `package.json` | Ajout de `expo-task-manager`. |
| `app.json` | `UIBackgroundModes: ["remote-notification"]` (iOS). |

### Étapes de setup (à lancer une fois)

```bash
cd mobile
npx expo install expo-task-manager
npx expo prebuild --clean      # régénère android/ et ios/ avec la nouvelle config
eas build --profile development --platform android   # nouveau dev build
```

> ⚠️ La tâche de fond ne marche **pas** dans Expo Go — un dev/EAS build est requis
> (déjà le cas pour le push, cf. `src/lib/push.ts`).

---

## Patch backend (à appliquer côté serveur — `server/`)

Deux fichiers à modifier. Rien à supprimer, on **ajoute** le chiffré dans la push
et on garde le fallback « 🔒 Nouveau message chiffré » (utilisé par iOS tant que la
Notification Service Extension n'est pas en place, et si le déchiffrement échoue).

### 1. `server/services/pushService.js` — transmettre les champs supplémentaires

Dans `sendExpoPushToUser`, remplacer la construction de `messages` par :

```js
const messages = tokens.map((to) => {
  const msg = {
    to,
    sound: "default",
    priority: "high",
    // data-only si demandé : pas de title/body → rien affiché automatiquement,
    // la tâche de fond mobile déchiffre et affiche elle-même la notif.
    data: {
      url: payload.url || "/home",
      type: payload.type || "default",
      friendId: payload.friendId || null,
      // Champs E2E (présents seulement pour les messages chiffrés) :
      encrypted: payload.encrypted || false,
      cipher: payload.cipher || null,               // encryptedForRecipient
      senderPublicKey: payload.senderPublicKey || null,
      senderName: payload.senderName || null,
      conversationId: payload.conversationId || null,
      messageId: payload.messageId || null,         // anti-doublon
      tag: payload.tag || null,
    },
  };
  if (payload.dataOnly) {
    // iOS : réveille l'app en arrière-plan pour laisser une chance au déchiffrement.
    msg._contentAvailable = true;
  } else {
    msg.title = payload.title || "BirthReminder";
    msg.body = payload.body || "";
  }
  return msg;
});
```

> Le web push (VAPID, plus haut dans le fichier) peut rester tel quel : la PWA web
> a déjà accès à la clé privée en mémoire, ou continue d'afficher le fallback.

### 2. `server/sockets/chatHandlers.js` — envoyer le chiffré

Dans `message:send`, le bloc « Push notification pour le destinataire hors ligne »
(~ ligne 150). Récupérer aussi la `publicKey` de l'expéditeur, et pour un message
chiffré, envoyer en **data-only** avec le chiffré destiné au destinataire :

```js
if (recipientId && !connectedUsers.has(recipientId.toString())) {
  const sender = await User.findById(socket.userId, "name surname publicKey");
  const senderName = sender
    ? `${sender.name} ${sender.surname || ""}`.trim()
    : "Quelqu'un";

  if (messageType === "text" && isEncrypted && encryptedForRecipient && sender?.publicKey) {
    // 🔓 Notif lisible côté appareil : on envoie le chiffré, PAS le texte.
    sendPushToUser(recipientId, {
      dataOnly: true,               // Android/iOS : la tâche de fond déchiffre
      type: "chat",
      encrypted: true,
      cipher: encryptedForRecipient,
      senderPublicKey: sender.publicKey,
      senderName,
      conversationId,
      messageId: message._id.toString(),
      url: `/home?tab=chat&conversationId=${conversationId}`,
      tag: `chat-${conversationId}`,
      friendId: socket.userId,
      // Fallback affiché si le déchiffrement échoue / iOS sans NSE :
      title: `💬 ${senderName}`,
      body: "🔒 Nouveau message chiffré",
    }).catch((err) => console.error("❌ Push chat error:", err));
  } else {
    // Cas non chiffrés (gift_share, chat en clair) : comportement actuel inchangé.
    let pushBody;
    if (messageType === "gift_share") {
      pushBody = `🎁 Idées cadeaux pour ${metadata?.personName || "quelqu'un"}`;
    } else {
      pushBody = content.trim().slice(0, 100);
    }
    sendPushToUser(recipientId, {
      title: `💬 ${senderName}`,
      body: pushBody,
      url: "/home",
      tag: `chat-${conversationId}`,
      type: "chat",
      friendId: socket.userId,
    }).catch((err) => console.error("❌ Push chat error:", err));
  }
}
```

> **Sécurité** : le serveur n'envoie que du chiffré + une clé **publique**. Aucune
> donnée en clair ne transite ni n'est stockée. Le E2E reste intact.

---

## Phase 2 — iOS fiable (Notification Service Extension) — ✅ FAIT (juillet 2026)

> **Statut** : NSE implémentée et livrée (build 12+). Cible `targets/BirthReminderNSE/`
> (@bacons/apple-targets), pod Sodium lié via `plugins/withNsePod.js` (fix libsodium
> APFS — ne pas toucher), clé privée lue depuis le Keychain App Group
> `group.com.birthreminder.app` (voir `crypto.ts`). Le backend envoie aux appareils
> iOS un push **alerte** avec fallback « 🔒 Nouveau message chiffré » que la NSE
> réécrit en clair avant affichage.
>
> **Corrections juillet 2026 (build 13)** : navigation depuis une notif différée
> jusqu'au montage du navigateur (`_layout.tsx` — corrige l'app figée sur le splash
> au cold start), `getPrivateKey()` ne throw plus (fallback legacy), clé privée en
> state dans les écrans de chat (re-render quand elle arrive tard) + retry.
> Deep links corrigés côté serveur : anniversaires → `/home?tab=date&dateId=…`,
> messages → `/home?tab=chat&conversationId=…` (redéploiement backend requis).

### Contexte d'origine (avant implémentation)

Sur Android, la tâche de fond `expo-task-manager` suffit : elle s'exécute même app
tuée et affiche la notif déchiffrée. **Sur iOS**, les pushes « data-only »
(`content-available`) ne sont **pas** livrées de façon garantie quand l'app est tuée.
Le moyen fiable, celui de WhatsApp, est une **Notification Service Extension (NSE)** :
une cible native séparée qui intercepte la push, déchiffre et réécrit le corps
**avant** l'affichage.

Ce que ça implique (chantier natif, non réalisable/testable hors macOS+Xcode) :

1. **Config plugin Expo** pour injecter la cible NSE au `prebuild` (ex. un plugin
   custom ou `@bacons/apple-targets` / `expo-notification-service-extension`).
2. **Code Swift** dans la NSE qui :
   - lit `cipher` + `senderPublicKey` du payload (`mutable-content: 1`),
   - récupère la clé privée depuis un **App Group Keychain** partagé,
   - fait un `crypto_box_open` **libsodium** (NaCl box = X25519 + XSalsa20-Poly1305 —
     CryptoKit ne suffit pas, il faut `Clibsodium`/`Swift-Sodium`),
   - remplace `bestAttemptContent.body` par le texte déchiffré.
3. **Partage de la clé privée** : aujourd'hui stockée via `expo-secure-store`
   (Keychain standard). Il faut la stocker dans un **App Group** (`group.com.birthreminder.app`)
   pour que l'extension y accède → modifier `crypto.ts` (`SecureStore` avec
   `keychainAccessGroup`) + entitlements.
4. **Backend** : pour iOS, envoyer un push **alerte** (title/body fallback) avec
   `mutableContent: true` au lieu de `dataOnly`, pour déclencher la NSE.

Tant que la NSE n'est pas faite, iOS affiche proprement le fallback
« 🔒 Nouveau message chiffré ». Aucune régression.

---

## Test rapide (Android)

1. Appareil A et B connectés, B **ferme** l'app (ou la met en arrière-plan).
2. A envoie un message à B.
3. B doit recevoir une notif `💬 <Prénom>` avec **le texte du message**.
4. Si B voit encore « 🔒 Nouveau message chiffré » → vérifier les logs
   `[notif-decrypt]` : shape des `data` reçues, présence de la clé privée
   (B doit s'être connecté au moins une fois sur ce build pour l'avoir en Keystore).

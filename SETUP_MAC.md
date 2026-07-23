# Environnement de développement — Mac
*Créé le 20 juillet 2026 — migration Windows → macOS Tahoe 26.0.1*

---

## 1. Pourquoi ce changement

Le quota de builds de la formule gratuite EAS était épuisé. Le passage sur Mac permet de **compiler iOS en local**, sans crédit ni file d'attente : builds illimités, itération rapide sur simulateur.

---

## 2. Environnement installé

| Outil | Version | Note |
|---|---|---|
| macOS | 26.0.1 (Tahoe) | Apple Silicon |
| Xcode | 26.6 (build 17F113) | App Store — ~40 Go sur disque |
| CocoaPods | 1.17.0 | via Homebrew |
| Node | 24.x LTS | via **nvm** |
| Homebrew | — | `/opt/homebrew` |

> ⚠️ **Node** : rester sur le LTS (24). Homebrew installe par défaut la version Current (26), non supportée par Expo SDK 54. Le Node de Homebrew a été désinstallé pour éviter tout conflit de PATH avec nvm.

Commandes de configuration Xcode déjà passées :

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -downloadPlatform iOS
```

---

## 3. Chaîne de build iOS — **Xcode, plus EAS**

### Pourquoi pas `eas build --local`

Bug amont d'`eas-cli` sur macOS Tahoe 26 : l'import du certificat de distribution dans le trousseau éphémère échoue à la validation.

```
Error: Distribution certificate with fingerprint … hasn't been imported successfully
```

La cause est le contrôle `security find-identity -v` sur un trousseau temporaire dépourvu de la chaîne de confiance Apple. Voir [eas-cli#3645](https://github.com/expo/eas-cli/issues/3645) et [#3678](https://github.com/expo/eas-cli/issues/3678).

→ **Contournement retenu : archive Xcode manuel.** À réévaluer quand le bug sera corrigé.

### Cycle de livraison

```bash
cd ~/Dev/birthreminder/mobile
# incrémenter "buildNumber" dans app.json AVANT prebuild
npx expo prebuild -p ios --clean
cd ios && pod install
xed .
```

> **Toujours `--clean`.** Sans lui, `prebuild` réutilise `ios/` et le plugin `@bacons/apple-targets` échoue sur la cible NSE déjà présente :
> ```
> TypeError: [ios.xcodeProjectBeta2]: Cannot read properties of undefined (reading 'removeFromProject')
> ```

> Après chaque `--clean`, **re-sélectionner l'équipe de signature dans Xcode sur les deux cibles** — cette info n'est pas dans `app.json` et disparaît avec le dossier.

Puis dans Xcode :

1. Sélecteur d'appareil → **Any iOS Device (arm64)**
2. **Product → Clean Build Folder** (`Cmd+Shift+K`)
3. **Product → Archive** (15-30 min)
4. **Distribute App → ⚠️ TestFlight & App Store → Upload**

> 🔴 **Piège coûteux** : dans l'assistant Distribute App, ne pas confondre
> - **TestFlight & App Store** → testeurs internes **+ externes** + production ✅
> - **TestFlight Internal Testing Only** → verrouillé sur les testeurs internes, **irréversible**
>
> Les builds 18 et 19 sont partis avec la seconde option : impossible de les affecter au groupe externe « Friends », il a fallu refaire un build 20. App Store Connect les marque « Internes » et n'affiche aucune erreur — le symptôme est simplement leur absence de la liste de sélection du groupe externe.

### Signature

*Automatically manage signing* activé, équipe **Josse Filippi**, sur les **deux** cibles :

- `BirthReminder`
- `BirthReminderNSE` ← oubli fréquent, fait échouer l'archive

---

## 4. Développement quotidien

| Situation | Commande | Durée |
|---|---|---|
| Développement courant | `npx expo start` puis `i` | instantané, hot reload |
| Vérif config prod | `npx expo run:ios --configuration Release` | quelques min avec cache |
| Livraison | Archive Xcode | 15-30 min |

**Changements JS/TS** → rechargement immédiat via `expo start`.
**Changements natifs** (dépendance native, `app.json`, plugins, permissions) → `prebuild` + `pod install` + recompilation.

---

## 5. Correctifs appliqués

### `buildNumber` désormais manuel

`eas.json` utilisait `appVersionSource: "remote"` et `autoIncrement` — Xcode n'y a pas accès et serait reparti à 1. Un champ `buildNumber` a été ajouté dans `app.json` → `expo.ios`.

**À incrémenter à la main avant chaque archive.** Dernier livré : **19**.

### Bug Stripe / Xcode 26 — ⚠️ NON PERSISTÉ

`node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h` ligne 14 :

```objc
typedef NS_ENUM(NSUInteger, STPPaymentStatus);   // ❌ échec de compilation
typedef NS_ENUM(NSInteger,  STPPaymentStatus);   // ✅ corrigé à la main
```

`STPPaymentStatus` était déclaré `NSUInteger` alors que le SDK natif le définit en `NSInteger`. Simple avertissement jusqu'à Xcode 25, **erreur bloquante à partir de Xcode 26** — d'où le fait que les builds EAS passaient (Xcode plus ancien côté serveur). Voir [stripe-react-native#2357](https://github.com/stripe/stripe-react-native/issues/2357).

> 🔴 **Le prochain `npm install` écrasera ce correctif.** À figer :
> ```bash
> npx patch-package @stripe/stripe-react-native
> npm install --save-dev patch-package
> ```
> puis ajouter `"postinstall": "patch-package"` dans les scripts de `mobile/package.json`, et committer le dossier `patches/`.

### Variables d'environnement

`src/lib/api.ts` lit `process.env.EXPO_PUBLIC_API_URL`, avec repli sur `http://192.168.1.10:4000`.

Cette variable venait d'`eas.json` — **fichier qu'Xcode ne lit pas**. Le build 18 est donc parti avec l'IP locale : écran d'accueil vide, connexion impossible.

Créé : **`mobile/.env.production`**

```
EXPO_PUBLIC_API_URL=https://birthreminder.com
```

Chargé automatiquement par Expo en configuration Release. Validé sur simulateur en Release — connexion et données OK.

> ⚠️ **Ordre de priorité Expo** : `.env.local` > `.env.production` > `.env`
>
> `.env.local` est chargé **dans tous les environnements, production comprise**, et écrase `.env.production`. Ne jamais y mettre une IP LAN : ça reproduirait le bug du build 18 (app livrée pointant sur une adresse locale).
>
> Pour la configuration de développement, utiliser **`.env.development`** — chargé uniquement en mode dev, il ne peut pas contaminer un build Release.
>
> État actuel : `.env.local` et `.env.production` contiennent tous deux l'URL de production. Tous les fichiers `.env*` sont gitignorés sauf `.env.example`.

---

## 6. En attente

- [x] ~~**Figer le correctif Stripe** avec `patch-package`~~ ✅ — `mobile/patches/@stripe+stripe-react-native+0.50.3.patch` committé, `"postinstall": "patch-package"` en place
- [ ] Créer `mobile/.env.development` avec l'IP LAN pour le développement (**pas** `.env.local`, voir §5)
- [ ] Configurer l'identité Git : les commits partent en `joss@Mac.lan`, déduit du hostname
  ```bash
  git config --global user.name "Joss"
  git config --global user.email "jossfilippi@gmail.com"
  ```
- [ ] Supprimer le workflow **Xcode Cloud** créé par erreur (App Store Connect → Xcode Cloud). Il échoue à chaque push car `ios/` n'est pas versionné — comportement normal avec Expo/CNG.
- [ ] Aligner les versions signalées par `expo doctor` : `npx expo install --check`
  - `@react-native-community/datetimepicker` : **8.6.0** installé, **8.4.4** attendu
  - `expo` : **54.0.35** installé, **54.0.36** attendu

---

## 7. Bugs UI à traiter

Constatés sur le build 19 (TestFlight). **Probablement préexistants**, révélés par les tests sur build iOS réel — pas des dégâts de migration : Git a transféré les fichiers à l'identique.

| Symptôme | Piste |
|---|---|
| Mode sombre absent des cartes | `ROADMAP_2026.md` marque « Dark theme + switch (ThemeContext) » comme **fait** → il s'agit donc d'une **régression**, pas d'un manque. Vérifier que les composants carte consomment bien le `ThemeContext` |
| Date picker fonctionnel mais **invisible** (création/édition d'événement) | Fort soupçon sur le décalage de version `datetimepicker` (8.6.0 vs 8.4.4) — commencer par `npx expo install --check` |
| Divers autres | À recenser |

---

## 8. Notes macOS

- Le dossier `ios/` est **généré** par `expo prebuild`, non versionné. Normal en CNG/Prebuild.
- Les ~600 avertissements `Pointer is missing a nullability type specifier` sont du bruit React Native — ignorer, seules les erreurs rouges comptent.
- Les échecs `Upload Symbols Failed` sur `React.framework`, `hermes.framework`, `ReactNativeDependencies.framework` sont **sans gravité** : ces frameworks sont livrés précompilés sans dSYM. L'upload aboutit ; seule la symbolisation des crashes internes à RN est dégradée.
- Erreur `Could not compute dependency graph: MsgHandlingError("unable to initiate PIF transfer session")` → bug transitoire de Xcode, survient quand un build démarre pendant l'indexation :
  ```bash
  killall Xcode && rm -rf ~/Library/Developer/Xcode/DerivedData
  ```
  Rouvrir, **attendre la fin de l'indexation**, relancer.

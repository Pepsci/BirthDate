# Android App Links — à finaliser quand on attaque Android

> iOS (Universal Links) est déjà en place. Ici, ce qu'il reste pour qu'un lien
> `https://birthreminder.com/...` reçu par email ouvre l'app **Android**.
> Tout le code est déjà écrit — ce sont uniquement des étapes de config/déploiement.

## Déjà fait (rien à retoucher)
- `mobile/app.json` → `android.intentFilters` (autoVerify) sur `/event`, `/home`, `/auth/reset`, `/shared-invites`.
- `mobile/src/app/+native-intent.tsx` + `webLinkToMobileRoute` → routage des liens entrants.
- `front/public/.well-known/assetlinks.json` → créé, mais avec une **empreinte placeholder**.
- `deploy/nginx-wellknown.conf` → sert déjà `assetlinks.json` en `application/json`.

## Étapes restantes

### 1. Récupérer l'empreinte SHA256 du certificat de signature
Deux sources possibles :
- `cd mobile && eas credentials` → Android → **production** → Keystore → note le **SHA256 Fingerprint**.
- ou Google Play Console → ton app → **Intégrité de l'app** → *Certificat de signature d'application* → copie le SHA-256.

> ⚠️ Si l'app est distribuée via Play (Play App Signing), c'est le certificat
> **de Google** (celui de la Play Console) qu'il faut, pas ton upload key.
> En cas de doute, mets les DEUX empreintes dans le tableau `sha256_cert_fingerprints`.

### 2. Coller l'empreinte dans assetlinks.json
Remplacer `REMPLACER_PAR_EMPREINTE_SHA256_DU_CERTIFICAT_DE_SIGNATURE` dans
`front/public/.well-known/assetlinks.json` par l'empreinte (format `AB:CD:EF:...`).

### 3. Déployer le fichier
Copier dans `/var/www/birthreminder/.well-known/assetlinks.json` sur le serveur.
Vérifier :
```
curl -I https://birthreminder.com/.well-known/assetlinks.json   # 200 + application/json
```
Testeur officiel Google : https://developers.google.com/digital-asset-links/tools/generator

### 4. Build + install Android
```
cd mobile && eas build -p android --profile production
```
(le `versionCode` s'auto-incrémente, `appVersionSource: remote` dans eas.json)

### 5. Tester la vérification
```
adb shell pm get-app-links com.birthreminder.app
# doit afficher birthreminder.com : verified
adb shell am start -a android.intent.action.VIEW \
  -d "https://birthreminder.com/event/ABC12" com.birthreminder.app
```
Si `verified` n'apparaît pas : empreinte incorrecte, ou fichier non servi en JSON,
ou redirection HTTP sur `/.well-known/`.

## Pièges connus
- App Links Android ne se vérifient QUE si `assetlinks.json` est en HTTPS, sans redirection, `Content-Type: application/json`.
- La vérification autoVerify se fait à l'installation : réinstaller l'app après correction de l'empreinte.
- Play App Signing → utiliser l'empreinte du certificat Google, pas celle de l'upload key.

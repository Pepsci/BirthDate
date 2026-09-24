# 🛠️ Aide-mémoire commandes — BirthReminder

> Repère : **`joss@Mac`** = ton Mac · **`ubuntu@ip-…`** = le serveur EC2.
> Le build/rsync/ssh se lancent **depuis le Mac**. Le git pull/pm2/nginx **depuis le serveur**.

---

## 🔑 Se connecter au serveur (SSH)

```bash
ssh -i ~/Downloads/paris-joss-mdp.pem ubuntu@birthreminder.com
```
- 1ʳᵉ fois avec une nouvelle clé : `chmod 600 ~/Downloads/paris-joss-mdp.pem`
- Pour quitter le serveur : `exit`

---

## 💻 Développement local

**Backend** (terminal 1) :
```bash
cd ~/Dev/birthreminder/server
npm run dev            # nodemon → port 4000
```

**Frontend web** (terminal 2) :
```bash
cd ~/Dev/birthreminder/front
npm run dev            # Vite → http://localhost:5173
```

**Mobile** (terminal 3) :
```bash
cd ~/Dev/birthreminder/mobile
npx expo start -c      # -c vide le cache (utile après un changement de .env / module)
# puis 'i' pour le simulateur iOS
```
> ⚠️ Pas de script à la racine du repo — chaque partie se lance dans son dossier.

---

## 🚀 Déployer le BACKEND (serveur EC2)

```bash
# Sur le Mac : commit + push
cd ~/Dev/birthreminder
git add -A && git commit -m "message" && git push

# Sur le serveur : récupérer + installer + redémarrer
ssh -i ~/Downloads/paris-joss-mdp.pem ubuntu@birthreminder.com
cd ~/BirthDate/server && git pull -C .. && npm install
pm2 restart birthreminder-api
```
> ⚠️ **Ne jamais sauter le `npm install`** dès que `package.json` a changé (nouvelle
> dépendance). Sinon `require(...)` plante au démarrage sur le module manquant et
> **plus aucune route ne répond** (login web ET mobile inclus, même quand seule une
> fonctionnalité admin utilisait la nouvelle dépendance) — c'est déjà arrivé avec
> `geoip-country`.

---

## 🌐 Déployer le FRONT WEB

> ⚠️ **Toujours builder sur le Mac** (l'EC2 n'a pas assez de RAM), puis envoyer le résultat.

```bash
# Sur le Mac
cd ~/Dev/birthreminder/front
npm run build          # crée front/dist

rsync -avz --delete -e "ssh -i ~/Downloads/paris-joss-mdp.pem" \
  dist/ ubuntu@birthreminder.com:~/BirthDate/front/dist/
```
- Pas besoin de redémarrer nginx (fichiers statiques).
- Vérifier en navigation privée (évite le service worker en cache).

---

## 📱 Build MOBILE → TestFlight

> ⚠️ **`.env.local` passe TOUJOURS avant `.env.production`**, même pour un build
> TestFlight/prod : Expo charge les fichiers `.env` par priorité fixe
> (`.env.local` > `.env.production` > `.env`), indépendamment de ce qu'on est
> en train de builder. Comme on utilise `expo prebuild` + Xcode en local (pas
> `eas build`, dont `eas.json` gère ça automatiquement par profil), si
> `.env.local` contient une IP locale de dev (cas courant en cours de session),
> **elle finit embarquée dans l'archive TestFlight à la place de
> `https://birthreminder.com`** → l'app plante en "network connection error"
> une fois installée, alors que le serveur est parfaitement joignable.
> Vécu le 14/08/2026 : build envoyé avec `EXPO_PUBLIC_API_URL` pointant sur
> `192.168.1.40:4000` au lieu de la prod.

```bash
cd ~/Dev/birthreminder/mobile

# 1. Vérifier les modules natifs (idempotent)
npx expo install expo-image expo-image-manipulator expo-file-system

# 2. Incrémenter "buildNumber" dans app.json → expo.ios.buildNumber

# 3. Neutraliser .env.local le temps du build (sinon il écrase .env.production)
mv .env.local .env.local.bak

# 4. Régénérer le natif
npx expo prebuild -p ios --clean
cd ios && pod install
xed .
```

> Une fois l'archive/upload terminé (étapes Xcode ci-dessous), remettre le
> fichier pour reprendre le dev en local :
> ```bash
> cd ~/Dev/birthreminder/mobile
> mv .env.local.bak .env.local
> ```

**Dans Xcode :**
1. Signature sur les **DEUX** cibles (`BirthReminder` **et** `BirthReminderNSE`) → Signing & Capabilities → Team **Josse Filippi** *(le `--clean` l'efface à chaque fois)*
2. Sélecteur d'appareil → **Any iOS Device (arm64)**
3. Product → **Clean Build Folder** (⇧⌘K)
4. Product → **Archive** (15-30 min)
5. **Distribute App** → **TestFlight & App Store** → **Upload**
   - 🔴 **JAMAIS** "Internal Testing Only" (irréversible)

> Changements **JS/TS uniquement** (pas de nouveau module natif) → pas besoin de rebuild pour tester : `npx expo start` + reload. Le rebuild ne sert qu'à embarquer dans TestFlight.

**Si Xcode bloque** (`PIF transfer session`) :
```bash
killall Xcode && rm -rf ~/Library/Developer/Xcode/DerivedData
# rouvrir, attendre l'indexation, relancer
```

---

## 🤖 Build MOBILE → Google Play (Android)

> Circuit différent d'iOS : **EAS** construit et signe, Play Console distribue.
> Pas de Xcode, pas de `.env.local` à neutraliser — le profil `production` de
> `eas.json` impose `EXPO_PUBLIC_API_URL=https://birthreminder.com`.

```bash
cd ~/Dev/birthreminder/mobile

# 1. Construire l'AAB (cloud : ~20-30 min, 1 crédit sur 30)
eas build -p android --profile production

# En local (gratuit, sans file d'attente) — demande ≥ 40 Go de disque libre
# et 16 Go de RAM. Avec 8 Go, ça meurt en cours de compilation C++ :
# eas build -p android --profile production --local
```

- Le **`versionCode` s'incrémente tout seul** (`appVersionSource: "remote"`
  dans `eas.json`). Rien à toucher dans `app.json` — contrairement à iOS, où
  `buildNumber` est à la main.
- À la fin, EAS affiche un lien `https://expo.dev/artifacts/…aab`.

```bash
# 2. Récupérer le fichier
cd ~/Downloads && curl -L -o birthreminder.aab "<lien affiché par EAS>"
```

**Dans Play Console** (play.google.com/console → BirthReminder) :

1. **Tester et publier** → la piste voulue (**Test interne** pour vérifier,
   **Test fermé** pour les testeurs, **Production** ensuite)
2. **Créer une release** → déposer le `.aab`
3. **Notes de version** : 500 caractères max par langue
4. **Enregistrer** → **Vérifier la release** → **Déployer**

> Une release de test interne est disponible en quelques minutes, sans examen.
> Les autres pistes passent par un examen Google (quelques heures à 3 jours).
> Promouvoir une release déjà envoyée (test interne → test fermé → production)
> évite de reconstruire : **Releases → ⋮ → Promouvoir**.

**Une fois envoyé une première fois**, les suivants peuvent partir sans passer
par le navigateur :

```bash
eas submit -p android --latest
```
(demande une clé de compte de service Google Play : `eas credentials` →
Android → *Google Service Account for Play Store submissions*)

### Pièges Android

- **Signature** : ce sont deux clés différentes. Celle d'EAS signe l'envoi,
  Google re-signe pour les utilisateurs. Les **deux** empreintes SHA-256 sont
  dans `front/public/.well-known/assetlinks.json` — sans quoi les liens
  `birthreminder.com` n'ouvrent pas l'app.
- **Impossible d'installer par-dessus** un APK signé autrement (dev ou EAS
  preview) : `adb uninstall com.birthreminder.app` d'abord.
- **Push** : la clé FCM V1 vit chez Expo (`eas credentials` → Android →
  Google Service Account), pas dans le build.
- **Vérifier les App Links** après installation depuis le Play Store :
  ```bash
  adb shell pm get-app-links com.birthreminder.app   # → verified
  ```
- **Changements JS/TS uniquement** : inutile de rebuilder pour tester en dev
  (`npx expo start` + reload). Le rebuild ne sert qu'à publier.

### APK de test rapide (hors Play Store)

```bash
eas build -p android --profile preview --local   # APK installable direct
adb install build-<horodatage>.apk
```

---

## 🔒 Git bloqué : « index.lock: File exists »

```bash
cd ~/Dev/birthreminder
rm -f .git/index.lock
```
- Symptôme : `fatal: Unable to create '.git/index.lock': File exists` sur un commit, un merge ou un checkout.
- Cause : un process git s'est arrêté avant d'effacer son verrou (crash, Ctrl+C, ou un outil qui n'avait pas le droit de supprimer le fichier).
- ⚠️ Vérifier d'abord qu'aucun git ne tourne (VS Code, autre terminal) — sinon on casse une opération en cours.

---

## 🩺 Maintenance serveur

```bash
# État des process
pm2 list
pm2 logs birthreminder-api --lines 30 --nostream   # logs récents
pm2 logs birthreminder-api --err --lines 30 --nostream   # erreurs seulement
pm2 restart birthreminder-api
pm2 flush              # vider les logs (si le disque se remplit)

# Disque
df -h /
sudo du -xhd1 / 2>/dev/null | sort -h | tail -15     # gros dossiers

# Nettoyage si disque plein
sudo apt-get clean
sudo journalctl --vacuum-size=200M
sudo apt-get autoremove --purge
npm cache clean --force

# nginx
sudo nano /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 📌 Rappels utiles

- **Avatars** : stockés dans `~/BirthDate/server/uploads/avatars/` (nommés `<userId>.webp`). Servis via nginx `location /uploads/ → :4000`.
- **.env serveur** doit contenir : `PORT=4000`, `MONGO_URI`, `TOKEN_SECRET`, `BACKEND_URL=https://birthreminder.com`.
- **buildNumber** : à incrémenter à la main dans `app.json` avant chaque archive.
- Ne jamais builder le front sur l'EC2 (OOM). Toujours sur le Mac.

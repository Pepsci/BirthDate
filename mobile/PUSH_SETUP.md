# Push notifications — marche à suivre

Le code est prêt (mobile + backend). Il reste 4 étapes de configuration,
à faire une seule fois, dans cet ordre. **Le push ne fonctionne pas dans
Expo Go** — c'est le development build qui le permet.

## 1. Lier le projet à ton compte Expo (~2 min)

```bash
cd mobile
npm install          # nouveaux packages : expo-notifications, expo-dev-client
npx expo login       # ton compte expo.dev
npm install -g eas-cli
   eas init         # crée le projet EAS → écrit le projectId dans app.json
```

## 2. Clé de service Firebase (FCM v1, ~5 min)

1. https://console.firebase.google.com → ton projet BirthReminder
2. ⚙️ Paramètres du projet → onglet **Comptes de service**
3. Bouton **Générer une nouvelle clé privée** → télécharge le fichier JSON
4. Associe-la à ton app :
   ```bash
   eas credentials
   ```
   → Android → production (ou development) → **Google Service Account**
   → **Set up a Google Service Account Key for Push Notifications (FCM V1)**
   → indique le chemin du JSON téléchargé.

⚠️ Garde ce JSON hors de git (il donne accès à ton projet Firebase).

## 3. Development build Android (~15 min, gratuit)

```bash
eas build --profile development --platform android
```

À la fin, Expo donne un lien/QR : installe l'APK sur ton téléphone Android.
Pas de téléphone Android ? Utilise le profil `preview` plus tard, ou attends
le compte Apple pour l'iPhone.

Ensuite :
```bash
npx expo start --dev-client
```
L'app installée se connecte à Metro comme Expo Go — même workflow.

## 4. Tester le flux complet

1. Backend local lancé (`npm run dev` dans server/)
2. Ouvre le dev build → connexion → accepte la permission notifications
3. Le terminal Metro doit afficher : `🔔 Push: token enregistré ExponentPushToken[...]`
4. Depuis le site web (compte B), fais un RSVP sur ton événement, envoie un
   message de chat, ou attends un rappel cron → la notif doit arriver sur le
   téléphone, app fermée incluse.
5. Tape la notification → l'app s'ouvre directement sur la bonne page.

## iOS (quand le compte Apple Developer est actif)

```bash
eas build --profile development --platform ios
```
EAS te proposera de générer la clé APNs automatiquement (réponds oui à tout).
L'installation sur iPhone passe par un "ad hoc provisioning" — EAS guide.

## Rappels

- `eas.json` : le profil development pointe sur ton back local (IP LAN),
  preview/production sur birthreminder.com (nécessite le déploiement EC2
  des modifs backend : CORS socket, routes expo-token, pushService).
- Le backend n'a besoin d'AUCUNE clé Firebase : il appelle l'API Expo Push,
  et Expo relaie vers FCM/APNs avec les credentials stockés chez eux.

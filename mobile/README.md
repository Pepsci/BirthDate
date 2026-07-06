# BirthReminder Mobile

App mobile React Native (Expo SDK 57, TypeScript, Expo Router) — client mobile du backend BirthReminder existant (`../server`).

## Démarrer en dev

1. **Installer les dépendances**
   ```bash
   cd mobile
   npm install
   ```

2. **Configurer l'URL de l'API** — édite `.env` :
   ```
   EXPO_PUBLIC_API_URL=http://TON_IP_LOCALE:4000
   ```
   ⚠️ Pas `localhost` : sur le téléphone, localhost = le téléphone lui-même.
   Trouve ton IP avec `ipconfig` (champ IPv4, ex. `192.168.1.42`). Le PC et le téléphone doivent être sur le même réseau Wi-Fi.

3. **Lancer le backend** (dans `../server`) : `npm run dev`

4. **Lancer l'app**
   ```bash
   npx expo start
   ```
   Scanner le QR code avec l'app **Expo Go** (App Store / Play Store).

## Structure

```
src/
  app/            # écrans (Expo Router, navigation par fichiers)
    _layout.tsx   # racine : AuthProvider + garde d'auth
    login.tsx     # écran de connexion
    index.tsx     # accueil (protégé)
  lib/
    api.ts        # client API (Bearer token via expo-secure-store)
    auth-context.tsx  # contexte d'authentification
```

## Auth

Le backend accepte déjà `Authorization: Bearer` (voir `server/middleware/jwt.middleware.js`) et `/auth/login` renvoie le token dans le body → aucun changement backend nécessaire. Le token est stocké dans le Keychain/Keystore via `expo-secure-store`.

## Prochaines étapes (cf. roadmap)

1. Push notifications (expo-notifications → token sur User → mêmes events que le web)
2. Écrans anniversaires & événements
3. Wishlist / chat, puis Stripe mobile en dernier

# Sécurité — actions restantes (à faire par toi)

Les correctifs de code sont appliqués (voir liste plus bas). Il reste 3 catégories d'actions manuelles.

## 1. Réparer git + purger les fichiers versionnés (à faire sur Windows)

L'index git a été corrompu pendant la tentative de purge depuis l'environnement Linux
(le montage OneDrive bloque certaines opérations bas niveau de git). **Aucune donnée perdue** :
tous les commits, objets et fichiers sont intacts. Répare en 3 commandes dans le dossier du repo :

```powershell
del .git\index.lock
del .git\index
git reset            # reconstruit l'index depuis le dernier commit
git status           # doit refonctionner normalement
```

Puis applique la purge (le `.gitignore` est déjà durci) :

```powershell
git rm -r --cached node_modules
git rm --cached front/localhost-key.pem front/localhost.pem stripe.exe mobile/.env
git add .gitignore
git commit -m "chore(sec): purge fichiers non versionnables + durcir .gitignore"
```

Régénère ensuite le certificat localhost (dev) puisqu'il ne sera plus versionné.

## 2. Dépendances

```powershell
cd server
npm install          # applique mongoose ^6.13.2 et nanoid ^3.3.8 (déjà mis à jour)
npm audit
```

- **multer** (`^1.4.5-lts.1`) reste vulnérable (CVE DoS, correctif en 2.0.2) mais je ne l'ai pas
  monté automatiquement : la v2 est un changement majeur et `multer-storage-cloudinary@4` peut être
  incompatible. À tester à part avant de bumper.
- **cloudinary 1.28** : ancienne, à moderniser quand tu peux.

## 3. Infra AWS (côté serveur EC2, pas dans le code)

- **Forcer IMDSv2** sur l'instance EC2 (`HttpTokens=required`, `HttpPutResponseHopLimit=1`).
  C'est la protection décisive contre l'exfiltration de credentials via SSRF.
- Idéalement, remplacer les clés AWS statiques du `.env` par un **rôle IAM d'instance**
  avec permissions minimales (SES send-only).
- Vérifier que `NODE_ENV=production` est bien positionné en prod (active les logs réduits,
  le cookie `secure`, etc.).

---

## Correctifs déjà appliqués dans le code

| # | Faille | Fichier(s) |
|---|--------|-----------|
| 1 | SSRF — validation d'URL + agents DNS sûrs + rate-limit | `utils/urlGuard.js`, `routes/wishlist.js` |
| 2 | IDOR wishlist — contrôle amitié/partage | `routes/wishlist.js` |
| 3 | `.gitignore` durci | `.gitignore` |
| 4 | Rate-limit global + sanitisation NoSQL + trust proxy | `app.js`, `middleware/sanitize.js`, `routes/auth.js` |
| 5 | Messages de login génériques (anti-énumération) | `routes/auth.js` |
| 6 | Jetons d'accès via `crypto` (accessCode, friendCode) | `events/core.js`, `routes/wishlist.js` |
| 7 | Email organisateur retiré de la vue publique événement | `events/core.js` |
| 8 | Token web déjà via cookie httpOnly uniquement — RAS | (vérifié) |
| 10 | socketAuth algo explicite, MDP 8 car., reset token haché, logs prod, message cagnotte borné | `middleware/socketAuth.js`, `routes/auth.js`, `app.js`, `events/pool.js` |

> Note : le token de reset est désormais **haché** en base. Les anciens tokens de reset en cours
> deviennent invalides — sans impact (ils expirent en 1 h).

---

## Correctifs client appliqués (front web + mobile)

| Zone | Correctif | Fichier(s) |
|------|-----------|-----------|
| Front web | **JWT retiré du localStorage** (vol par XSS) : seul un `userId` non secret est persisté ; l'auth passe par le cookie httpOnly, le socket via `withCredentials` | `context/auth.context.jsx`, `services/socket.service.js`, `context/notification.context.jsx`, `chat/*.jsx`, `events/chat/EventChat.jsx`, `events/GiftProposalPanel.jsx` |
| Front web | `console.log` du token supprimé | `chat/DirectChat.jsx` |
| Front web | MDP 8 caractères + code d'accès 8 (aligné backend) ; bug `guestNameInput` corrigé | `pages/CGU.jsx`, `events/JoinEventModal.jsx` |
| Mobile | MDP 8 caractères (inscription + changement) | `app/signup.tsx`, `app/profile/password.tsx` |
| Mobile | Code d'accès événement 6 → 8 | `app/event/[shortId].tsx` |

**Mobile — état de sécurité : bon.** Token et clé privée E2E stockés dans `expo-secure-store`
(Keychain/Keystore), auth par header `Bearer`, builds de prod en `https` (eas.json). Rien à corriger.

## À TESTER avant de déployer (important)

Le passage du token web « localStorage → cookie/mémoire » touche l'auth temps réel. À vérifier en
staging :
1. Login web → le chat DM et le chat d'événement se connectent et envoient/reçoivent des messages.
2. Rechargement de page en étant connecté → le socket se reconnecte (le token est ré-émis par `/auth/verify`).
3. Rejoindre un événement avec un code (ancien à 6 et nouveau à 8 caractères).
4. Réservation/achat d'un cadeau sur la wishlist **d'un ami** (doit marcher) et d'un **non-ami** (doit être refusé 403).

## Recommandation non appliquée (à ton choix)

- **Clé privée E2E en localStorage (web)** : `front/src/utils/encryption.js` garde une copie de secours
  de la clé privée déchiffrée dans `localStorage` (backup). C'est pratique mais exposé à un XSS.
  Je ne l'ai pas modifié car y toucher risque de rendre d'anciens messages chiffrés illisibles.
  À reconsidérer si tu veux durcir l'E2E (ex. ne garder qu'en `sessionStorage`).

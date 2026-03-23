# BirthReminder — CLAUDE.md
*Mis à jour : mars 2026*

---

## 🧠 Contexte du projet

BirthReminder est une application web full-stack de gestion d'anniversaires, de fêtes et d'événements entre amis.

**Stack technique :**
| Couche | Tech |
|--------|------|
| Frontend | React 18 + Vite, React Router 6, motion/react (Framer Motion) |
| Backend | Node.js + Express 4.19 |
| Base de données | MongoDB + Mongoose 6.2 |
| Temps réel | Socket.io 4.8 (chat amis + chat événements) |
| Emails | AWS SES via @aws-sdk/client-ses + Nodemailer |
| Upload images | Cloudinary (multer-storage-cloudinary) |
| Auth | JWT stockés en cookie httpOnly |
| Cron jobs | node-cron (4 jobs actifs) |
| Déploiement | AWS EC2 — prod : `birthreminder.com` / dev : `localhost` |

---

## 📁 Structure du projet

```
BirthDate/
├── server/
│   ├── app.js                  # Express app, CORS, montage des routes, init crons
│   ├── server.js               # HTTP server + Socket.io setup
│   ├── models/                 # Schémas Mongoose
│   ├── routes/                 # Routes Express (/api/*)
│   ├── middleware/             # JWT, logger, checkEventAccess
│   ├── sockets/                # Handlers Socket.io (chat + events)
│   ├── services/emailTemplates/ # Templates AWS SES
│   ├── jobs/                   # Cron jobs
│   ├── config/                 # MongoDB, Cloudinary
│   └── utils/                  # Helpers (nameday, friendDates)
└── front/
    └── src/
        ├── App.jsx             # Router principal
        ├── main.jsx            # Bootstrap + Context providers
        ├── api/apiHandler.jsx  # Instance Axios centralisée
        ├── context/            # Auth, Theme, Notifications, OnlineStatus
        ├── protectedRoutes/    # PrivateRoute wrapper
        ├── styles/variables.css # CSS variables globales dark/light
        └── components/
            ├── Accueil/        # LandingPage
            ├── connect/        # AuthPage, VerifyEmail, ResetPassword
            ├── dashboard/      # Home, DateList, BirthdayCard, Agenda...
            ├── chat/           # Chat, DirectChat, ChatModal, ChatWindow...
            ├── events/         # EventPage, EventForm, EventsPanel, EventCard...
            ├── friends/        # Friends, AddFriendModal, MergeDuplicates...
            ├── layout/         # Footer, CookieBanner, ScrollToTop
            ├── pages/          # CGU, Privacy, Cookies, Guide
            ├── profil/         # Profile, FriendProfile, Wishlist...
            ├── services/       # socket.service.js
            └── UI/             # Logo, CSS partagé
```

---

## 🗄️ Modèles Mongoose

### Modèles existants (ne pas modifier les schémas sauf ajout de ref)

| Modèle | Fichier | Description |
|--------|---------|-------------|
| `User` | `user.model.js` | Profil, auth, préférences notifications |
| `Date` | `date.model.js` | Entrée anniversaire/fête, liée optionnellement à un User (`linkedUser`) |
| `Friend` | `friend.model.js` | Relation d'amitié avec statut |
| `Conversation` | `conversation.model.js` | Conversation DM entre deux users |
| `Message` | `message.model.js` | Message dans une Conversation |
| `Wishlist` | `wishlist.model.js` | Liste de cadeaux par user |
| `Invitation` | `invitation.model.js` | Demande d'amitié |
| `PushSubscription` | `PushSubscription.model.js` | Subscriptions push notifications |
| `Log` | `log.model.js` | Journalisation activités |

### Modèles Events (nouveaux — implémentés)

| Modèle | Fichier | Champs clés |
|--------|---------|-------------|
| `Event` | `event.model.js` | `shortId` (5 chars, nanoid), `title`, `type` (birthday/party/dinner/other), `organizer` (ref User), `forPerson` (ref User), `forDate` (ref Date), `dateMode` (fixed/vote), `fixedDate`, `dateOptions[]`, `selectedDate`, `locationMode` (fixed/vote), `fixedLocation`, `locationOptions[]`, `giftMode` (imposed/proposals), `imposedGifts[]` (array), `giftPoolEnabled` (false par défaut), `maxGuests`, `accessCode` (6 chars), `allowExternalGuests`, `allowGuestInvites`, `reminders[]`, `status` (draft/published/cancelled/done). Virtual `invitations` populé depuis EventInvitation. |
| `EventInvitation` | `eventInvitation.model.js` | `event`, `user` (null si externe), `externalEmail`, `guestName`, `status` (pending/accepted/declined/maybe), `dateVote[]`, `locationVote`, `joinedViaCode` |
| `EventGiftProposal` | `eventGiftProposal.model.js` | `event`, `proposedBy`, `name`, `url`, `price`, `votes[]` |
| `EventMessage` | `eventMessage.model.js` | `event`, `sender`, `content`, `readBy[]` |

> **Champ `imposedGifts`** : c'est un **array** (pas un objet unique). Toujours traiter comme `imposedGifts: []`.

---

## 🛣️ Routes Express

**Préfixe global : `/api`**

### Routes implémentées — Events (`/api/events`)

```
POST   /                          Créer un événement (auth)
GET    /mine                      Mes événements organisés + invités (auth) → { organized[], invited[] }
GET    /check/:id                 Vérifier si un event existe — `:id` peut être un `userId` (forPerson) ou un `dateId` (forDate). Retourne `{ eventShortId }` si trouvé, sinon `null`. (auth)
GET    /:shortId                  Récupérer un event (public, accès partiel si non-invité)
PUT    /:shortId                  Modifier un event (organizer only)
DELETE /:shortId                  Supprimer + cascade (organizer only)
POST   /:shortId/invite           Inviter users inscrits + envoi email
POST   /:shortId/join             Rejoindre via accessCode (public ou connecté). Body : `{ accessCode, guestName? }`. Vérifie que `accessCode` correspond au champ `event.accessCode` (comparaison case-insensitive). Si connecté → crée/met à jour une `EventInvitation` avec `joinedViaCode: true`. Si non connecté → crée une invitation avec `user: null` et `externalEmail/guestName` si fournis.
PUT    /:shortId/rsvp             Répondre invitation (auth + checkEventAccess)
POST   /:shortId/vote/date        Voter pour une date (auth + checkEventAccess)
POST   /:shortId/vote/location    Voter pour un lieu (auth + checkEventAccess)
POST   /:shortId/gifts            Proposer un cadeau (auth + checkEventAccess)
GET    /:shortId/gifts            Lister les propositions (auth + checkEventAccess)
POST   /:shortId/gifts/:giftId/vote  Voter pour un cadeau (toggle)
PUT    /:shortId/gifts/:giftId    Modifier sa propre proposition (proposer only)
GET    /:shortId/messages         Messages du chat event (auth + checkEventAccess)
GET    /:shortId/share            { url, code } pour partage
GET    /:shortId/invitations      Liste invitations peuplées (auth + checkEventAccess)
```

### ⚠️ Ordre critique des routes
`/mine` et `/check/:id` doivent être **déclarés avant** `/:shortId` dans `events.js` pour éviter que "mine" et "check" soient interprétés comme des shortIds.

### Middleware `checkEventAccess`
Injecte `req.event`, `req.userRole` ("organizer" | "guest"), `req.invitation` sur les routes protégées événement.

---

## 🌐 Routes Frontend (App.jsx)

| Route | Composant | Accès |
|-------|-----------|-------|
| `/` | LandingPage | Public |
| `/auth`, `/login`, `/signup`, `/forgot-password` | AuthPage | Public |
| `/verify-email` | VerifyEmail | Public |
| `/auth/reset/:token` | ResetPassword | Public |
| `/event/:shortId` | **EventPage** | Public (lecture seule sans compte) |
| `/unsubscribe` | Unsubscribe | Public |
| `/home` | Home | Privé |
| `/profile` | Profile | Privé |
| `/birthday/:id` | BirthdayView | Privé |
| `/update-date/:id` | UpdateDate | Privé |
| `/merge-duplicates` | MergeDuplicates | Privé |
| `/events/mine` | EventsPanel | Privé |
| `/events/new` | EventForm | Privé |

### Deep links depuis `/home`
Le composant `Home` gère les deep links via query params :
```
/home?tab=date&dateId=xxx    → ouvre FriendProfile pour ce dateId
/home?tab=agenda             → affiche la vue agenda
/home?tab=events             → ouvre EventsPanel
/home?tab=friends            → ouvre le profil utilisateur section amis
```

---

## ⚛️ Composants React — État actuel

### BirthdayCard (`dashboard/BirthdayCard.jsx`)
- **Carte simplifiée** : toute la carte est cliquable → `onViewProfile(date, "info")`
- Aucun bouton visible, curseur pointer sur la carte entière
- Affiche : nom, prénom, badge AMI / FAMILLE, âge, date, fête (nameday), countdown
- Props : `{ date, onViewProfile }`

### FriendProfile (`profil/FriendProfile.jsx`)
- Vue profil complète avec sidebar desktop + carousel mobile
- Sections : Infos, Notifications, Sa Wishlist (amis), Mes Cadeaux, Messages (amis), Modifier (dates manuelles)
- **Bouton ✏️ Modifier** : uniquement si `!date.linkedUser` → charge `<UpdateDate compact>` en inline
- **Bouton 💬 Chat** : uniquement si `date.linkedUser` — badge d'unreads depuis `conversationUnreads`
- **Bouton 🎉 Événement** : pour toutes les dates — navigue vers `/event/:shortId` ou `/events/new?forPerson=...` / `?forDate=...`
- `isMobile` détecté via resize listener (`<= 768px`)
- `existingEventId` fetchée via `GET /events/check/:personId`

### UpdateDate (`dashboard/UpdateDate.jsx`)
- Props : `{ date, onCancel, onSaved?, onDeleted?, onMerge?, compact? }`
- `compact=true` : rend uniquement `.auth-panel` sans wrapper page complet
- `onSaved(updatedDate)` appelé après PATCH réussi
- `onDeleted()` appelé après DELETE réussi

### Agenda (`dashboard/Agenda.jsx`)
- **Vue Mois** : grille CSS 7 colonnes, offset lundi corrigé `(firstDay + 6) % 7`, cellules cliquables → AgendaDayModal
- **Vue Semaine** : layout vertical 7 lignes, colonne gauche (nom jour + numéro), colonne droite (items cliquables directs)
- `WEEK_VIEW_MAX_ITEMS = 3` : au-delà → bouton "+ X autres" → AgendaDayModal
- Pastilles : bleu (anniversaire), orange (fête/nameday), vert (événement)
- **Namedays** : parsés depuis `date.nameday || date.linkedUser?.nameday` (format `MM-DD`)
- Toggle Mois/Semaine, mobile par défaut en semaine (`<= 768px`)
- `switchToWeek` → semaine en cours (`getMonday(today)`)
- Reçoit `events` depuis `DateList` (fetchés via `GET /events/mine`)

### AgendaDayModal (`dashboard/AgendaDayModal.jsx`)
- Props : `{ day, month, year, dates, namedays?, events, onClose }`
- Sections : 🎂 Anniversaires, 🎉 Fêtes, 🎉 Événements
- Navigation : anniversaires/fêtes → `/home?tab=date&dateId=...`, événements → `/event/:shortId`
- Fermeture : bouton ✕ + clic overlay + touche Escape
- Bottom sheet sur mobile (`align-items: flex-end`)

### EventsPanel (`events/EventsPanel.jsx`)
- Affiché à la place des cartes quand l'onglet Événements est actif dans DateList
- Filtres : Tous / Mes events / Invités / À venir / En attente / Passés
- Edit/Delete événements (organizer only) avec modal EventForm intégré
- Pagination

### EventPage (`events/EventPage.jsx`)
- Page publique `/event/:shortId`
- Tabs : **Info** / **Participants** / **Cadeaux** / **Chat** / **Votes**
- Hero section avec date + lieu en pills
- RSVP inline (Accepter / Peut-être / Décliner) — appelle `PUT /:shortId/rsvp`
- Votes date/lieu : affichés seulement si `dateMode === 'vote'` / `locationMode === 'vote'` et `selectedDate` non encore fixée
- Propositions cadeaux : liste + formulaire ajout (connecté uniquement), votes toggle
- Chat Socket.io : joint la room `event:join` au montage, quitte à l'unmount
- `allowGuestInvites` : contrôle si les invités voient le bouton "Inviter" + section partage (lien + code)
- **Accès non-connecté** : lecture seule — pas de RSVP, pas de chat, pas de vote. Bouton "Rejoindre avec un code" → modal `JoinEventModal`
- **`JoinEventModal`** : saisie `accessCode` (6 chars) + `guestName` optionnel → `POST /:shortId/join`
- Retour → `/home?tab=events` (si connecté) ou `/` (si non connecté)

### Guests externes — Flow complet
1. L'organisateur partage `birthreminder.com/event/:shortId` + `accessCode`
2. Le guest ouvre l'URL → `EventPage` en mode lecture seule
3. Clic "Rejoindre" → `JoinEventModal` → `POST /:shortId/join` avec `{ accessCode, guestName }`
4. Backend crée une `EventInvitation` avec `user: null`, `guestName`, `joinedViaCode: true`, `status: 'pending'`
5. Le guest est redirigé vers la même page, maintenant avec accès complet (RSVP, vote, chat)
6. Son identité est mémorisée via un cookie de session ou `localStorage` côté front (`guestToken`)

> ⚠️ Les guests externes ne voient pas le chat si `allowExternalGuests` est `false` sur l'event.

### EventCard (`events/EventCard.jsx`)
- Carte résumé affichée dans `EventsPanel` et potentiellement dans `Agenda`
- Affiche : titre, type (badge coloré), date/lieu si fixés, nombre de participants, statut (draft/published/etc.)
- Actions (organizer only) : ✏️ Modifier → ouvre `EventForm` en mode edit, 🗑️ Supprimer → modal confirmation
- Clic sur la carte → navigue vers `/event/:shortId`

### EventForm (`events/EventForm.jsx`)
- Stepper 6 étapes avec animations motion/react
- Google Places Autocomplete pour le lieu (step 3)
- Étapes cliquables directement : toujours en edit mode, uniquement ≤ step actuel en create mode
- `imposedGifts` : array avec UI add/remove (pas un objet unique)
- `allowGuestInvites` : checkbox en étape 5

### DateList (`dashboard/DateList.jsx`)
- Fetche `GET /events/mine` pour passer `events` à `<Agenda>`
- Gère les états : isFilterVisible, isChatVisible, isEventsVisible, viewMode (card/agenda)
- Buttons navbar : Filtre | Carte/Agenda | Chat | 🎉 Événements | Ajouter une date

---

## 🔌 Socket.io

### Pattern anti-stale-closure (IMPORTANT)
Voir `server/sockets/chatHandlers.js` pour le pattern utilisé. Les handlers doivent être re-enregistrés à chaque reconnexion et les callbacks doivent accéder aux variables via closure ou ref, pas via state direct.

### Rooms et events — Chat amis (existant)
- Room : `conversation:${conversationId}`
- Events : `message:send`, `message:new`, `typing:start`, `typing:stop`, `messages:read`

### Rooms et events — Événements (implémentés)
```js
// Rejoindre la room
socket.emit('event:join', { shortId })
socket.emit('event:leave', { shortId })

// Chat
socket.emit('event:message_send', { shortId, content })
socket.on('event:message_new', callback)
socket.emit('event:typing_start', { shortId })
socket.on('event:typing_stop', callback)

// Mises à jour temps réel
socket.on('event:rsvp_updated', callback)
socket.on('event:vote_updated', callback)
socket.on('event:gift_proposed', callback)
socket.on('event:guest_joined', callback)
```

### Client Socket.io
Service singleton : `front/src/components/services/socket.service.js`
- `socketService.connect(userId)` — connexion avec auth
- `socketService.emit(event, data)` — émettre
- `socketService.on(event, cb)` / `socketService.off(event, cb)` — écouter / se désabonner

---

## 📧 AWS SES — Templates email

**Helpers partagés** : `server/services/emailTemplates/emailHelpers.js`
→ fonctions `header()`, `footer()`, `badge()`, `ctaButton()` pour un style cohérent.

**Templates existants :**
- `birthdayReminder.js` — rappel anniversaire
- `namedayReminder.js` — rappel fête
- `invitationEmail.js` — invitation ami
- `friendRequestEmailService.js` — demande d'ami
- `passwordResetEmail.js` — réinitialisation mot de passe
- `monthlyRecapEmail.js` — récap mensuel
- `eventEmails.js` — **invitation event, rappel J-7/J-1, vote requis, date confirmée**

> ⚠️ Ne jamais modifier les templates existants. Ajouter uniquement.

---

## ⏰ Cron Jobs

| Fichier | Schedule | Rôle |
|---------|----------|------|
| `jobs/sendReminders.js` | Minuit quotidien | Rappels anniversaires et fêtes |
| `jobs/eventReminders.js` | 6h quotidien | Rappels événements (J-7, J-1, configurable) |
| `jobs/chatNotificationCron.js` | 5min / 9h / Lun 9h | Notifications chat groupées |
| `jobs/purgeDeletedAccounts.js` | 3h quotidien | Suppression comptes inactifs |

---

## 🎨 CSS & Design System

### Variables CSS globales (`front/src/styles/variables.css`)
```css
/* Couleurs */
--primary: #3b82f6;       --primary-light: #60a5fa;   --primary-dark: #2563eb;
--success: #10b981;       --danger: #ef4444;           --warning: #f59e0b;

/* Backgrounds */
--bg-primary: #ffffff;    --bg-secondary: #f9fafb;     --bg-tertiary: #f3f4f6;

/* Texte */
--text-primary: #111827;  --text-secondary: #6b7280;   --text-tertiary: #9ca3af;

/* Borders */
--border-color: #e5e7eb;  --border-color-hover: #d1d5db;

/* Shadows */
--card-shadow: ...;       --card-shadow-hover: ...;
```

Dark mode : classe `.dark` sur le body redéfinit toutes ces variables.

### Règles CSS à respecter
- **Pas d'inline styles** — tout dans des fichiers `.css` dédiés
- Toujours utiliser les variables CSS (`var(--primary)`, `var(--bg-primary)`, etc.)
- Chaque composant a son fichier CSS dans son dossier (`css/nomComposant.css`)
- Le dark/light mode est géré automatiquement via `ThemeContext` + classe `.dark` sur body

### Fichiers CSS partagés (`components/UI/css/`)
- `carousel-common.css` — styles carousel mobile (FriendProfile)
- `gifts-common.css` — styles cartes cadeaux
- `badge-notification.css` — badges de notification
- `modals.css` — styles modals génériques
- `containerInfo.css` — conteneurs info

---

## 🔗 URLs & Partage événements

- `shortId` : 5 caractères, généré avec `nanoid(5)`
- `accessCode` : 6 caractères alphanumériques (`Math.random().toString(36).substring(2,8).toUpperCase()`)
- URL publique : `birthreminder.com/event/:shortId`
- API share : `GET /api/events/:shortId/share` → `{ url, code }`

---

## 💳 Cagnotte — PLACEHOLDER

> Ne pas implémenter. Champ `giftPoolEnabled: false` déjà présent dans le schéma Event.
> Prévoir visuellement une section grisée "Cagnotte — Bientôt disponible" dans EventPage/EventForm.

---

## 🚫 Ne pas toucher

- Le système de chat entre amis existant (s'en inspirer, ne pas modifier)
- Les schémas `User`, `Friend`, `Date` existants (seulement ajouter des refs si nécessaire)
- La configuration Nginx / PM2 / CORS existante
- La configuration AWS SES existante (ajouter des templates, ne pas modifier l'existant)
- Les fichiers CSS du dark/light mode — utiliser uniquement les variables CSS

---

## ⚠️ Points de vigilance

### Dates
- Les anniversaires (`date.date`) sont comparés **mois + jour uniquement** (récurrence annuelle)
- Les namedays (`date.nameday || date.linkedUser?.nameday`) sont au format `"MM-DD"` (ex: `"03-13"`)
- Les dates d'événements comparent **année + mois + jour** (pas récurrentes)
- Toujours parser les dates avec `new Date(year, month, day)` pour éviter les problèmes de timezone

### Événements
- `imposedGifts` est un **array**, jamais un objet unique
- `allowGuestInvites` contrôle la visibilité du bouton "Inviter" et du lien de partage pour les invités
- `forDate` vs `forPerson` : `forDate` référence un objet `Date` (anniversaire manuel), `forPerson` référence un `User` (ami inscrit)

### Navigation profil
- Les profils n'ont PAS de route dédiée `/dates/:id` — tout passe par `/home?tab=date&dateId=...`
- Le retour depuis EventPage va vers `/home?tab=events`

### Socket.io stale closures
- Toujours utiliser le pattern de `chatHandlers.js` (re-enregistrement des handlers)
- Ne pas capturer du state React dans les callbacks Socket sans les exposer via ref

---

## 📦 Dépendances clés

### Backend (`server/package.json`)
```
express 4.19          mongoose 6.2          socket.io 4.8
bcryptjs 2.4          jsonwebtoken 9.0      express-jwt 7.7
@aws-sdk/client-ses   nodemailer 6.10       node-cron 4.2
nanoid 3.3            multer + cloudinary   helmet 8.0
```

### Frontend (`front/package.json`)
```
react 18.3            react-router-dom 6.2  axios 1.7
socket.io-client 4.8  motion 12.38          lucide-react 0.539
vite 5.4
```
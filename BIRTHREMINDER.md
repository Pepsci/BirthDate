# BIRTHREMINDER — Contexte projet complet
*Généré : avril 2026 — À mettre à jour à chaque évolution majeure*

---

## 1. Description & Proposition de valeur

**BirthReminder** est une application web full-stack de gestion d'anniversaires, de fêtes et d'événements entre amis.

**Problème résolu :** Ne plus oublier les anniversaires et les fêtes de ses proches, centraliser l'organisation d'événements (soirées surprise, anniversaires, dîners), gérer les idées cadeaux et faciliter la coordination de groupe.

**Public cible :** Particuliers souhaitant maintenir le lien avec leur entourage (famille, amis).

**URL production :** `https://birthreminder.com`
**URL dev :** `http://localhost:5173` (front) / `http://localhost:4000` (back)

---

## 2. Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Frontend** | React | 18.3 |
| **Routing** | React Router DOM | 6.2 |
| **Animations** | motion (Framer Motion) | 12.38 |
| **HTTP Client** | Axios | 1.7 |
| **Build** | Vite | 5.4 |
| **Backend** | Node.js + Express | 4.19 |
| **Base de données** | MongoDB + Mongoose | 6.2 |
| **Temps réel** | Socket.io | 4.8 |
| **Auth** | JWT (httpOnly cookie) | jsonwebtoken 9.0 / express-jwt 7.7 |
| **Emails** | AWS SES + Nodemailer | @aws-sdk/client-ses 3.x |
| **Upload images** | Cloudinary + multer | cloudinary 1.28 / multer 1.4 |
| **Push notifs** | Web Push (VAPID) | web-push 3.6 |
| **Cron jobs** | node-cron | 4.2 |
| **Sécurité** | Helmet | 8.0 |
| **Rate limiting** | express-rate-limit | 8.3 |
| **Chiffrement E2E** | TweetNaCl + BIP39 | tweetnacl 1.0 / bip39 3.1 |
| **SEO** | react-helmet-async | 3.0 |
| **Icônes** | lucide-react | 0.539 |
| **Déploiement** | AWS EC2 | — |
| **URL scraping** | open-graph-scraper + cheerio | — |
| **Génération IDs** | nanoid | 3.3 |

---

## 3. Features existantes et état d'implémentation

### ✅ Implémentées et stables

#### Authentification & Compte
- Inscription avec email, vérification email obligatoire
- Connexion JWT stocké en cookie httpOnly
- Réinitialisation de mot de passe par email (token expirant)
- Mise à jour du profil (avatar Cloudinary, mot de passe, préférences)
- Suppression de compte (soft delete → purge cron à J+30)
- Onboarding (flag `onboardingDone`)

#### Gestion des dates
- Création manuelle d'une date (anniversaire ou fête, famille/ami)
- Lien optionnel vers un `User` inscrit (`linkedUser`)
- Format nameday : `MM-DD` (ex: `"03-13"`)
- Préférences de notification par date (timings, activer/désactiver)
- Préférences spécifiques fête (nameday preferences)
- Cadeaux associés à une date (add/update/delete, avec URL, prix, image, statut achat)

#### Système d'amis
- Envoi/réception de demandes d'amitié
- Invitations par email pour non-inscrits (token + expiration)
- Acceptation/refus de demande
- Lien automatique date ↔ ami (`linkedDate`)
- Fusion de doublons (`/merge-duplicates`)

#### Chat (Conversations DM)
- Conversations temps réel via Socket.io
- Accusés de lecture (read receipts)
- Indicateur de frappe (typing indicators)
- Chiffrement E2E optionnel (mode "full" — BIP39 + TweetNaCl)
- Partage de cadeaux en message (type `gift_share`)
- Notifications email groupées (fréquence configurable : instant / 2x/jour / quotidien / hebdo)
- Désactivation par ami

#### Wishlist
- Liste de souhaits par utilisateur
- Scraping automatique de l'URL (titre, image, prix via OG tags)
- Partage avec amis (`isShared`)
- Réservation et achat par un ami

#### Notifications
- In-app : centre de notifications paginé, marquage lu, suppression
- Push (Web Push VAPID) : configurable par type (anniversaires, chat, amis, cadeaux)
- Email AWS SES : rappels anniversaires, fêtes, invitations amis, reset mot de passe, récap mensuel, événements

#### Rappels automatiques (Cron)
- Rappels anniversaires quotidiens (J-1, J-7, J-14, J-30 — configurable par date)
- Rappels fêtes quotidiens
- Récap mensuel (1er du mois)
- Rappels événements (J-7, J-1)
- Notifications chat groupées (4 fenêtres de fréquence)
- Purge comptes supprimés

#### Agenda
- Vue Mois : grille 7 colonnes, offset lundi correct, pastilles colorées
- Vue Semaine : layout vertical 7 lignes, max 3 items par jour
- Modal jour (`AgendaDayModal`) : anniversaires, fêtes, événements
- Navigation depuis le modal vers FriendProfile ou EventPage
- Intégration des événements (`GET /events/mine`)

#### Événements ⭐
- Création via stepper 6 étapes (`EventForm`)
- Types : birthday / party / dinner / other
- Mode date : fixe ou vote (plusieurs options)
- Mode lieu : fixe ou vote + Google Places Autocomplete
- Mode cadeaux : imposé (liste) ou propositions par les invités
- Code d'accès 6 caractères (join sans invitation)
- Invités externes (sans compte BirthReminder)
- RSVP : pending / accepted / declined / maybe
- Votes date et lieu
- Propositions cadeaux avec vote toggle
- Chat de groupe temps réel Socket.io (room `event:${shortId}`)
- Partage par URL + code d'accès
- Rappels configurables (J-7, J-1)
- Contrôle `allowGuestInvites` (les invités peuvent-ils inviter ?)
- Page publique `/event/:shortId` (lecture seule sans auth)
- Rejoindre via modal `JoinEventModal` (sans compte)

### 🚧 Placeholder (prévu, non implémenté)

- **Cagnotte (`giftPoolEnabled`)** : champ présent dans le schéma, UI grisée "Bientôt disponible"

---

## 4. Structure des dossiers

```
BirthDate/
├── server/
│   ├── app.js                    # Express app, CORS, montage routes, init crons
│   ├── server.js                 # HTTP server + Socket.io setup
│   ├── bin/www                   # Point d'entrée Node
│   ├── config/
│   │   ├── db.config.js          # Connexion MongoDB
│   │   └── cloudinary.config.js  # Cloudinary setup
│   ├── middleware/
│   │   ├── jwt.middleware.js      # Vérification JWT (cookie + header)
│   │   ├── socketAuth.js          # Auth Socket.io
│   │   ├── checkEventAccess.js    # Middleware accès événement
│   │   └── logger.middleware.js   # Audit logs
│   ├── models/                    # 14 schémas Mongoose
│   ├── routes/                    # ~15 fichiers de routes Express
│   ├── sockets/
│   │   ├── chatHandlers.js        # Handlers Socket.io DM
│   │   └── eventHandlers.js       # Handlers Socket.io Events
│   ├── jobs/
│   │   ├── sendReminders.js       # Cron anniversaires/fêtes
│   │   ├── eventReminders.js      # Cron rappels événements
│   │   ├── chatNotificationCron.js# Cron notifs chat groupées
│   │   └── purgeDeletedAccounts.js# Cron suppression comptes
│   ├── services/
│   │   └── emailTemplates/        # Templates AWS SES
│   │       ├── emailHelpers.js    # header(), footer(), badge(), ctaButton()
│   │       ├── birthdayReminder.js
│   │       ├── namedayReminder.js
│   │       ├── invitationEmail.js
│   │       ├── friendRequestEmailService.js
│   │       ├── passwordResetEmail.js
│   │       ├── monthlyRecapEmail.js
│   │       └── eventEmails.js     # invitation, J-7/J-1, vote requis, date confirmée
│   └── utils/
│       ├── nameday.js             # Helpers fêtes
│       ├── friendDates.js         # Helpers dates amis
│       └── notify.js              # Envoi notifications in-app
│
└── front/src/
    ├── App.jsx                    # Router principal
    ├── main.jsx                   # Bootstrap + Context providers
    ├── api/
    │   └── apiHandler.jsx         # Instance Axios centralisée
    ├── context/
    │   ├── auth.context.jsx       # Authentification
    │   ├── theme.context.jsx      # Thème light/dark/auto
    │   ├── notification.context.jsx # Notifications + unreads
    │   └── OnlineStatusContext.jsx  # Présence en ligne
    ├── protectedRoutes/
    │   └── PrivateRoute.jsx
    ├── styles/
    │   └── variables.css          # CSS variables globales dark/light
    ├── utils/                     # Chiffrement, helpers
    └── components/
        ├── Accueil/               # LandingPage
        ├── connect/               # AuthPage, VerifyEmail, ResetPassword
        ├── dashboard/             # Home, DateList, BirthdayCard, Agenda, AgendaDayModal, UpdateDate...
        ├── chat/                  # Chat, DirectChat, ChatModal, ChatWindow...
        ├── events/                # EventPage, EventForm, EventsPanel, EventCard, JoinEventModal...
        ├── friends/               # Friends, AddFriendModal, MergeDuplicates...
        ├── layout/                # Footer, CookieBanner, ScrollToTop
        ├── notifications/         # Toast composant
        ├── pages/                 # CGU, Privacy, Cookies, Guide, MentionsLegales
        ├── profil/                # Profile, FriendProfile, Wishlist, BirthdayView...
        ├── services/
        │   └── socket.service.js  # Singleton Socket.io client
        └── UI/
            ├── Logo.jsx
            └── css/               # Styles partagés (carousel, gifts, modals, badges...)
```

---

## 5. Routes API complètes

**Préfixe global : `/api`**

### Auth (`/api/auth`)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/signup` | Inscription |
| POST | `/login` | Connexion (cookie httpOnly) |
| POST | `/logout` | Déconnexion |
| GET | `/verify` | Vérification session + refresh token |
| POST | `/forgot-password` | Demande reset mot de passe |
| POST | `/reset/:token` | Réinitialisation mot de passe |

### Dates (`/api/date`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Liste toutes les dates de l'user (enrichies conversationId) |
| POST | `/` | Créer une date |
| GET | `/:id` | Récupérer une date |
| PATCH | `/:id` | Modifier une date |
| DELETE | `/:id` | Supprimer une date |
| PATCH | `/:id/gifts` | Ajouter un cadeau |
| PATCH | `/:id/gifts/:giftId` | Modifier un cadeau |
| DELETE | `/:id/gifts/:giftId` | Supprimer un cadeau |
| PUT | `/:id/notifications` | Toggle notifications date |
| PUT | `/:id/notification-preferences` | Préférences notification anniversaire |
| PUT | `/:id/nameday-preferences` | Préférences notification fête |

### Users (`/api/users`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` ou `/me` | Infos user courant |
| PATCH | `/me` | Modifier profil (avatar, mot de passe...) |
| PUT | `/keys` | Stocker clés E2E |
| GET | `/:userId/publicKey` | Clé publique d'un user (E2E) |

### Friends (`/api/friends`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Liste des amis |
| GET | `/requests` | Demandes en attente reçues |
| GET | `/sent` | Demandes envoyées + invitations externes |
| POST | `/` | Envoyer une demande d'amitié ou invitation |
| PATCH | `/:friendshipId/accept` | Accepter |
| PATCH | `/:friendshipId/reject` | Refuser |
| PATCH | `/:friendshipId/link-date` | Lier ami à une date |
| DELETE | `/:friendshipId` | Supprimer ami |

### Conversations (`/api/conversations`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Liste conversations avec unreads |
| POST | `/start` | Démarrer une conversation |
| GET | `/:conversationId` | Conversation + messages |
| POST | `/:conversationId/messages` | Envoyer message (REST fallback) |
| PATCH | `/:conversationId/read` | Marquer lu |

### Events (`/api/events`)
> ⚠️ `/mine` et `/check/:id` DOIVENT être déclarés avant `/:shortId`

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/` | Créer un événement (auth) |
| GET | `/mine` | Mes événements organisés + invités → `{ organized[], invited[] }` |
| GET | `/check/:id` | Vérifie si event existe pour un userId (forPerson) ou dateId (forDate) → `{ eventShortId }` ou `null` |
| GET | `/:shortId` | Récupérer un event (public, accès partiel sans auth) |
| PUT | `/:shortId` | Modifier (organizer only) |
| DELETE | `/:shortId` | Supprimer + cascade (organizer only) |
| POST | `/:shortId/invite` | Inviter des users inscrits + email |
| POST | `/:shortId/join` | Rejoindre via accessCode. Body: `{ accessCode, guestName? }` |
| PUT | `/:shortId/rsvp` | Répondre à l'invitation (auth + checkEventAccess) |
| POST | `/:shortId/vote/date` | Voter pour une date |
| POST | `/:shortId/vote/location` | Voter pour un lieu |
| POST | `/:shortId/gifts` | Proposer un cadeau |
| GET | `/:shortId/gifts` | Lister propositions |
| POST | `/:shortId/gifts/:giftId/vote` | Voter pour un cadeau (toggle) |
| PUT | `/:shortId/gifts/:giftId` | Modifier sa proposition |
| GET | `/:shortId/messages` | Messages chat event (HTTP fallback) |
| GET | `/:shortId/share` | `{ url, code }` pour partage |
| GET | `/:shortId/invitations` | Liste invitations peuplées |
| DELETE | `/:shortId/leave` | Quitter l'événement (invité) |

### Wishlist (`/api/wishlist`)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/fetch-url` | Scraper une URL (OG tags) |
| GET | `/` | Ma wishlist |
| POST | `/` | Ajouter un item |
| GET | `/:id` | Récupérer un item |
| PATCH | `/:id` | Modifier |
| DELETE | `/:id` | Supprimer |
| PATCH | `/:id/reserve` | Réserver |
| PATCH | `/:id/purchase` | Marquer acheté |

### Autres routes
| Préfixe | Description |
|---------|-------------|
| `/api/notifications` | CRUD notifications in-app (GET paginé, PATCH read, DELETE) |
| `/api/merge-dates` | POST `/suggest` + POST `/merge` |
| `/api/verify-email` | POST `/` — vérification token email |
| `/api/unsubscribe` | POST `/` — désabonnement emails |
| `/api/push` | POST `/subscribe` + `/unsubscribe` — Web Push |
| `/api/stats` | GET `/` — stats serveur (protégé par API key) |

---

## 6. Modèles de données (MongoDB / Mongoose)

### User
```js
{
  name, surname, email, password,
  avatar: String,                      // URL Cloudinary
  birthDate: Date,
  nameday: String,                     // Format MM-DD
  resetToken, resetTokenExpires,
  verificationToken, isVerified: Boolean,
  lastVerificationEmailSent: Date,
  deletedAt: Date,
  onboardingDone: Boolean,

  // Préférences emails
  receiveBirthdayEmails: Boolean,
  receiveFriendRequestEmails: Boolean,
  receiveOwnBirthdayEmail: Boolean,
  monthlyRecap: Boolean,
  receiveChatEmails: Boolean,
  chatEmailFrequency: Enum["instant","twice_daily","daily","weekly"],
  chatEmailDisabledFriends: [ObjectId],
  lastChatEmailSent: Date,

  // Push
  pushEnabled: Boolean,
  pushEvents: { birthdays, chat, friends, gifts: Boolean },
  pushBirthdayTimings: [Number],        // [1, 0] = J-1 + jour J

  // E2E chiffrement
  publicKey, encryptedPrivateKey,
  oldPublicKey, oldEncryptedPrivateKey,
  encryptedSeedPhrase,
  e2eMode: Enum["standard","full"],
  e2eActivatedAt: Date
}
```

### Date
```js
{
  date: Date,                          // Anniversaire (récurrence mois+jour uniquement)
  name, surname: String,
  nameday: String,                     // Format MM-DD
  owner: ref User,
  family: Boolean,
  receiveNotifications: Boolean,
  notificationPreferences: {
    timings: [Number],                 // [1, 7, 14, 30] jours avant
    notifyOnBirthday: Boolean
  },
  namedayPreferences: {
    timings: [Number],
    notifyOnNameday: Boolean
  },
  comment: Array,
  gifts: [{
    giftName, purchased, occasion, year,
    purchasedAt, url, price, image
  }],
  linkedUser: ref User                 // null = date manuelle
}
```

### Friend
```js
{
  user: ref User,
  friend: ref User,
  status: Enum["pending","accepted","rejected","blocked"],
  requestedBy: ref User,
  requestedAt, acceptedAt: Date,
  linkedDate: ref Date
}
// Index unique: { user, friend }
```

### Conversation + Message
```js
// Conversation
{ participants: [ref User], lastMessage: ref Message, lastMessageAt: Date }

// Message
{
  conversation: ref Conversation,
  sender: ref User,
  type: Enum["text","gift_share"],
  content: String (max 50000),
  metadata: Mixed,
  isEncrypted: Boolean,
  encryptedFor: Map<userId, ciphertext>,
  readBy: [{ user: ref User, readAt: Date }],
  edited: Boolean, editedAt: Date
}
```

### Event
```js
{
  shortId: String (5 chars, nanoid, unique),
  title, description: String,
  type: Enum["birthday","party","dinner","other"],
  organizer: ref User,
  forPerson: ref User,                 // ami inscrit
  forDate: ref Date,                   // date manuelle
  recurrence: { enabled, frequency, nextOccurrence },

  dateMode: Enum["fixed","vote"],
  fixedDate: Date,
  dateOptions: [Date],
  selectedDate: Date,

  locationMode: Enum["fixed","vote"],
  fixedLocation: { name, address, coordinates: { lat, lng } },
  locationOptions: [{ name, address, coordinates }],
  selectedLocation: { name, address, coordinates },

  giftMode: Enum["imposed","proposals"],
  imposedGifts: [{ name, url, price }],  // TOUJOURS un array
  giftPoolEnabled: Boolean,             // false — placeholder Cagnotte

  maxGuests: Number,                   // null = illimité
  accessCode: String (6 chars),
  allowExternalGuests: Boolean,
  allowGuestInvites: Boolean,

  reminders: [{ type, daysBeforeEvent, sent }],
  status: Enum["draft","published","cancelled","done"]
}
// Virtual: invitations (depuis EventInvitation)
```

### EventInvitation
```js
{
  event: ref Event,
  user: ref User,                      // null = invité externe
  externalEmail, guestName: String,
  status: Enum["pending","accepted","declined","maybe"],
  dateVote: [Date],
  locationVote: ObjectId,
  joinedViaCode: Boolean
}
```

### EventGiftProposal
```js
{ event: ref Event, proposedBy: ref User, name, url, price, votes: [ref User] }
```

### EventMessage
```js
{
  event: ref Event,
  sender: ref User,
  content: String (max 50000),
  isEncrypted: Boolean,
  encryptedFor: Map<userId, ciphertext>,
  readBy: [{ user, readAt }]
}
// Index: { event, createdAt: -1 }
```

### Wishlist
```js
{
  userId: ref User,
  title (max 100), price, url, image, description (max 500),
  isShared, isPurchased: Boolean,
  purchasedBy: ref User, purchasedAt: Date,
  reservedBy: ref User, reservedAt: Date
}
```

### Notification
```js
{
  userId: ref User,
  type: Enum["friend_request","friend_accepted","new_message","birthday_soon","gift_reserved","event_reminder"],
  data: Mixed, link: String,
  read: Boolean
}
```

### Invitation (amis)
```js
{ email, invitedBy: ref User, token (unique), status: Enum["pending","accepted"] }
// TTL: 30 jours
```

### PushSubscription
```js
{ userId: ref User (unique), subscription: { endpoint, keys: { p256dh, auth } } }
```

### Log
```js
{
  userId: ref User,
  action: Enum["login","logout","signup","password_reset","account_update","account_delete","friend_add","message_send"],
  ipAddress, userAgent, metadata
}
// TTL: 365 jours
```

---

## 7. Variables d'environnement

```bash
# Serveur
PORT=
NODE_ENV=                          # development | production

# Base de données
MONGO_URI=                         # MongoDB Atlas connection string

# Auth
TOKEN_SECRET=                      # Secret JWT
SESSION_SECRET=                    # Secret sessions Express

# Cloudinary (upload images)
CLOUDINARY_NAME=
CLOUDINARY_KEY=
CLOUDINARY_SECRET=

# AWS SES (emails)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=                        # ex: eu-west-3
EMAIL_FROM=                        # ex: reset_password@birthreminder.com
EMAIL_BRTHDAY=                     # ex: birthday@birthreminder.com

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_MAILTO=                      # ex: mailto:admin@birthreminder.com

# URLs
FRONTEND_URL=                      # ex: http://localhost:5173
BACKEND_URL=                       # ex: http://localhost:4000

# Statistiques (API interne)
STATS_API_KEY=
```

---

## 8. Socket.io — Événements

### Client singleton
`front/src/components/services/socket.service.js`
- `socketService.connect(userId)` — connexion avec auth
- `socketService.emit(event, data)` — émettre
- `socketService.on(event, cb)` / `socketService.off(event, cb)` — écouter / désabonner

### Rooms
- Chat DM : `conversation:${conversationId}`
- Événement : `event:${shortId}`

### Events Chat DM (existants, ne pas modifier)
```
users:getOnline / users:online / user:online / user:offline
conversation:join / conversation:leave / conversations:join
message:send / message:new / message:error
typing:start / typing:stop
messages:read
```

### Events Événements
```
event:join / event:leave
event:message_send / event:message_new
event:typing_start / event:typing_stop
event:rsvp_updated / event:vote_updated / event:gift_proposed / event:guest_joined
```

### Pattern anti-stale-closure
Toujours re-enregistrer les handlers à chaque reconnexion. Exposer le state React via ref, ne pas le capturer directement dans les callbacks Socket. Voir `server/sockets/chatHandlers.js` comme référence.

---

## 9. Frontend — Routing et composants clés

### Routes App.jsx
```
/ → LandingPage (public)
/auth, /login, /signup, /forgot-password → AuthPage (public)
/verify-email → VerifyEmail (public)
/auth/reset/:token → ResetPassword (public)
/event/:shortId → EventPage (public, lecture seule sans auth)
/unsubscribe → Unsubscribe (public)
/cookies, /privacy, /cgu, /guide, /mentions-legales → Pages statiques (public)
/home → Home (privé)
/profile → Profile (privé)
/birthday/:id → BirthdayView (privé)
/update-date/:id → UpdateDate (privé)
/merge-duplicates → MergeDuplicates (privé)
/events/mine → EventsPanel (privé)
/events/new → EventForm (privé)
```

### Deep links depuis `/home`
```
/home?tab=date&dateId=xxx  → FriendProfile pour ce dateId
/home?tab=agenda           → vue agenda
/home?tab=events           → EventsPanel
/home?tab=friends          → section amis du profil
```

### Context Providers (ordre dans main.jsx)
```
BrowserRouter > ThemeProvider > AuthProviderWrapper >
NotificationProvider > OnlineStatusProvider > HelmetProvider > App
```

### Composants clés
- **BirthdayCard** : carte cliquable entière → `onViewProfile(date, "info")`
- **FriendProfile** : sidebar desktop / carousel mobile, sections Info/Notifs/Wishlist/Cadeaux/Messages/Modifier
- **UpdateDate** : prop `compact=true` pour inline dans FriendProfile
- **Agenda** : vue Mois + Semaine, toggle mobile-first, `WEEK_VIEW_MAX_ITEMS=3`
- **AgendaDayModal** : bottom sheet mobile, navigation deep-link
- **EventsPanel** : filtres (tous/mes/invités/à venir/en attente/passés), pagination
- **EventPage** : tabs Info/Participants/Cadeaux/Chat/Votes, RSVP inline, JoinEventModal
- **EventForm** : stepper 6 étapes, Google Places Autocomplete step 3
- **EventCard** : carte résumé, actions organizer (edit/delete)

---

## 10. Design System CSS

### Variables globales (`front/src/styles/variables.css`)
```css
/* Couleurs */
--primary: #3b82f6;       --primary-light: #60a5fa;    --primary-dark: #2563eb;
--success: #10b981;       --danger: #ef4444;            --warning: #f59e0b;

/* Backgrounds */
--bg-primary: #ffffff;    --bg-secondary: #f9fafb;      --bg-tertiary: #f3f4f6;

/* Texte */
--text-primary: #111827;  --text-secondary: #6b7280;    --text-tertiary: #9ca3af;

/* Borders */
--border-color: #e5e7eb;  --border-color-hover: #d1d5db;

/* Shadows */
--card-shadow: ...;       --card-shadow-hover: ...;
```

Dark mode : classe `.dark` sur `<html>` redéfinit toutes ces variables. Géré par `ThemeContext`.

### Règles CSS
- **Pas d'inline styles** — tout dans des fichiers `.css` dédiés
- Toujours utiliser les variables CSS (`var(--primary)`, etc.)
- Chaque composant a son fichier CSS dans son dossier (`css/nomComposant.css`)
- Fichiers partagés dans `components/UI/css/` : `carousel-common.css`, `gifts-common.css`, `badge-notification.css`, `modals.css`, `containerInfo.css`

---

## 11. Cron Jobs

| Fichier | Schedule | Timezone | Rôle |
|---------|----------|----------|------|
| `sendReminders.js` | Minuit quotidien | Europe/Paris | Rappels anniversaires, fêtes, récap mensuel |
| `eventReminders.js` | 6h quotidien | Europe/Paris | Rappels événements J-7, J-1 |
| `chatNotificationCron.js` | 5min / 9h+18h / 9h / Lun 9h | — | Notifications chat groupées |
| `purgeDeletedAccounts.js` | 3h quotidien | — | Suppression comptes (deletedAt > 30j) |

---

## 12. Emails AWS SES

### Templates disponibles
| Fichier | Déclencheur |
|---------|-------------|
| `birthdayReminder.js` | Cron anniversaire (J-N) |
| `namedayReminder.js` | Cron fête (J-N) |
| `invitationEmail.js` | Invitation ami (inscrit ou externe) |
| `friendRequestEmailService.js` | Demande d'ami reçue |
| `passwordResetEmail.js` | Forgot password |
| `monthlyRecapEmail.js` | 1er du mois |
| `eventEmails.js` | Invitation event, rappel J-7/J-1, vote requis, date confirmée |

### Helpers partagés (`emailHelpers.js`)
Fonctions `header()`, `footer()`, `badge()`, `ctaButton()` pour cohérence visuelle.

> ⚠️ Ne jamais modifier les templates existants. Ajouter uniquement.

---

## 13. Décisions d'architecture importantes

### Authentification
- JWT stocké en **cookie httpOnly** (pas localStorage) pour sécurité XSS
- `express-jwt` extrait le token depuis le cookie `authToken` en priorité
- Token vérifié et rafraîchi à chaque `GET /auth/verify`

### IDs événements
- `shortId` : 5 caractères via `nanoid(5)` — URL-friendly, pas de collision en pratique
- `accessCode` : 6 caractères alphanumériques upper-case via `Math.random().toString(36)`

### Ordre des routes Express (critique)
`/mine` et `/check/:id` DOIVENT être déclarés **avant** `/:shortId` dans `events.js`.

### `checkEventAccess` middleware
Injecte `req.event`, `req.userRole` ("organizer" | "guest"), `req.invitation`. Retourne 403 si non accès.

### Dates et timezone
- Anniversaires : comparaison **mois + jour uniquement** (récurrence annuelle, pas d'année)
- Namedays : format string `"MM-DD"` (ex: `"03-13"`)
- Événements : comparaison **année + mois + jour** (non récurrents)
- Toujours parser avec `new Date(year, month, day)` pour éviter les problèmes UTC

### Navigation profil
- Pas de route `/dates/:id` — tout passe par **deep link** `/home?tab=date&dateId=...`
- Retour depuis EventPage → `/home?tab=events` (connecté) ou `/` (non connecté)

### `imposedGifts`
Toujours un **array** `imposedGifts: []`, jamais un objet unique.

### Guests externes
1. Partage URL `/event/:shortId` + accessCode
2. Lecture seule → `JoinEventModal` → `POST /:shortId/join` avec `{ accessCode, guestName? }`
3. `EventInvitation` créée avec `user: null`, `guestName`, `joinedViaCode: true`
4. Identité mémorisée via cookie ou `localStorage` (`guestToken`)
5. Accès chat conditionné par `allowExternalGuests`

### Chiffrement E2E (optionnel)
- Clés asymétriques TweetNaCl, seed phrase BIP39
- Mode "standard" (défaut) ou "full" (E2E activé)
- Les clés publiques sont récupérables via `GET /users/:userId/publicKey`

### Socket.io
- Connexion automatique au login via `AuthContext`, déconnexion au logout
- Pattern anti-stale-closure : re-enregistrer les handlers à chaque reconnexion, exposer state via ref

---

## 14. Roadmap et features planifiées

### Court terme
- [ ] Cagnotte (`giftPoolEnabled`) — intégration paiement (Stripe ou PayPal)
- [ ] Récurrence événements (`recurrence.enabled` déjà dans le schéma)

### Moyen terme
- [ ] Notifications push pour les événements (invitations, RSVP, votes)
- [ ] Mode hors-ligne (PWA + service worker)
- [ ] Application mobile native (React Native)

### Placeholder déjà codé
- `giftPoolEnabled: false` dans Event schema → afficher section grisée "Bientôt disponible" dans EventPage et EventForm

---

## 15. Points de vigilance

- `imposedGifts` est un **array** — ne jamais traiter comme un objet
- `forDate` (ref Date manuelle) ≠ `forPerson` (ref User inscrit)
- `allowGuestInvites` contrôle la visibilité du bouton "Inviter" ET du lien de partage pour les invités
- Ne jamais modifier les schémas `User`, `Friend`, `Date` existants (seulement ajouter des refs)
- Ne jamais modifier les templates email existants (ajouter uniquement)
- Ne jamais toucher la config Nginx / PM2 / CORS existante
- Ne jamais toucher le système de chat DM existant (s'en inspirer)
- Les profils n'ont PAS de route dédiée — deep links via `/home?tab=date&dateId=...`

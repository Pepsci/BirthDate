# BIRTHREMINDER — Contexte projet complet
*Mis à jour : 16 septembre 2026 — À mettre à jour à chaque évolution majeure*

> **Lecture rapide pour reprendre le projet** : §0 (état actuel), §14 (ce qui
> reste à faire), §15 (points de vigilance). Le reste est de la référence.

---

## 0. État au 16 septembre 2026

Trois applications sur un seul backend :

| Surface | Dossier | État |
|---------|---------|------|
| Web | `front/` | En production sur `birthreminder.com` |
| Mobile iOS | `mobile/` | Bêta TestFlight — version affichée 1.0 (build 40 livré, 41 en préparation) |
| Mobile Android | `mobile/` | Chantier non commencé (`ANDROID_APPLINKS_TODO.md`) |
| API + temps réel | `server/` | AWS EC2 + nginx + PM2 |

**Chantiers terminés depuis juin 2026** : application mobile React Native
(Expo), cagnottes Stripe migrées d'Express vers Standard, cagnotte externe,
listes de cadeaux communes, silencieux par conversation, tickets de support,
panneau d'administration, réactions aux messages, conformité stores et DSA.

**Chantier en cours** : rien de bloquant. Voir §14 pour la suite.

### ⚠️ Deux numérotations de version qui ne se croisent pas

- `mobile/app.json` → `"version": "1.0.0"` : c'est le `CFBundleShortVersionString`,
  la version affichée par TestFlight et l'App Store. **Jamais incrémentée
  depuis le début.**
- `mobile/src/lib/changelog.ts` → `1.5.0`, `1.6.0`, `1.7.0`, `1.8.0` :
  numérotation inventée pour les notes in-app, reliée à rien.
- `mobile/app.json` → `"ios.buildNumber"` : le seul numéro réellement
  incrémenté (40 livré, 41 à venir).

Conséquence : `APP_VERSION` (`front`/`mobile` → `api.ts`) est envoyé au serveur
à chaque appel et à chaque enregistrement de token push, et vaut toujours
`1.0.0`. Les logs ne permettent pas de distinguer un appareil en build 35 d'un
appareil en build 40. **À corriger en alignant `version` sur la numérotation du
changelog.**

⚠️ `npx expo prebuild --clean` a déjà écrasé `buildNumber` une fois
(39 → 38, le 11/09). Revérifier `app.json` après chaque prebuild.

---

## 1. Description & Proposition de valeur

**BirthReminder** est une application de gestion d'anniversaires, de fêtes et
d'événements entre amis, avec cagnotte commune.

**Problème résolu :** ne plus oublier les anniversaires et fêtes de ses
proches, centraliser l'organisation d'événements, gérer les idées cadeaux,
collecter une cagnotte et coordonner un groupe.

**Public cible :** particuliers souhaitant maintenir le lien avec leur
entourage.

**Positionnement juridique :** BirthReminder est un **intermédiaire technique**.
L'argent des cagnottes ne transite jamais par ses comptes (charges directes
Stripe sur le compte de l'organisateur). Le service est **gratuit** : aucune
commission n'est prélevée. Voir §13 pour la doctrine complète en cas de litige.

**URL production :** `https://birthreminder.com`
**URL dev :** `http://localhost:5173` (front) / `http://localhost:4000` (back)

---

## 2. Stack technique

### Backend (`server/`)
| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Node.js + Express | 4.19 |
| Base de données | MongoDB + Mongoose | 6.13 |
| Temps réel | Socket.io | 4.8 |
| Auth | JWT (cookie httpOnly) | jsonwebtoken 9.0 / express-jwt 7.7 |
| Paiement | **Stripe Connect Standard, charges directes** | stripe 22.2 |
| Emails | AWS SES + Nodemailer | @aws-sdk/client-ses 3.x |
| Images | multer memoryStorage → sharp (webp, EXIF strippé) → disque local | ⚠️ `config/cloudinary.js` est du code mort |
| Push | Web Push (VAPID) + Expo Push | web-push 3.6 |
| Cron | node-cron | 4.2 |
| Sécurité | Helmet, express-rate-limit, geoip-country | — |
| Chiffrement au repos (RIB) | crypto natif (AES-256-GCM) | — |
| Scraping | open-graph-scraper + cheerio | — |
| Déploiement | AWS EC2 + nginx + PM2 | — |

### Web (`front/`)
| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | React | 18.3 |
| Routing | React Router DOM | 6.2 |
| Build | Vite | 5.4 |
| Animations | motion (Framer Motion) | 12.38 |
| Paiement | @stripe/react-stripe-js 6.6 / @stripe/stripe-js 9.8 | — |
| Chiffrement E2E | TweetNaCl + BIP39 + @noble/hashes | — |
| Cartes | react-leaflet 4.x (OpenStreetMap) | ⚠️ v5 incompatible React 18 |
| Analytics | posthog-js | 1.194 |
| Icônes | lucide-react + Font Awesome | — |

### Mobile (`mobile/`)
| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Expo SDK | 54.0 |
| Runtime | React Native | 0.81.5 |
| React | React | 19.1 |
| Routing | expo-router | 6.0 |
| Push | expo-notifications + NSE Swift | 0.32 |
| Stockage sécurisé | expo-secure-store | 15.0 |
| Paiement | @stripe/stripe-react-native | 0.50 |
| Chiffrement E2E | TweetNaCl (JS) + swift-sodium (NSE) | — |

---

## 3. Features par domaine

### Authentification & compte
Inscription + vérification email obligatoire, JWT en cookie httpOnly (avec repli
sur l'en-tête `Authorization` pour le mobile), reset par token, profil (avatar,
mot de passe, préférences), suppression de
compte (soft delete → purge cron J+30), onboarding, export RGPD des données
(`users.export.js`), blocage d'utilisateurs.

### Dates & cadeaux
Dates manuelles (anniversaire ou fête), lien optionnel vers un `User`
(`linkedUser`), format nameday `MM-DD`, préférences de notification par date,
cadeaux associés (URL, prix, image, statut d'achat).

### Amis
Demandes d'amitié, invitations par email pour non-inscrits (token + expiration),
lien automatique date ↔ ami (`linkedDate`), fusion de doublons.

### Chat (DM)
Socket.io temps réel, accusés de lecture, indicateur de frappe, **chiffrement
E2E** (BIP39 + TweetNaCl box X25519/XSalsa20-Poly1305), partage de cadeaux et de
dates en message, notifications email groupées, silencieux par conversation,
**réactions** (voir §13).

### Wishlist
Liste par utilisateur, scraping OG de l'URL, partage entre amis, page publique
via `publicSlug`, réservation/achat par un ami, liens affiliés Amazon
(`birthreminder-21`).

### Listes de cadeaux communes (`sharedGiftList`)
Listes co-gérées, invitations, réservations depuis le lien public (avec email de
confirmation), code d'accès qui garde la porte, filtres par occasion et par état,
masquage d'une idée aux invités, libération d'une réservation par un gestionnaire.

### Événements
Stepper de création 6 étapes. Types : `birthday` / `party` / `dinner` (libellé
**« Repas »**) / `other`. Date fixe ou vote, lieu fixe ou vote, cadeaux imposés /
propositions / désactivés. Code d'accès 6 caractères, invités sans compte, RSVP,
votes, chat de groupe, carte Leaflet, rappels J-7/J-1, annulation et
rétablissement, **transfert d'organisation**, page publique `/event/:shortId`.

`event:join` est émis au niveau d'`EventPage` dès l'accès complet → tout le
temps réel (cagnotte, virements, votes, RSVP) fonctionne sans ouvrir le chat.

### Cagnotte (Gift Pool)
Voir §13 pour l'architecture Stripe complète. En résumé : charges directes sur
le compte Standard de l'organisateur, PaymentElement inline, webhook signé comme
seule source de vérité, reçu email, historique dans « Mes contributions »,
3-D Secure forcé au-delà d'un seuil, cagnotte externe en alternative.

### Virement direct (hors plateforme)
RIB chiffré AES-256-GCM dans un modèle séparé avec index TTL (auto-suppression
7/14/30/60/90 j), accès réservé aux comptes BirthReminder, lien PayPal.Me en
clair, toggles indépendants.

### Support & modération
Tickets (`supportMessage`), catégories `general` / `pool`, réponses de l'équipe
notifiées (`support_reply`), signalement de contenu et blocage d'utilisateurs
(`moderation.js` — conformité Apple 1.2 / Google Play UGC), centre d'aide avec
FAQ et procédures pas-à-pas.

### Administration (`/admin`)
Utilisateurs, événements (avec agrégats cagnotte et tickets), cagnottes (gel,
remboursement avec garde-fou de solde, dossier de preuves téléchargeable),
tickets, logs (avec pays depuis l'IP), statistiques, registre de revue des
alertes de fraude (`poolAlertReview` — diligence documentée au sens du DSA).

### Notifications
Centre in-app paginé, push Web Push (web) et Expo + NSE (iOS), emails SES.
Silencieux par conversation et par événement. Types dans l'enum de
`notification.model.js` — **tout nouveau type doit y être ajouté**, et à
`notify.js` s'il déclenche une push.

### Crons
Rappels anniversaires (J-1/7/14/30 configurables), rappels fêtes, récap mensuel,
rappels événements, notifications chat groupées (4 fenêtres), purge des comptes
supprimés, rétention des logs.

---
## 4. Structure des dossiers

```
birthreminder/
├── BIRTHREMINDER.md          # ce document
├── CLAUDE.md                 # instructions de travail pour l'assistant
├── TESTFLIGHT_NOTES.md       # notes du build en cours (à réécrire à chaque build)
├── ROADMAP_2026.md  A_TESTER.md  AUDIT_STORES_2026.md
├── AUDIT_TEXTES_LEGAUX.md  SECURITE_A_FAIRE.md  ANDROID_APPLINKS_TODO.md
├── server/
│   ├── app.js                # ⚠️ webhook Stripe monté AVANT express.json()
│   ├── bin/www               # app.set("io", io)
│   ├── config/               # mongoDb, avatarStorage, cardPhotoStorage, stripe
│   ├── constants/reactions.js
│   ├── middleware/           # jwt, socketAuth, checkEventAccess, logger
│   ├── models/               # 23 schémas Mongoose
│   ├── routes/
│   │   ├── admin/            # events, logs, pools, stats, support, users
│   │   ├── events/           # core, invitations, votes, gifts, pool,
│   │   │                     #   bankInfo, transfer, notifyOrganizer
│   │   ├── stripe.connect.js  stripe.webhook.js
│   │   ├── support.js  moderation.js  sharedGifts.js  chatMutes.js
│   │   └── …
│   ├── sockets/              # chatHandlers.js, eventHandlers.js
│   ├── jobs/                 # crons
│   ├── scripts/              # outils de diagnostic (voir §12)
│   ├── services/             # pushService, poolFraudService, emailTemplates/
│   └── utils/                # notify, bankCrypto, blocking, mobileLinks, urlGuard
│
├── front/src/
│   ├── api/apiHandler.jsx
│   ├── context/              # auth, theme, notification, OnlineStatus
│   ├── styles/variables.css
│   └── components/
│       ├── admin/            # AdminPools, AdminEvents, AdminSupport, AdminAlerts…
│       ├── chat/             # ChatWindow, ConversationList, MuteBell…
│       ├── events/
│       │   ├── chat/EventChat.jsx
│       │   └── stripe/       # GiftPoolManager, ContributeModal,
│       │                     #   ExternalPoolManager, DirectTransferViewer…
│       ├── notifications/    # NotificationItem
│       ├── pages/            # CGU, HelpCenter, ContactPage…
│       ├── profil/           # MyContributions…
│       └── UI/               # ReactionIcon, ReactionPills, ReactionPicker,
│                             #   ReportMessageModal, Avatar, ConfirmModal…
│
└── mobile/
    ├── app.json              # ⚠️ plugins : withFmtConstevalFix EN DERNIER
    ├── plugins/withFmtConstevalFix
    ├── targets/BirthReminderNSE/NotificationService.swift
    └── src/
        ├── app/              # expo-router : (tabs), event/, chat/, profile/…
        ├── components/       # ReactionPills, MessageActionSheet, icons/…
        └── lib/              # api, socket, crypto, notifications, changelog,
                              #   faqData, events, conversations, moderation…
```

---

## 5. Routes API

**Préfixe global : `/api`**

Les routes historiques (auth, dates, users, friends, conversations, wishlist,
notifications, events de base) sont stables — se reporter au code, elles n'ont
pas bougé. Ci-dessous uniquement ce qui a changé ou été ajouté.

### Events — cagnotte et virements
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/:shortId/pool` | État cagnotte + total + contributions |
| PUT | `/:shortId/pool` | Activer/configurer (organizer) |
| POST | `/:shortId/pool/contribute` | PaymentIntent (charge directe). `guestEmail` **obligatoire** pour un invité (`EMAIL_REQUIRED`) ; 3-D Secure forcé au-delà de `FORCE_3DS_ABOVE` |
| GET | `/pool/mine/contributions` | Historique des versements de l'utilisateur |
| GET/PUT/DELETE | `/:shortId/bank-info` | RIB chiffré (compte requis) |
| PUT | `/:shortId/direct-transfer/*` | Toggles IBAN / PayPal / cagnotte externe |

### Stripe Connect (`/api/stripe/connect`)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/onboard` | Crée/réutilise un compte **Standard** + lien d'onboarding |
| GET | `/status` | État du compte (`ready` si peut encaisser) |
| POST | `/dashboard` | Lien vers le tableau de bord. Branche Express (login link) / Standard (`dashboard.stripe.com`), renvoie `kind` |
| GET | `/balance` | Solde du compte connecté |
| DELETE | `/account` | Déconnexion. Refusée s'il existe des contributions `succeeded` ; clôture les cagnottes actives ; journalise `bankinfo_delete` |

### Support (`/api/support`)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/` | Ouvre un ticket. `category: "pool"` échappe à la règle « un seul ticket ouvert » (plafonné au nombre de participations) |
| GET | `/` `/:id` | Mes tickets |

### Admin (`/api/admin`)
| Méthode | Route | Description |
|---------|-------|-------------|
| PATCH | `/pools/:eventId/freeze` | Gèle une cagnotte |
| GET | `/pools/:eventId/evidence` | Dossier de preuves (JSON téléchargeable) |
| POST | `/pools/alerts/review` | Enregistre la revue d'une alerte |
| GET | `/events` | Événements + `ticketsCount`, `openTicketsCount`, `collectedCents` |

### Notifications
| Méthode | Route | Description |
|---------|-------|-------------|
| PATCH | `/read-conversation` | Éteint les notifs d'une conversation. `kind` `"dm"` \| `"event"` — filtre **verrouillé côté serveur**, le client ne choisit pas quel type marquer lu. Couvre `new_message` / `event_chat_message` **et** `message_reaction` |

---

## 6. Modèles — ajouts et champs sensibles

### Event (extraits)
```js
giftMode: Enum["imposed","proposals","none"],
imposedGifts: [{ name, url, price }],     // TOUJOURS un array
giftPool: { active, mode: Enum["free","goal"], goal, currency, deadline },
directTransfer: { ibanEnabled, paypalEnabled, paypalLink, externalPoolUrl },
organizerNotificationPrefs: { rsvp, dateVote, locationVote, giftProposed,
                              giftVote, chatMessage, poolContribution },
```

### StripeAccount
`user` (unique), `stripeAccountId`, `chargesEnabled`, `payoutsEnabled`,
`detailsSubmitted`, `onboardingCompletedAt`.

### GiftPoolContribution
`event`, `contributor` (null = invité), `guestName`, **`guestEmail`**, `amount`
(centimes), `currency`, `message`, `anonymous`, `stripePaymentIntentId` (unique),
`status` Enum`["pending","succeeded","failed","refunded"]`, **`feeCents`**,
**`receiptSentAt`**, **`guestTermsAcceptedAt`**.

### OrganizerBankInfo
`ibanEncrypted` + `iv` + `authTag` (AES-256-GCM), `holderName`, `expiresAt`
avec index TTL `expireAfterSeconds: 0`.

### PoolAlertReview
Revue d'une alerte de fraude, avec **`snapshot`** des chiffres au moment de la
revue : une alerte écartée se rouvre si les montants changent.

### SupportMessage
`category` Enum`["general","pool"]`, `relatedEvent`.

### Message / EventMessage
```js
reactions: [{ user: ref User, reaction: Enum(REACTIONS), createdAt }]
// une seule réaction par utilisateur et par message
```

### Notification — enum `type`
Tous les types événement, `shared_gift_*`, `support_reply`, et
**`message_reaction`** (un seul type pour le privé et l'événement ;
`data.eventShortId` distingue les deux).

---

## 7. Variables d'environnement

```bash
# Base
MONGO_URI=  TOKEN_SECRET=  FRONTEND_URL=  ORIGIN=
# AWS SES, VAPID, Expo : inchangés

# Stripe
STRIPE_SECRET_KEY=            # sk_test_… / sk_live_…
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=        # whsec_… (CLI en local, dashboard en prod)
STRIPE_CONNECT_RETURN_URL=
STRIPE_CONNECT_REFRESH_URL=
PUBLIC_SITE_URL=              # ⚠️ JAMAIS localhost — sert à business_profile.url,
                              #    que Stripe refuse en local
FORCE_3DS_ABOVE=15000         # centimes, défaut 150 €

# Chiffrement RIB — 64 caractères hex (32 octets)
# ⚠️ NE JAMAIS CHANGER une fois des IBAN chiffrés. Distinct test/prod.
BANK_ENCRYPTION_KEY=

# Front — ⚠️ le fichier doit s'appeler front/.env (avec le point).
# Vite ne charge QUE les fichiers commençant par un point : un fichier
# nommé "env" laisse VITE_STRIPE_PUBLISHABLE_KEY undefined, donc
# loadStripe(undefined), donc une modale de paiement vide et sans erreur.
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_GOOGLE_MAPS_API_KEY=     # à restreindre par référent HTTP (pas encore fait)
```

---

## 8. Socket.io

### Rooms
- DM : `conversation:${conversationId}`
- Événement : `event:${shortId}`
- Utilisateur : `user:${userId}` (notifications in-app)

### Événements
```
# DM
message:new  message:deleted  message:edited  messages:read
typing:start  typing:stop  contact:keyUpdated
message:react      → message:reacted        # bascule : renvoyer la même retire

# Événement
event:join / event:leave
event:message_send      → event:message_new
event:message_react     → event:message_reacted
event:typing_start / event:typing_stop
event:rsvp_updated  event:vote_updated  event:gift_proposed  event:guest_joined
event:pool_update       # émis par le webhook Stripe
event:transfer_update   # émis par les routes bankInfo

# Notifications
new_notification
```

---

## 9. Design system

- **Pas d'inline CSS.** Tout dans des fichiers `.css` dédiés, variables CSS.
- La variable de couleur principale est **`--primary`** (définie dans
  `front/src/styles/variables.css`). ⚠️ `--primary-color` **n'existe pas**.
- Fichiers CSS : **première lettre minuscule**, reste en camelCase
  (`eventPage.css`, `giftPool.css`, `reactions.css`).
- Mode sombre : classe `.dark` sur la racine, variables redéfinies.
- Mobile : `useThemedStyles(makeStyles)` avec `ThemeColors`, jamais de couleur
  en dur — **sauf** les icônes de réaction, volontairement à couleurs fixes
  (un cœur rouge reste rouge en clair comme en sombre).

---

## 10. Réactions aux messages

- **Clé sémantique en base, jamais l'emoji.** `REACTIONS = ["like", "love",
  "laugh", "wow", "sad", "party"]` dans `server/constants/reactions.js`. Un
  emoji est une donnée de présentation : une base pleine de « ❤️ » imposerait
  une migration le jour où le jeu est redessiné.
- **Icônes dessinées maison**, en aplats colorés (et non en traits comme les
  icônes d'interface) : une réaction est un tampon émotionnel lu à 14-16 px.
  `mobile/src/components/icons/ReactionIcon.tsx` et
  `front/src/components/UI/ReactionIcon.jsx` doivent rester identiques au tracé
  près.
- `REACTION_PUSH_GLYPH` (serveur) est la **seule** exception : une push est du
  texte affiché par l'OS, on ne peut pas y mettre de SVG.
- **Les réactions ne sont pas chiffrées** (arbitrage assumé).
- Bascule côté serveur : renvoyer la réaction déjà posée la retire ; `null`
  retire explicitement.
- Notification : seul l'auteur, jamais soi-même, jamais au retrait, dédoublonnée
  par `data.messageId`. Tag de push `reaction-<messageId>` — distinct du tag de
  la conversation, sinon une réaction remplacerait sur l'écran verrouillé la
  notification d'un message non lu.

---

## 11. Notes iOS / Expo

- **NSE (Notification Service Extension)** : `NotificationService.swift`
  déchiffre les messages E2E sur l'appareil. La clé privée est lue dans le
  Keychain d'expo-secure-store, dont le format est piégeux :
  `kSecAttrService` = `"app:no-auth"` (suffixe issu de `requireAuthentication`)
  et `kSecAttrAccount` = **`Data(key.utf8)`, une Data brute et non une String**.
  Une requête mal formée échoue en silence → « 🔒 Nouveau message chiffré ».
- **`withFmtConstevalFix`** doit figurer **en dernier** dans `plugins` de
  `app.json`, et un `npx expo prebuild --clean` est nécessaire pour qu'il prenne
  effet. Ce prebuild peut écraser `buildNumber` : revérifier après.
- Routage des push : `mobile/src/lib/push.ts` mappe l'`url` du payload vers une
  route expo-router. `/event/<id>?tab=chat` → `/event/chat/<id>`,
  `?tab=chat&conversationId=` → `/chat-open`.

---

## 12. Scripts de diagnostic (`server/scripts/`)

| Script | Usage |
|--------|-------|
| `check-connect-liability.js` | Type de compte + qui porte les pertes |
| `verify-connect-config.js` | Documente le refus Stripe sur Express + pertes |
| `reset-connect-account.js` | Supprime/réinitialise un compte (`--payout`, `--local-only`) |
| `diagnose-payouts.js` | État des virements d'un `acct_…` |
| `check-last-contributions.js` | Dernières contributions + présence de `feeCents` |
| `diagnose-push-duplicates.js` | Doublons de tokens push |

⚠️ **Leçon apprise** : `check-last-contributions.js` a longtemps affiché un
verdict ✅ alors que chaque contribution montrait `frais=❌ ABSENT` — il ne
comptait que les `succeeded` et ignorait les `refunded`. Un script de
vérification qui valide un échec est pire que pas de script. Toute modification
d'un script de diagnostic doit être testée sur un cas connu comme mauvais.

---

## 13. Décisions d'architecture

### Stripe Connect — charges directes, comptes Standard

**Charges directes** : `stripeAccount` passé en 2ᵉ argument des appels Stripe.
Le paiement s'effectue sur le compte de l'organisateur, qui est le marchand.
BirthReminder n'est jamais dans le flux d'argent.

**Standard et non Express** — arbitrage vérifié en production le 14/09/2026 :
Stripe refuse `stripe_dashboard[type]=express` dès lors que la plateforme ne
collecte pas les frais et ne prend pas en charge les soldes négatifs. Les deux
ne se dissocient pas. En Standard, `controller.losses.payments = "stripe"` :
c'est Stripe qui porte les pertes irrécouvrables. Le message d'erreur exact est
recopié en commentaire dans `stripe.connect.js` — ne pas retenter Express.

Conséquences :
- L'organisateur a un tableau de bord Stripe complet.
- `createLoginLink` est **réservé à Express** → le bouton renvoie vers
  `dashboard.stripe.com`.
- Un compte Express existant ne se convertit pas : déconnexion + réinscription.
- `accounts.del` fonctionne toujours en test, **jamais** sur un compte Standard
  en live.
- `business_profile` est pré-rempli à la création (mcc `5947`, description de
  collecte entre particuliers) pour raccourcir l'onboarding. `business_profile.url`
  doit être `PUBLIC_SITE_URL`, jamais localhost.

**Type de charge ≠ type de compte** : le passage Express → Standard ne change
rien pour le participant, qui paie toujours dans l'application.

### Webhook Stripe
- Monté avec `express.raw({ type: "application/json" })` **AVANT**
  `express.json()` dans `app.js`. Ordre critique : la signature est vérifiée sur
  le corps brut.
- Local : `stripe listen --forward-to localhost:4000/api/stripe/webhook
  --forward-connect-to localhost:4000/api/stripe/webhook`.
- Handlers idempotents → les retries Stripe sont sans risque.
- **Le webhook est la seule source de vérité du paiement**, jamais le front.
- ⚠️ La lecture des frais réels retombe sur le `StripeAccount` de l'organisateur
  quand `event.account` est absent — sans ce repli, la lecture se faisait sur le
  compte plateforme où la charge n'existe pas, le reçu partait quand même, et
  `feeCents` restait vide **en silence**.

### Doctrine litige — « on relaie, l'organisateur rembourse »
BirthReminder est greffier et huissier, jamais juge. L'escalade est :
organisateur → support BirthReminder (relais) → conciliateur de justice →
banque → THESEE. La chaîne de preuves est le reçu email + l'historique in-app
+ le dossier de preuves téléchargeable côté admin. Le registre de revue des
alertes (`poolAlertReview`) matérialise la diligence exigée par le DSA.

Repères juridiques retenus : art. 750-1 CPC / décret 2023-357 (conciliation
préalable obligatoire sous 5 000 €), injonction de payer exemptée (Cass.
25 sept. 2025), THESEE pour l'e-escroquerie (paiement volontaire) contre
PERCEVAL (usage frauduleux de carte), micro-entreprise exemptée des art. 15 et
20-23 et 30-32 du DSA mais jamais des art. 11-14 et 16-17.

### Chiffrement
- **E2E du chat** : NaCl box (X25519 + XSalsa20-Poly1305), tweetnacl côté JS,
  swift-sodium dans la NSE. Chiffre pour des destinataires précis.
- **RIB au repos** : AES-256-GCM symétrique (`utils/bankCrypto.js`), le serveur
  doit pouvoir déchiffrer pour afficher. L'`authTag` fait échouer le
  déchiffrement si la donnée est altérée : on ne renvoie jamais un IBAN douteux.
- Les deux sont distincts et ne doivent pas être confondus.

---

## 14. Ce qui reste à faire

### Vérifications en attente
- [ ] **`feeCents` se remplit-il enfin ?** Le repli du webhook a été écrit mais
      jamais validé. Faire un paiement de 1 €, chercher
      `[stripe.webhook] frais réels N centimes enregistrés`, puis
      `node scripts/check-last-contributions.js`.
- [ ] `check-connect-liability.js` voyait 2 comptes Express là où
      `diagnose-payouts.js` en trouvait un troisième (`acct_1UFbtp3M8ANcH8o0`).
      Incohérence jamais expliquée.

### Avant le prochain build mobile
- [ ] `withFmtConstevalFix` en dernier dans `plugins`, puis
      `npx expo prebuild --clean`, puis **revérifier `buildNumber`**
- [ ] Aligner `app.json` → `"version"` sur la numérotation du changelog (§0)
- [ ] Recoller `TESTFLIGHT_NOTES.md` dans App Store Connect

### Court terme
- [ ] Interrupteur dédié aux notifications de réaction (`pushEvents.reactions`
      + `type: "reactions"` dans `pushService` + case dans les préférences web
      et mobile). Aujourd'hui les couper impose de couper aussi les messages —
      WhatsApp a un réglage séparé, et il a raison.
- [ ] Clause de créance dans les CGU (l'organisateur rembourse BirthReminder des
      sommes que Stripe débiterait) — rédigée, jamais appliquée
- [ ] Restreindre la clé Google Maps par référent HTTP dans Google Cloud Console
- [ ] Supprimer `_to_delete/` à la racine (le shell distant ne peut pas
      supprimer de fichiers, il ne peut que les déplacer)
- [ ] Réponse depuis la notification push (nécessite d'abord un endpoint REST
      d'envoi — aujourd'hui l'envoi passe uniquement par Socket.io)

### Moyen terme
- [ ] Chantier Android (`ANDROID_APPLINKS_TODO.md`) ; ⚠️ `versionCode 1` est
      encore en dur dans `android/app/build.gradle`
- [ ] SEO / prerendering
- [ ] Récurrence des événements
- [ ] Mode hors-ligne (PWA + service worker) côté web

---

## 15. Points de vigilance

### Données
- `imposedGifts` est un **array**, jamais un objet
- `forDate` (ref Date manuelle) ≠ `forPerson` (ref User inscrit)
- Ne jamais modifier les schémas `User`, `Friend`, `Date` existants — seulement
  ajouter des refs
- Ne jamais modifier un template email existant — seulement en ajouter
- Tout nouveau type de notification : enum de `notification.model.js` **et**
  `notify.js` si push, **et** `NotificationItem.jsx` (web) **et**
  `lib/notifications.ts` (mobile), sinon il s'affiche « Nouvelle notification »

### Infrastructure
- Ne jamais toucher la config Nginx / PM2 / CORS existante
- `express.raw()` **avant** `express.json()` pour le webhook Stripe
- Le RIB ne doit **jamais** apparaître dans la réponse en accès partiel de
  `GET /:shortId` — uniquement via sa route dédiée protégée
- `BANK_ENCRYPTION_KEY` ne change jamais une fois des IBAN chiffrés

### Frontend
- `react-leaflet@4` uniquement (v5 incompatible React 18)
- La variable de couleur est `--primary`, pas `--primary-color`
- ⚠️ **`window.open` après un `await` est bloqué** par le navigateur : le
  contexte de geste utilisateur est perdu, et le blocage est silencieux. Ouvrir
  l'onglet de façon synchrone puis lui affecter `location.href`.
- Les profils n'ont pas de route dédiée — deep links via
  `/home?tab=date&dateId=…`

### Messages d'erreur
Deux fois de suite (onboarding Stripe, puis tableau de bord), un message
générique a masqué la cause réelle et coûté une session de diagnostic. Les
réponses d'erreur portent désormais un `detail`, que `front/apiHandler` **et**
`mobile/src/lib/api.ts` doivent propager. Distinguer aussi les états normaux
(`ONBOARDING_INCOMPLETE`) des vrais échecs.

### Parité web / mobile
Toute fonctionnalité de chat, de cagnotte ou de notification doit être portée
sur les deux surfaces dans la même passe. Une réaction posée sur téléphone et
invisible dans le navigateur est un bug, pas une fonctionnalité partielle.

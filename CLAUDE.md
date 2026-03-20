# BirthReminder — CLAUDE.md
## Feature : Système d'Événements

---

## 🧠 Contexte du projet

BirthReminder est une application web full-stack de gestion d'anniversaires et d'événements entre amis.

**Stack technique :**
- **Frontend** : React (SPA)
- **Backend** : Node.js + Express
- **Base de données** : MongoDB (Mongoose)
- **Temps réel** : Socket.io (chat entre amis déjà opérationnel)
- **Emails** : AWS SES (rappels, notifications déjà en place)
- **Déploiement** : AWS EC2 (prod sur birthreminder.com + dev sur localhost)
- **Auth** : Sessions existantes (utilisateurs connectés)

**Avant de commencer :**
1. Scanne l'intégralité du codebase existant
2. Identifie les schémas Mongoose existants (User, Friend, Birthday, Chat, Message, NamedayPreferences, etc.)
3. Identifie les routes Express existantes et leur structure
4. Identifie les composants React existants, notamment les cartes de contacts/anniversaires
5. Identifie la configuration Socket.io existante (éviter les stale closures — voir pattern déjà utilisé)
6. Respecte les conventions de nommage, structure de fichiers et patterns déjà en place
7. Respecte le système de dark/light mode existant (CSS variables déjà configurées sur 28+ fichiers)

---

## 🎯 Objectif

Implémenter un système d'événements complet intégré à l'existant, accessible depuis les cartes de contacts et via des pages dédiées avec URL courte.

---

## 📁 Architecture cible

### Nouveaux schémas Mongoose à créer

#### `Event`
```js
{
  _id: ObjectId,
  shortId: String, // ex: "xK9mZ" — généré avec nanoid (5 chars)
  title: String,
  description: String,
  type: String, // 'birthday', 'party', 'dinner', 'other'
  organizer: { type: ObjectId, ref: 'User' },
  forPerson: { type: ObjectId, ref: 'User', default: null }, // personne concernée (pré-rempli depuis carte)
  recurrence: {
    enabled: Boolean,
    frequency: String, // 'yearly', 'custom'
    nextOccurrence: Date
  },

  // Dates
  dateMode: String, // 'fixed' | 'vote'
  fixedDate: Date,
  dateOptions: [Date], // si dateMode === 'vote'
  selectedDate: Date, // date retenue après vote

  // Lieux
  locationMode: String, // 'fixed' | 'vote'
  fixedLocation: {
    name: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  locationOptions: [{ name: String, address: String, coordinates: { lat: Number, lng: Number } }],
  selectedLocation: Object,

  // Cadeaux
  giftMode: String, // 'imposed' | 'proposals'
  imposedGift: { name: String, url: String, price: Number },
  // [CAGNOTTE — placeholder, à intégrer ultérieurement]
  // giftPoolEnabled: Boolean,
  // giftPool: { type: ObjectId, ref: 'GiftPool' }

  // Invitations
  maxGuests: Number, // null = illimité
  accessCode: String, // code 6 chars pour rejoindre sans compte
  allowExternalGuests: Boolean,

  // Rappels
  reminders: [{
    type: String, // 'event_date', 'pool_deadline'
    daysBeforeEvent: Number,
    sent: Boolean
  }],

  status: String, // 'draft' | 'published' | 'cancelled' | 'done'
  createdAt: Date,
  updatedAt: Date
}
```

#### `EventInvitation`
```js
{
  _id: ObjectId,
  event: { type: ObjectId, ref: 'Event' },
  user: { type: ObjectId, ref: 'User', default: null }, // null si invité externe
  externalEmail: String, // si non inscrit
  guestName: String, // si non inscrit
  status: String, // 'pending' | 'accepted' | 'declined' | 'maybe'
  dateVote: [Date], // votes sur les dates proposées
  locationVote: ObjectId, // vote sur le lieu
  joinedViaCode: Boolean,
  createdAt: Date
}
```

#### `EventGiftProposal`
```js
{
  _id: ObjectId,
  event: { type: ObjectId, ref: 'Event' },
  proposedBy: { type: ObjectId, ref: 'User' },
  name: String,
  url: String,
  price: Number,
  votes: [{ type: ObjectId, ref: 'User' }],
  createdAt: Date
}
```

#### `EventMessage` (chat dédié événement)
```js
{
  _id: ObjectId,
  event: { type: ObjectId, ref: 'Event' },
  sender: { type: ObjectId, ref: 'User' },
  content: String,
  readBy: [{ type: ObjectId, ref: 'User' }],
  createdAt: Date
}
```

---

### Nouvelles routes Express à créer

**Préfixe : `/api/events`**

```
POST   /api/events                          → créer un événement
GET    /api/events/:shortId                 → récupérer un événement (public)
PUT    /api/events/:shortId                 → modifier un événement (organizer only)
DELETE /api/events/:shortId                 → annuler un événement (organizer only)

GET    /api/events/mine                     → mes événements (organisateur ou invité)

POST   /api/events/:shortId/invite          → inviter des utilisateurs inscrits
POST   /api/events/:shortId/join            → rejoindre via code (invité externe ou inscrit)
PUT    /api/events/:shortId/rsvp            → répondre à l'invitation (présent/absent/maybe)

POST   /api/events/:shortId/vote/date       → voter pour une date
POST   /api/events/:shortId/vote/location   → voter pour un lieu

POST   /api/events/:shortId/gifts           → proposer un cadeau
POST   /api/events/:shortId/gifts/:giftId/vote → voter pour un cadeau proposé

GET    /api/events/:shortId/messages        → récupérer messages du chat événement
POST   /api/events/:shortId/messages        → envoyer un message (via HTTP fallback)

GET    /api/events/:shortId/share           → générer/retourner le lien de partage + code
```

---

### Nouvelles pages React à créer

#### `/event/:shortId` — Page publique de l'événement
- Accessible sans compte (lecture seule pour non-invités)
- Affiche : titre, date, lieu, organisateur, description
- Bouton "Rejoindre avec un code" pour les externes
- Si invité connecté : affiche RSVP, vote dates/lieux, proposals cadeaux, chat
- Responsive : Map sur desktop, vue liste sur mobile

#### `/events/new` — Création d'événement
- Formulaire multi-étapes (stepper)
- Étape 1 : Infos générales (titre, type, description, récurrence)
- Étape 2 : Date (mode fixe ou vote avec plusieurs options)
- Étape 3 : Lieu (mode fixe avec Maps ou vote avec plusieurs options)
- Étape 4 : Cadeaux (imposé ou propositions libres)
- Étape 5 : Invitations (amis BirthReminder + options externes)
- Étape 6 : Rappels et options avancées
- Placeholder visuel pour la cagnotte (section grisée "Bientôt disponible")

#### `/events/mine` — Mes événements
- Liste des événements organisés + auxquels je suis invité
- Filtres : à venir / passés / en attente de réponse

---

### Composants React à créer/modifier

#### Modifier (existants)

**1. Barre de navigation principale (page Home "Vos BirthDates")**

La barre contient actuellement 4 boutons dans cet ordre :
```
[ Filtre ] [ Agenda ] [ Chat ] [ Ajouter une date ]
```
Insérer le bouton Événements **entre Chat et Ajouter une date** :
```
[ Filtre ] [ Agenda ] [ Chat ] [ 🎉 Événements ] [ Ajouter une date ]
```
- Le bouton "🎉 Événements" remplace l'affichage des cartes BirthDates par le panel EventsPanel
- Même style visuel que les boutons existants (respecter classes CSS / variables dark/light mode)
- Comportement : toggle — cliquer à nouveau sur "Événements" revient aux cartes

**2. Cartes BirthDates (composant carte individuelle)**

Chaque carte affiche actuellement deux boutons en bas :
```
[ Modifier ]  [ Voir Profil ]
```
**Remplacer le bouton "Modifier" par "🎉 Événement"** :
```
[ 🎉 Événement ]  [ Voir Profil ]
```
- ⚠️ Ne pas supprimer la logique de modification — la déplacer directement dans la carte (inline edit ou via un autre pattern existant dans le codebase)
- Le bouton "🎉 Événement" redirige vers `/events/new?forPerson=userId` avec pré-remplissage du nom et de la date d'anniversaire de la personne concernée
- Même style que le bouton "Modifier" actuel

**3. EventsPanel — nouveau composant (remplace les cartes quand actif)**

Affiché à la place de la liste de cartes BirthDates quand l'onglet "Événements" est actif. Contient :
- **En-tête** avec titre "Mes Événements" + bouton "**+ Créer un événement**" (ouvre `/events/new` sans pré-remplissage)
- **Calendrier/timeline** affichant toutes les dates BirthReminder de l'utilisateur en contexte (anniversaires existants + événements créés) — vue agréable pour choisir une date lors de la création
- **Liste des événements** : organisés par l'utilisateur + auxquels il est invité
- Filtres rapides : "À venir" / "En attente de réponse" / "Passés"
- Chaque événement listé avec `EventCard` (titre, date, nb participants, statut RSVP)

#### Créer (nouveaux)
- `EventCard` — carte résumé d'un événement (pour listes)
- `EventPage` — page complète de l'événement
- `EventForm` — formulaire multi-étapes de création
- `EventChat` — chat Socket.io dédié à l'événement (réutiliser pattern existant, attention aux stale closures)
- `RSVPButton` — bouton présent/absent/maybe avec dropdown
- `DateVotePanel` — affichage et vote sur les dates proposées
- `LocationVotePanel` — affichage et vote sur les lieux (Maps desktop / liste mobile)
- `GiftProposalPanel` — propositions + votes cadeaux
- `InviteModal` — inviter des amis + générer lien/code
- `JoinEventModal` — rejoindre via code (pour invités externes)
- `EventReminderSettings` — configuration des rappels

---

## 🔌 Socket.io — Intégration événements

Ajouter les rooms et events suivants au serveur Socket.io existant :

```js
// Rejoindre la room d'un événement
socket.join(`event:${shortId}`)

// Nouveaux événements Socket.io
'event:message'        → nouveau message dans le chat événement
'event:rsvp_update'    → quelqu'un a répondu à l'invitation
'event:vote_update'    → un vote date/lieu a été mis à jour
'event:gift_proposal'  → nouvelle proposition de cadeau
'event:guest_joined'   → un invité a rejoint l'événement
```

⚠️ **Important** : respecter le pattern de gestion des callbacks Socket.io déjà en place dans le codebase pour éviter les stale closures (scanner le chat existant avant d'implémenter).

---

## 📧 AWS SES — Rappels événements

Ajouter les templates d'emails suivants (respecter le style des emails existants) :

- **Invitation reçue** : "Tu es invité(e) à [titre événement]"
- **Rappel J-7** : "L'événement [titre] approche !"
- **Rappel J-1** : "C'est demain : [titre événement]"
- **Vote date/lieu** : "L'organisateur a besoin de ton vote"
- **Date retenue** : "La date de [titre] est confirmée : [date]"

Ajouter un job cron (ou utiliser le système existant) pour envoyer les rappels automatiques.

---

## 🗺️ Maps & Localisation

- **Desktop** : Google Maps embed ou Leaflet.js (vérifier ce qui est déjà installé)
- **Mobile** : vue liste avec adresse + lien "Ouvrir dans Maps"
- Détection device : utiliser `window.innerWidth` ou media query existante

---

## 💳 Cagnotte — PLACEHOLDER UNIQUEMENT

> ⚠️ Ne pas implémenter la cagnotte maintenant. Prévoir uniquement :
> - Un champ `giftPoolEnabled: false` dans le schéma Event (par défaut désactivé)
> - Une section visuellement présente dans l'EventPage et l'EventForm, grisée, avec le texte "Cagnotte — Bientôt disponible"
> - La structure de données est commentée dans le schéma pour intégration future (Stripe / Wero / IBAN)

---

## 🔗 URLs & Partage

- Chaque événement a un `shortId` de 5 caractères généré avec **nanoid**
- URL publique : `birthreminder.com/event/:shortId`
- Code d'accès : 6 caractères alphanumériques pour rejoindre sans lien direct
- L'API `/api/events/:shortId/share` retourne : `{ url, code }`

---

## ✅ Checklist d'implémentation suggérée

1. [ ] Schémas Mongoose (Event, EventInvitation, EventGiftProposal, EventMessage)
2. [ ] Routes Express CRUD événements
3. [ ] Routes invitations + RSVP
4. [ ] Routes votes (dates, lieux, cadeaux)
5. [ ] Routes chat événement (HTTP + Socket.io)
6. [ ] Routes partage (lien + code)
7. [ ] Cron AWS SES rappels
8. [ ] Composant EventForm (multi-étapes)
9. [ ] Page /event/:shortId
10. [ ] Page /events/mine
11. [ ] Bouton sur ContactCard existante
12. [ ] EventChat (Socket.io)
13. [ ] Maps intégration (desktop/mobile)
14. [ ] Tests end-to-end sur les flows principaux

---

## 🚫 Ne pas toucher

- Le système de chat entre amis existant (ne pas modifier, seulement s'en inspirer)
- Les schémas User, Friend, Birthday existants (seulement ajouter des refs si nécessaire)
- La configuration Nginx / PM2 / CORS existante
- Les fichiers CSS dark/light mode (utiliser les variables CSS existantes)
- AWS SES configuration existante (ajouter des templates, ne pas modifier l'existant)

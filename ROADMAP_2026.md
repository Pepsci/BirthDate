# BirthReminder — État du projet & Roadmap monétisation
*Mis à jour : 4 juillet 2026*

---

## 1. État actuel

### ✅ Fait (et qui reste 100 % gratuit)

**App mobile React Native (Expo SDK 54, TypeScript, Expo Router)** — parité quasi totale avec le web :

- Auth complète : login, inscription, mot de passe oublié, JWT Bearer + chiffrement E2E (clé déchiffrée au login, stockée en Keychain/Keystore)
- Anniversaires : liste en grille 2 colonnes avec countdown, recherche par préfixe, filtres Amis/Famille, CRUD complet, fiches détaillées (idées cadeaux avec récupération d'infos par lien + lien affilié Amazon auto, wishlist de l'ami avec réservation, rappels configurables J-1/3/7/14/30 + fêtes)
- Événements : création (stepper 5 étapes, autocomplete lieux avec POI via Photon, coordonnées GPS), édition, suppression, RSVP, votes date/lieu, cadeaux imposés/propositions, partage lien+code, rejoindre par code, itinéraire GPS (Plans/Google Maps/Waze détectés), **cagnotte Stripe complète** (PaymentSheet natif, config organisateur, onboarding Stripe Connect in-app)
- Chats : DM et chats d'événements, E2E, temps réel Socket.io, onglet dédié avec aperçus, badges de non-lus partout
- Amis : demandes, invitations externes, gestion complète
- Agenda : vues mois + semaine, pastilles, bottom sheet par jour
- Profil : édition + avatar Cloudinary, wishlist perso, préférences email ET push par catégorie, changement de mdp (avec ré-encryption E2E), suppression de compte
- Centre de notifications : cloche + badge temps réel, 13 types, navigation au tap
- **Push natif fonctionnel** (Expo Push → FCM, testé app fermée) — le backend envoie automatiquement sur les 22 déclencheurs existants
- Builds EAS : dev + preview (autonome, branché prod)

**Backend (déployé EC2)** : routes expo-token, service Expo Push, CORS socket mobile, fixes cadeaux (url/prix/image), champ image sur les propositions.

### 🔜 Reste à faire (court terme)
- [x] Dark theme + switch (ThemeContext) ✅
- [x] Polish : titre retour "(tabs)" ✅, icône/splash BirthReminder ✅ (build 14)
- [x] Compte Apple Developer + build iOS production ✅ (juillet 2026)
- [x] TestFlight : groupe externe en beta review, build 13 soumis (fix notifs : cold start figé + deep links) ✅
- [x] NSE iOS (notifs déchiffrées app tuée) ✅ — voir mobile/docs/NOTIF_LISIBLES.md
- [x] Contrôle d'âge 15 ans (mobile + serveur) + onboarding guidé (tours spotlight) ✅
- [ ] Build 14 : icône + splash au logo BirthReminder (générés, dans le prochain build)
- [ ] Redéployer le backend EC2 (contrôle d'âge serveur + deep links notifs)
- [ ] Fiche App Store : screenshots, description, compte démo, note review (cagnotte Stripe + E2E)
- [ ] Google Play : closed testing 12 testeurs / 14 jours (incompressible — lancer tôt)

---

## 2. 💡 IA Cadeaux — la feature monétisable

### Concept
Un assistant qui propose des idées de cadeaux personnalisées pour une personne donnée, avec liens d'achat affiliés. Double revenu : **abonnement premium** (recherches illimitées) + **commissions d'affiliation** sur chaque achat.

### Données déjà disponibles (gros avantage)
L'app connaît déjà : âge, relation (ami/famille), fête, historique des cadeaux offerts (avec occasion et année), wishlist de la personne si inscrite, budget des événements. Personne d'autre n'a ce contexte.

### Architecture

```
Mobile/Web → POST /api/ai/gift-suggestions (auth + quota)
                    ↓
        Backend construit le contexte :
        { age, relation, occasion, budget,
          intérêts (nouveaux tags), cadeaux passés,
          wishlist, feedback précédents }
                    ↓
        API LLM (Claude API) — clé dans .env EC2
        → JSON structuré : [{ nom, description,
          fourchette prix, mots-clés recherche }]
                    ↓
        Enrichissement : mots-clés → liens affiliés
        (processUrl Amazon existant + Awin)
                    ↓
        Cache MongoDB (mêmes params = même réponse, maîtrise des coûts)
```

### Modifs backend
- Modèle `GiftSuggestion` : { user, forDate/forPerson, occasion, params, suggestions[], feedback[], createdAt }
- Champ `interests: [String]` sur Date (tags saisis sur la fiche : "gaming", "cuisine", "rando"…)
- Champs quota sur User : `aiSearchesThisMonth`, `aiQuotaResetAt`, `isPremium`
- Route avec rate-limit + vérification quota

### UI (mobile + web)
- Bouton **"💡 Idées cadeaux IA"** sur la fiche anniversaire et la page événement
- Mini-questionnaire : occasion, budget (slider), 2-3 centres d'intérêt (chips, mémorisés sur la fiche)
- Résultats en cartes : nom, pourquoi ça matche, prix estimé, bouton "Voir sur Amazon" (affilié), bouton "＋ Ajouter à mes idées", feedback 👍/👎 (améliore les prompts)

### Phases
1. **MVP (1-2 sem.)** : route + prompt + UI simple, liens de *recherche* affiliés (pas de produits exacts), quota 3 recherches/mois gratuit
2. **V2** : tags d'intérêts sur les fiches, cache, feedback loop, historique des suggestions, exclusion des cadeaux déjà offerts
3. **V3** : produits réels avec prix live (Amazon PA-API — nécessite 3 ventes affiliées/180j, ou scraping léger type fetch-url existant)

### Coûts
~1-3 centimes par recherche (LLM) avec cache. Le quota gratuit coûte quasi rien ; le premium est margé à >90 %.

---

## 3. 💰 Monétisation globale (l'existant reste gratuit)

### BirthReminder+ (abonnement, ~2,99 €/mois ou 24,99 €/an)
- Recherches IA illimitées (le moteur ci-dessus)
- Thèmes premium (dark + couleurs personnalisées — le chantier dark theme devient un produit)
- Photos d'événements en qualité originale + stockage étendu (voir §4)
- Statistiques cadeaux (budget annuel par personne, historique)
- Badge de soutien 💛

> ⚠️ **Contrainte stores** : Apple et Google imposent le paiement in-app pour les biens numériques (commission 15-30 %). Utiliser **RevenueCat** (gère IAP iOS + Android + Stripe web d'un coup). La cagnotte et l'affiliation n'y sont PAS soumises (biens physiques / services réels).

### Revenus sans abonnement
- **Affiliation** (déjà en place pour Amazon, Awin côté web) : l'IA cadeaux multiplie mécaniquement les clics sortants — c'est le levier le plus naturel
- **Commission cagnotte** : le code backend a déjà `application_fee_amount` commenté — activer 1-2 % ou 0,50 € fixe par contribution, affiché de façon transparente ("frais de service"). Nécessite le statut micro-entreprise (déjà prévu dans tes notes)
- Plus tard : impression photo / carte de vœux via partenaire print (commission), offre B2B "anniversaires d'équipe" pour les RH

---

## 4. 📸 Partage de photos

### Concept
Chaque événement a un **album partagé** : les participants (invités externes inclus) uploadent leurs photos pendant et après l'événement. C'est LA feature de rétention post-événement — et la limite de stockage est un argument premium naturel.

### Architecture
- **Stockage : Cloudinary déjà configuré** (multer-storage-cloudinary utilisé pour les avatars) — démarrer avec, surveiller le quota gratuit (25 Go) ; migrer vers S3 si volume (AWS déjà en place)
- Modèle `EventPhoto` : { event, uploadedBy (User ou guestName), url, thumbnailUrl, width/height, likes[], createdAt }
- Routes : `POST /events/:shortId/photos` (multipart, middleware checkGuestOrAuth existant), `GET` liste paginée, `DELETE` (auteur ou organisateur), `POST /:photoId/like` (toggle)
- Notification "📸 X a ajouté des photos" via le `notify()` existant (→ push automatique)

### Mobile
- Onglet **Photos** sur la page événement : grille 3 colonnes, viewer plein écran (swipe), like, téléchargement
- Upload : `expo-image-picker` (déjà installé) multi-sélection + prise de photo directe, compression avant envoi (0.7), upload avec barre de progression

### Limites (et lien premium)
- Gratuit : ~30 photos/événement, compressées
- Premium : illimité + qualité originale + export album zip

### Phases
1. **MVP** : upload + grille + suppression (backend 1 j, mobile 1-2 j)
2. **V2** : viewer plein écran, likes, notifications, section web
3. **V3** : album souvenir auto envoyé par email J+1 ("revivez la soirée 🎉")

---

## 5. Ordre de bataille suggéré

| # | Chantier | Pourquoi dans cet ordre |
|---|----------|-------------------------|
| 1 | Rebuild preview + tests multi-appareils | Stabiliser l'existant |
| 2 | Photos d'événements (MVP) | Gratuit, fait vivre l'app, crée le besoin premium |
| 3 | Dark theme | Demandé, et devient un perk premium (thèmes) |
| 4 | IA cadeaux MVP + quota | Le cœur monétisable, revenus affiliation immédiats |
| 5 | Compte Apple + build iOS + closed testing Google | Lancer les délais stores en parallèle |
| 6 | RevenueCat + abonnement BirthReminder+ | Une fois qu'il y a 2-3 perks réels à vendre |
| 7 | Commission cagnotte (après micro-entreprise) | Activer `application_fee_amount` |

---

*Contexte technique complet (pièges, décisions, chemins) : conservé dans la mémoire de session Claude — reprendre une conversation dans le projet Birthreminder pour continuer.*

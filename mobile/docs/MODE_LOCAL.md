# Mode local (sans compte) — cahier des charges

*Rédigé le 21 septembre 2026. À lire en entier avant de coder.*
*Périmètre : app mobile uniquement (`mobile/`, Expo SDK 54 + expo-router).*

> **Pour la conversation qui reprend ce chantier** : commence par lire
> `CLAUDE.md` (racine du repo), en particulier la section
> « Mobile — cache hors ligne », puis ce document. Joss veut la logique
> expliquée avant le code, des étapes courtes, et aucun style inline
> (tout dans `StyleSheet` / le thème).

---

## 1. Pourquoi

Proposer BirthReminder **sans créer de compte** : tout reste sur le
téléphone, rien n'est envoyé au serveur.

Deux publics, un seul produit :

1. **Les moins de 15 ans.** L'inscription est refusée avant 15 ans (pas de
   consentement parental géré, décision prise). Sans donnée chez nous, il
   n'y a pas de traitement au sens du RGPD (art. 8) ni de la loi
   Informatique et Libertés (art. 45) : pas de consentement parental à
   obtenir ni à vérifier. Un adulte qui « se cache » dans ce mode ne pose
   aucun problème, il se prive juste de fonctionnalités.
2. **Les personnes qui ne veulent pas confier leurs données**, mais sont
   intéressées par le concept (rappels d'anniversaires, idées de cadeaux).

C'est aussi une **porte d'entrée** : on peut créer un compte plus tard et y
importer ses cartes.

---

## 2. Ce que fait le mode local

### Disponible

| Fonction | Comment |
|---|---|
| Cartes d'anniversaire (création, modification, suppression, famille, photo) | Stockage sur le téléphone |
| Fêtes (nameday) détectées automatiquement depuis le prénom | Copie locale du dictionnaire (voir § 5.3) |
| Accueil, recherche, filtres, compte à rebours, agenda | Mêmes écrans, données locales |
| Idées de cadeaux par personne | Stockées dans la carte, comme en ligne |
| Sa propre liste d'envies | Stockage local |
| Rappels (veille, semaine avant, jour J, fêtes) | **Notifications locales** programmées sur le téléphone (voir § 5.4) |
| Ajout à l'agenda du téléphone | `lib/calendar.ts` (expo-calendar), déjà présent |
| Partager sa liste d'envies | Feuille de partage native (texte), pas de lien public |
| Sauvegarde / restauration | Export et import d'un fichier JSON |
| Thème, réglages d'affichage | Déjà locaux |

### Indisponible (par nature : il faut un serveur pour relier des personnes)

Chat, amis, événements, listes communes, cagnottes, wishlist publique ou
par code, réservation de cadeaux, accès depuis le site web,
synchronisation entre plusieurs appareils, notifications push serveur,
emails.

Dans l'interface : les onglets **Événements** et **Chats** sont masqués,
et chaque entrée de menu d'une fonction en ligne est soit masquée, soit
remplacée par « Crée un compte pour… ».

---

## 3. Parcours utilisateur

### 3.1 Premier lancement

Écran de choix (évolution de `app/welcome.tsx` ou écran dédié) :

- **Créer un compte** : parcours actuel (inscription dès 15 ans).
- **Utiliser sans compte** : court texte explicatif (« Tes données restent
  sur ce téléphone. Pas de chat, d'amis ni d'événements. Pense à faire des
  sauvegardes. »), puis accès direct à l'accueil.
- Lien discret **« J'ai déjà un compte »** : connexion.

Pas de question d'âge dans ce parcours : le mode local convient à tout le
monde, il n'y a rien à vérifier.

### 3.1 bis Points d'entrée vers le mode local (décidé le 22/09/26)

Quatre accès, du plus visible au plus discret :

1. **Accueil** (`welcome.tsx`), tant que `mode === null` : « Créer un
   compte » / « Utiliser sans compte » (même poids), lien « J'ai déjà un
   compte ».
2. **Inscription, moins de 15 ans** (`components/auth/SignupPanel.tsx`) :
   - la **date de naissance devient le premier champ** du formulaire ;
   - retirer `maximumDate={maxBirthDate}` du sélecteur : aujourd'hui il
     empêche de choisir une date de moins de 15 ans, le jeune reste bloqué
     sans explication ;
   - dès qu'une date < 15 ans est choisie : les autres champs disparaissent,
     court message (« Tes cartes restent sur ton téléphone »), et le bouton
     « Créer mon compte » devient **« Utiliser sans compte »** ;
   - aucune donnée envoyée ; le contrôle serveur (`routes/auth.js`) reste.
3. **Inscription, pour tous** : lien discret « Continuer sans compte » en
   bas du formulaire.
4. **Connexion** (`LoginPanel.tsx`) : lien discret « Continuer sans
   compte », à la place du lien de test « 🧪 Test mode local (dev) ».

Pas d'accès depuis le profil d'un compte connecté (voir § 7).

### 3.2 Pendant l'utilisation

- Un petit indicateur « 📱 Sur ce téléphone » dans l'en-tête ou le profil,
  pour qu'on sache toujours dans quel mode on est.
- Le **Profil** devient : Mes données (export/import), Rappels, Thème,
  « Créer un compte », « Effacer toutes mes données ».
- Rappel de sauvegarde : si aucun export depuis 30 jours et au moins
  10 cartes, bandeau discret « Pense à sauvegarder tes cartes ».

### 3.3 Passer à un compte

« Créer un compte » (depuis le profil ou une fonction verrouillée) :

1. Inscription ou connexion normale.
2. « Importer tes N cartes locales dans ce compte ? » : oui, on envoie
   chaque carte au serveur (idées de cadeaux incluses), puis la liste
   d'envies.
3. Une fois l'import **confirmé** par le serveur, les données locales sont
   effacées et l'app passe en mode connecté.
4. En cas d'échec partiel : on n'efface rien, et on indique ce qui n'est
   pas passé. Relancer l'import ne doit pas créer de doublons (marquer
   chaque carte importée avec son nouvel id serveur).

5. **Photos de carte** (décidé le 22/09/26 : gardées en mode local) :
   chaque photo de `local-data/photos/` est envoyée avec `updateDatePhoto`
   sur la carte serveur créée. Une carte ne compte comme importée qu'une
   fois sa photo passée ; on n'efface les photos locales qu'après.
   ⚠️ En local, la carte stocke le NOM du fichier (`photoFile`), pas le
   chemin : le dossier Documents d'iOS change de chemin à chaque mise à jour.

Cas de l'inscription refusée (moins de 15 ans) : message clair, l'app
reste en mode local, rien n'est perdu.

### 3.4 Quitter le mode local

« Effacer toutes mes données » : double confirmation, puis retour à
l'écran de choix. Irréversible (proposer l'export juste avant).

---

## 4. Ce qui existe déjà et qu'on réutilise

Tout est dans `mobile/src/` :

| Existant | Rôle | Réutilisation |
|---|---|---|
| `lib/offline-cache.ts` | Fichiers JSON dans `documentDirectory/offline-cache/`, par utilisateur | **Ne pas réutiliser pour les données locales** : c'est un cache jetable, vidé au `signOut()` (voir § 5.1) |
| `lib/offline-queue.ts` | File des modifications de dates faites hors ligne | Non concerné (le mode local n'envoie rien) ; inspiration pour la fusion des opérations |
| `lib/dates.ts` | `fetchDates`, `fetchDate`, `createDate`, `updateDate`, `deleteDate`, `setDateFamily`, `addGift`, `updateGift`, `deleteGift`, photo, préférences de notification | **Point d'aiguillage principal** (voir § 5.2) |
| `lib/wishlist.ts` | `fetchMyWishlist`, `addWishlistItem`, `updateWishlistItem`, `deleteWishlistItem` | Même aiguillage |
| `lib/auth-context.tsx` | `user`, `signIn`, `signOut`, session hors ligne depuis le cache | Ajouter la notion de mode (voir § 5.2) |
| `app/_layout.tsx` | Garde d'authentification : sans `user`, redirection vers `/login` | À adapter : le mode local est un état « sans compte mais autorisé » |
| `lib/welcome-gate.ts`, `app/welcome.tsx` | Écran d'accueil au premier lancement | Base de l'écran de choix |
| `lib/calendar.ts` | Ajout à l'agenda du téléphone (chargé paresseusement) | Tel quel |
| `components/BirthdayCountdown.tsx`, `components/DateForm.tsx`, `components/DateEditPane.tsx`, `components/ImportGiftSheet.tsx` | UI des cartes | Tel quel, via l'aiguillage |
| `app/profile/data-export.tsx` | Export des données du compte (`/users/me/export`) | Modèle pour l'export local |
| `components/OfflineBanner.tsx` | Bandeau hors ligne | **Ne pas afficher en mode local** (il n'y a pas de serveur à attendre) |
| `expo-notifications` | Push serveur + notifications locales | Déjà installé, rien à ajouter en natif |

Aucun nouveau module natif n'est nécessaire (pas de rebuild du client de
dev), sauf décision contraire sur le stockage (§ 5.1).

---

## 5. Choix techniques

### 5.1 Stockage des données locales

- **Nouveau module** `lib/local-store.ts`, séparé du cache : c'est la
  **seule copie** des données, il ne doit jamais être vidé
  automatiquement (ni au `signOut`, ni par `clearCache()`).
- Emplacement : `documentDirectory/local-data/` (sauvegardé par iCloud /
  Google avec le reste de l'app, ce qui donne une sauvegarde gratuite).
- Format : un fichier `dates.json` (cartes, idées incluses) et un fichier
  `wishlist.json`, avec un champ `schemaVersion` pour pouvoir migrer plus
  tard.
- Écriture **atomique** : écrire dans un fichier temporaire puis le
  renommer (`moveAsync`), pour qu'un plantage en pleine écriture ne corrompe
  pas la seule copie.
- Ids locaux : `local-<timestamp>-<aléa>` (distincts des `tmp-…` de la file
  hors ligne).
- Photos de carte : copiées dans `local-data/photos/` et référencées par
  chemin de fichier.
- Volume : quelques centaines de cartes restent de petits JSON. SQLite
  n'est pas nécessaire (et éviterait un module natif).

### 5.2 Aiguillage compte / local

- `auth-context` expose un **mode** : `"account" | "local" | null`
  (`null` = premier lancement, pas encore choisi). Le mode est persisté
  (SecureStore ou petit fichier).
- Les fonctions de `lib/dates.ts` et `lib/wishlist.ts` gardent **la même
  signature** et aiguillent en interne : en mode local, elles lisent et
  écrivent via `local-store` ; sinon, comportement actuel (serveur + cache +
  file hors ligne). **Les écrans n'ont pas à connaître le mode.**
- Les fonctions sans équivalent local (`fetchUserWishlist` d'un ami,
  listes communes, événements…) lèvent une erreur claire
  (`LocalModeUnavailableError`) si elles sont appelées par erreur ; les
  écrans concernés sont masqués en amont.
- `_layout.tsx` : en mode local, pas de redirection vers `/login`.
- `lib/api.ts` : en mode local, **aucune requête** ne doit partir (garde en
  tête de `api()` qui lève si le mode est local) : c'est la promesse du
  mode, et une bonne détection des oublis pendant le développement.

### 5.3 Fêtes (nameday)

Aujourd'hui la fête est déduite du prénom **côté serveur**
(`server/utils/namedayHelper.js`, fichier
`server/data/namedays-fr-by-name.json`, ~12 Ko). En mode local :

- embarquer une copie de `namedays-fr-by-name.json` dans l'app
  (`mobile/src/data/`), et une fonction `findNameDay(prenom)` côté mobile
  reprenant la même logique (normalisation des accents, prénoms composés) ;
- tant que l'app n'est qu'en français, ne prendre que le fichier `fr`.

### 5.4 Rappels locaux (le point le plus délicat)

En mode compte, les rappels sont envoyés par le serveur
(`jobs/sendReminders.js`). En mode local, il faut les **programmer sur le
téléphone** avec `Notifications.scheduleNotificationAsync`.

Règles actuelles à reproduire (voir `server/models/date.model.js`) :

- anniversaires : `notificationPreferences.timings` (jours avant, défaut
  `[1]`) + `notifyOnBirthday` (le jour J) ;
- fêtes : `namedayPreferences.timings` (1 ou 7 jours avant) +
  `notifyOnNameday` ;
- `receiveNotifications: false` sur une carte = aucun rappel pour elle.

⚠️ **Limite iOS : 64 notifications locales programmées au maximum par
app.** Au-delà, iOS garde les plus proches et ignore les autres en
silence. Avec 100 cartes et plusieurs rappels chacune, on dépasse vite.

Stratégie proposée :

1. Calculer toutes les échéances des **60 prochains jours** (anniversaires
   + fêtes, selon les préférences de chaque carte).
2. Trier par date, garder les **60 premières** (marge de 4 sous la limite).
3. Tout annuler (`cancelAllScheduledNotificationsAsync`) puis
   reprogrammer. Heure d'envoi : minuit (heure du téléphone), comme le cron serveur.
4. Reprogrammer : à l'ouverture de l'app, au retour au premier plan, et
   après toute modification d'une carte ou d'une préférence.
5. Si l'app n'est pas ouverte pendant plus de 60 jours, les rappels
   s'arrêtent : l'écrire dans l'aide et ajouter une notification finale
   « Ouvre BirthReminder pour continuer à recevoir tes rappels » à J+55.

Android : même logique, canal `default` déjà créé dans `lib/push.ts`.
Permission de notification à demander au premier rappel activé.

⚠️ Ne **jamais** programmer de rappels locaux en mode compte : doublon
avec le push serveur.

### 5.5 Export / import

- Export : un fichier JSON (`schemaVersion`, date d'export, cartes, liste
  d'envies ; photos en base64 optionnelles) partagé via la feuille de
  partage (Fichiers, AirDrop, email…).
- Import : sélection du fichier, vérification du format, puis choix
  « Remplacer » ou « Fusionner » (fusion : on ignore une carte identique
  nom + prénom + date).
- Le même format doit servir à l'import vers un compte (§ 3.3).

### 5.6 Aucune donnée envoyée

À vérifier et garantir en mode local :

- aucun appel `api()` (garde du § 5.2) ;
- pas d'enregistrement du token push (`registerForPush` ne doit pas être
  appelé) ;
- pas de socket (`lib/socket.ts`) ;
- pas de préchargement réseau (`prefetchEventDetails`, récupération d'infos
  d'URL `fetchUrlInfo`… : le bouton « récupérer les infos » d'un lien est
  masqué en mode local) ;
- aucun outil de statistiques ou de suivi de plantage n'est installé
  aujourd'hui : si un jour on en ajoute, il doit être désactivé en mode
  local.

---

## 6. Découpage en étapes

Chaque étape est testable seule. Ne pas passer à la suivante sans que la
précédente marche sur le simulateur iPhone **et** iPad.

1. **Stockage local et mode.** `lib/local-store.ts` (lecture, écriture
   atomique, ids locaux) ; notion de mode dans `auth-context` ; garde dans
   `api()`. Test : écrire et relire des cartes, rien ne part sur le
   réseau.
2. **Aiguillage des dates et de la liste d'envies.** `lib/dates.ts` et
   `lib/wishlist.ts` aiguillent selon le mode ; fêtes détectées localement.
   Test : accueil, carte, modification, idées de cadeaux, agenda, iPad
   (panneau de droite) en mode local.
3. **Écran de choix et navigation.** Premier lancement, garde de
   `_layout.tsx`, onglets masqués, profil adapté, indicateur « Sur ce
   téléphone ».
4. **Rappels locaux.** Programmation avec la limite des 64, reprogrammation
   aux bons moments, écran de réglage des rappels.
5. **Export / import** et partage de la liste d'envies en texte.
6. **Passage vers un compte** avec import des cartes locales, sans
   doublons, et effacement des données locales après succès.
7. **Textes.** Notes de mise à jour (`lib/changelog.ts`), aide, et mise à
   jour des CGU / politique de confidentialité (mention du mode sans
   compte : aucune donnée collectée).

---

## 6 bis. Avancement (22/09/26)

- ✅ **Étape 1** — `lib/app-mode.ts`, `lib/local-store.ts`, garde dans `api()`,
  socket et uploads. Écran de test dev : `app/dev/local-store.tsx`.
- ✅ **Étape 2** — aiguillage dans `lib/dates.ts`, `lib/wishlist.ts`,
  `lib/stats.ts`, `lib/users.ts` (`fetchMe`/`updateMe` → réglages locaux) ;
  code local dans `lib/local-dates.ts` ; fêtes : `lib/nameday.ts` +
  `src/data/namedays-{fr,us}-by-name.json` (copies du serveur).
- 🟡 **Étape 7** — textes : changelog 2.2.0 (build 47), section « Utiliser
  sans compte » en tête de la FAQ mobile (`lib/faqData.ts`), CGU § 2.4 +
  § 10.3, politique de confidentialité § 2.3 + § 9 (mise à jour du
  22/09/26, **à déployer côté front**), guide : support par mail en local,
  `CLAUDE.md` racine complété.
- 🟡 **Étape 6** — codée, à tester : `lib/local-migration.ts`, écran
  `app/local-import.tsx`, redirection auto dans `_layout.tsx`
  (`localImportPending` d'auth-context), entrée « Importer mes cartes du
  mode sans compte » dans le profil compte après un « Plus tard ».
  Rejouable sans doublon : marques `importedAs` / `importedGifts` /
  `photoImported` / `importDone` posées sur chaque carte locale dès que le
  serveur confirme. Carte déjà présente dans le compte (prénom + nom + jour)
  → complétée, pas recréée. Effacement local seulement si tout est passé.
  Testé avec un faux serveur + coupure réseau au milieu : aucun doublon.
  Appelle `api()` directement (pas `createDate`, qui mettrait en file
  d'attente hors ligne et répondrait « OK » à tort).
  ➜ Une fois validé sur simulateur : `LOCAL_MODE_READY = true` (app-mode.ts).
- ✅ **Étape 5** — validée le 22/09/26 (export / import) : `lib/local-backup.ts` (format
  `birthreminder-local-backup`, photos en base64, validation stricte avant
  import, fusion sans doublon nom + prénom + jour), écran
  `app/profile/local-data.tsx`, bandeau `components/BackupReminder.tsx`
  (≥ 10 cartes, aucune sauvegarde depuis 30 j), export proposé avant
  « Effacer ». ⚠️ Nouveau module natif **`expo-document-picker` 14.0** (ajouté
  le 22/09/26) : client de dev à reconstruire, nouveau build TestFlight.
  Chargé paresseusement (`isImportAvailable()`), comme expo-calendar.
- ✅ **Étape 4** — validée le 22/09/26 (rappels locaux) : `lib/local-reminders.ts` (calcul
  `planReminders` / `fitToLimit` vérifié à la main : 200 cartes → 60
  notifications), écran `app/profile/reminders.tsx`. Heure : **minuit**, comme
  le cron serveur (décidé le 22/09/26), mais heure du téléphone.
  Reprogrammation : démarrage, retour au premier plan, et `onLocalChange()`
  de local-store (regroupée sur 800 ms). Annulation de NOS notifications
  seulement (préfixe `br-local-`), et en mode compte dès le démarrage.
- ✅ **Étape 3** — validée le 22/09/26 : onglets Événements/Chats masqués,
  indicateur 📱 à la place de la cloche, profil local, points d'entrée
  (accueil, connexion, inscription), bandeaux cagnottes et hors ligne
  masqués, boutons « récupérer les infos » masqués.
- En avance sur l'étape 5 : partage de la liste d'envies en texte.

⚠️ **`LOCAL_MODE_READY` reste à `__DEV__` jusqu'à l'étape 6.** Sans l'import,
un utilisateur local qui crée un compte bascule sur un compte vide : ses
cartes restent sur le disque mais ne s'affichent plus.

Connexion / inscription depuis le mode local : `withServerAccess()`
(`app-mode.ts`) ouvre le serveur le temps de l'action, sans enregistrer le
mode « compte » avant la réussite.

## 7. Questions à trancher avant ou pendant

- ~~**Heure d'envoi des rappels locaux**~~ : tranché — minuit, comme le serveur.
- **Mode local sur le site web ?** Proposé ici : non, mobile uniquement.
- **Un compte peut-il repasser en mode local ?** (exporter ses cartes et
  supprimer son compte). Proposé : pas dans un premier temps.
- ~~**Nom affiché du mode**~~ : tranché le 22/09/26 — « Sans compte » sur les
  boutons, « 📱 Sur ce téléphone » pour l'indicateur.
- ~~**Photos de carte en mode local**~~ : tranché — gardées (voir § 3.3).

---

## 8. Critères de réussite

- En mode local, **aucune requête réseau** vers le serveur BirthReminder
  (vérifiable avec l'inspecteur réseau de l'app de dev).
- Toutes les fonctions de la liste « Disponible » marchent en mode avion.
- Un rappel programmé arrive, app fermée, en mode avion.
- Passer à un compte importe toutes les cartes, sans doublon, même en
  relançant l'import après un échec.
- Désinstaller / réinstaller en restaurant une sauvegarde redonne les mêmes
  cartes.

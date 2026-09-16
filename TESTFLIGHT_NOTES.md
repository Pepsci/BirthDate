# Notes TestFlight — à tester

Version 1.8.0, build 41.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous tient dans cette limite : c'est celui à coller.
  Le détail par point, plus bas, sert de référence et peut être envoyé
  séparément aux testeurs (message, email) pour ceux qui creusent.

  ⚠️ Ces notes sont attachées à UN build : elles ne remontent pas toutes
  seules sur le suivant. Réécrire ce fichier à chaque build, et recoller.

  ⚠️ Le build 40 contient les réactions mais PAS les notifications de
  réaction ni l'écran "Notes de mise à jour" 1.8.0. Ce fichier décrit le
  build 41. Si un build 40 part quand même, retirer la puce sur la
  notification de réaction et la ligne qui renvoie vers les notes in-app.

  Volontairement absent du bloc court, comme pour la 1.7.0 : tout correctif
  de sécurité. Décrire une faille corrigée à des testeurs externes n'apporte
  rien à leurs tests. Ça reste dans le patch note interne.
-->

## Version courte — à coller dans TestFlight

BirthReminder 1.8.0 (build 41)

Nouveau : réactions, accusés de lecture et réponse depuis la notification dans les messages, et une refonte complète des comptes de paiement des cagnottes.

— À TESTER EN PRIORITÉ —

MESSAGES — COCHES ET RÉPONSE RAPIDE
- Envoie un message : 1 coche = envoyé, 2 coches grises = arrivé sur le téléphone de l'autre, 2 coches colorées = lu.
- App de l'autre personne FERMÉE : dès que sa notification s'affiche, ton message doit passer à 2 coches grises.
- Appui long sur un de tes messages > « Infos » : les heures d'envoi, de distribution et de lecture.
- Sur la notification d'un message, fais « Répondre » et envoie sans ouvrir l'app. Teste app fermée ET en arrière-plan. La réponse doit apparaître dans la discussion, une seule fois.
- App fermée, touche une notification de message : la conversation s'ouvre, SANS nouvelle notification.

RÉACTIONS
- Appui long sur un message, en privé comme dans une discussion d'événement, puis choisis une réaction.
- Appuie sur une pastille déjà posée pour te joindre à la réaction, ou sur la tienne pour la retirer.
- Vérifie qu'une réaction posée sur un appareil apparaît sur l'autre sans recharger.
- Quand quelqu'un réagit à TON message, tu dois recevoir une notification. Seul l'auteur du message est prévenu, et une seule notification par message même si dix personnes réagissent.

CAGNOTTES — NOUVEAU COMPTE DE PAIEMENT
- Si tu avais déjà connecté un compte de paiement, déconnecte-le et refais l'inscription : le type de compte a changé.
- L'inscription Stripe doit être plus courte qu'avant (les informations d'activité sont pré-remplies).
- Vérifie le solde affiché dans la gestion de l'événement et le bouton vers le tableau de bord Stripe.
- Fais une participation de 1 € depuis un autre compte : tu dois recevoir un reçu par email, et la ligne doit apparaître dans Profil > Mes contributions.
- Si un montant ou des frais te semblent faux, signale-le : c'est le point le plus sensible de cette version.

EN CAS DE PROBLÈME SUR UNE CAGNOTTE
- Profil > Mes contributions > « Un problème avec cette contribution ? » : la démarche s'affiche étape par étape avant le formulaire, qui te fait choisir la cagnotte concernée.

NOTIFICATIONS (corrections)
- La notification d'un message d'événement doit ouvrir la DISCUSSION, et non la page de l'événement.
- Lire un message directement dans la discussion doit éteindre sa pastille rouge, sans repasser par le centre de notifications.
- Sur iPhone, le texte du message doit à nouveau s'afficher sur l'écran verrouillé, et non « Nouveau message chiffré ».

— AUSSI DANS CETTE VERSION —

- Un organisateur peut donner le lien d'une cagnotte externe (Leetchi, Le Pot Commun…) plutôt que d'en ouvrir une ici.
- Validation bancaire (3-D Secure) exigée au-delà de 150 €.
- Le type d'événement « Dîner » s'appelle maintenant « Repas ».
- Conditions d'utilisation à jour : compte de paiement, procédure en cas de litige, cagnotte externe.

Les notes détaillées sont dans Profil > Notes de mise à jour.
Merci de signaler tout ce qui bloque, même un détail.

## Détail par point — référence

### Réactions aux messages

Six réactions dessinées maison (pouce, cœur, rire, étonnement, tristesse,
fête), identiques sur mobile et sur le web. Le stockage ne connaît qu'une clé
sémantique (`love`), jamais le caractère emoji : le jeu peut être redessiné
sans migration de base.

Les pastilles sont regroupées par type avec un compteur, jamais une pastille
par personne — sur un message d'événement à douze participants, l'affichage
individuel déborderait de l'écran. Le compteur n'apparaît qu'à partir de deux.

Les réactions ne sont PAS chiffrées, contrairement au contenu des messages.
C'est un arbitrage assumé : la clé (`love`) n'a de sens que rapprochée d'un
message que le serveur ne peut pas lire.

### Notifications de réaction

Seul l'auteur du message est prévenu. Une seule notification non lue par
message : la réaction suivante remplace la précédente au lieu de s'empiler.
Rien à la pose de sa propre réaction, rien au retrait.

La push ne contient aucun extrait du message — il est chiffré de bout en bout
et le serveur ne peut pas le lire. L'emoji apparaît dans la push (le système
n'affiche que du texte) ; dans l'application, c'est le dessin maison.

Le silencieux d'une conversation (MuteBell) couvre les réactions d'office.
Il n'y a PAS encore d'interrupteur dédié aux réactions, contrairement à
WhatsApp : les couper impose aujourd'hui de couper aussi les messages.

### Accusés de réception

Trois états, calculés par l'expéditeur : envoyé (✓, le serveur a enregistré le
message), distribué (✓✓ grises, le message a atteint un appareil du
destinataire), lu (✓✓ colorées). « Distribué » est posé à l'envoi si le
destinataire a l'app ouverte, à sa prochaine connexion sinon, et — app fermée —
par l'extension de notification iOS au moment où la push arrive. L'extension
n'a pas accès à la session : la push embarque un jeton propre au message, qui
ne permet que de le marquer distribué.

Correctif au passage : une lecture faite sur mobile ne prévenait jamais
l'expéditeur, les coches restaient donc à « non lu » côté web.

### Réponse depuis la notification

Bouton « Répondre » sur les notifications de message, avec champ texte.
Face ID / code exigé si le téléphone est verrouillé. La réponse est chiffrée
sur l'appareil puis envoyée par une route REST (app fermée, pas de socket).

Point à surveiller : iOS peut suspendre l'app avant la fin de l'envoi. Un
sursis d'environ 25 s est demandé ; au-delà, la réponse reste en file et part
à la prochaine ouverture. Le serveur déduplique : jamais de double envoi. Si
une réponse n'arrive qu'à l'ouverture de l'app, signalez-le avec l'état du
réseau à ce moment-là.

### Comptes de paiement — Express → Standard

Les comptes Connect passent de Express à Standard. Raison : Stripe refuse de
dissocier `stripe_dashboard[type]=express` de la prise en charge des pertes
par la plateforme. En Express, BirthReminder aurait été débité des soldes
négatifs d'organisateurs. En Standard, `losses.payments = "stripe"`.

Conséquence pour l'organisateur : il dispose de son propre tableau de bord
Stripe complet, et BirthReminder ne peut plus générer de lien de connexion
(`createLoginLink` est réservé à Express) — le bouton renvoie vers
dashboard.stripe.com.

Un compte Express existant ne se convertit pas : il faut le déconnecter et
refaire l'inscription.

### Points de vigilance

Le remboursement d'une cagnotte n'a toujours jamais été exécuté de bout en
bout avec de l'argent réel. Ne le déclenchez pas sur une cagnotte alimentée
sans me prévenir.

Si une action liée à une cagnotte ou à une réaction renvoie une erreur, c'est
probablement que le serveur n'est pas à jour : signalez-le, ce n'est pas un
bug de l'application.

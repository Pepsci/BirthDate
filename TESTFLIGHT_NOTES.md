# Notes TestFlight — à tester

Version 1.9.0, build 43.

Les testeurs viennent du build 40 : le bloc court résume donc 1.8.0 + 1.9.0.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous tient dans cette limite (2269 caractères) : c'est
  celui à coller.

  ⚠️ Ces notes sont attachées à UN build : elles ne remontent pas toutes
  seules sur le suivant. Réécrire ce fichier à chaque build, et recoller.

  ⚠️ Les tests « notifications sur plusieurs appareils » supposent le
  serveur à jour (présence par appareil, server/utils/presence.js). Vérifier
  le déploiement AVANT d'envoyer le build aux testeurs.

  Volontairement absent du bloc court : les détails techniques (socket
  fantôme, tâche de fond Android, point d'entrée index.ts). Ils n'aident
  pas à tester. Voir la section de référence plus bas.
-->

## Version courte — à coller dans TestFlight

BirthReminder 1.9.0 (build 43)

Tu passes directement du build 40 au 43 : voici tout ce qui a changé depuis. Le détail complet est dans Profil > Notes de mise à jour (versions 1.8.0 et 1.9.0).

— MESSAGES —
- Coches de lecture, comme sur WhatsApp : 1 coche = envoyé, 2 grises = arrivé sur le téléphone de l'autre, 2 colorées = lu.
- Appui long sur un de tes messages > « Infos » : heures d'envoi, de distribution et de lecture.
- Répondre directement depuis la notification, sans ouvrir l'app.
- Tu es prévenu quand quelqu'un réagit à ton message (une seule notification par message).
- Sur iPhone, le texte du message s'affiche à nouveau sur l'écran verrouillé.

— NOTIFICATIONS —
- Un onglet BirthReminder ouvert sur ordinateur n'empêche plus ton téléphone de sonner.
- Plusieurs appareils : seul celui où l'app est ouverte ne sonne pas, les autres oui.
- Une notification de message d'événement ouvre la discussion, plus la page de l'événement.
- Lire un message dans la discussion éteint sa pastille rouge.

— CAGNOTTES —
- Nouveau compte de paiement Stripe complet, avec ton propre tableau de bord. Si tu avais déjà connecté un compte, déconnecte-le et refais l'inscription.
- Solde de la cagnotte visible dans la gestion de l'événement.
- Reçu par email après chaque participation, historique dans Profil > Mes contributions.
- Possibilité de donner le lien d'une cagnotte externe (Leetchi, Le Pot Commun…).

— WISHLISTS ET ÉVÉNEMENTS —
- Dans la wishlist d'un ami, tes réservations descendent dans « Mes réservations ».
- Un brouillon d'événement se supprime enfin (depuis sa carte ou la corbeille du formulaire).
- Boutons d'organisation d'un événement réalignés.
- « Dîner » devient « Repas ».

— À TESTER EN PRIORITÉ —
1. Onglet web ouvert + iPhone verrouillé : fais-toi envoyer un message, le téléphone doit sonner avec le texte.
2. Réponds à un message depuis sa notification, app fermée : la réponse doit apparaître une seule fois.
3. Vérifie les coches : grises à la réception, colorées à la lecture.
4. Réserve un cadeau dans la wishlist d'un ami : il doit passer dans « Mes réservations ».
5. Organisateurs de cagnotte : refais l'inscription du compte de paiement et teste une participation de 1 €.

Merci de signaler tout ce qui bloque, même un détail.

## Détail par point — référence

### Notifications : présence par appareil

Le serveur ne raisonnait pas par appareil mais par compte : un seul socket
ouvert (onglet web, app sur un autre téléphone, simulateur oublié) suffisait
à couper toutes les push mobiles des messages privés. Désormais :

- l'app mobile envoie son jeton push avec son socket ;
- le serveur ne saute que les jetons des appareils réellement au premier plan ;
- un onglet web coupe la web push, jamais les push mobiles ;
- un ancien build qui n'envoie pas de jeton ne coupe rien (au pire, une
  notification en double app ouverte, jamais une notification perdue).

### Socket fantôme en arrière-plan

`getSocket()` pouvait créer deux sockets au démarrage. Le premier, orphelin,
restait connecté après le passage en arrière-plan et bloquait les push. Sur
iPhone, la suspension de l'app le tuait au bout de quelques secondes : le bug
passait inaperçu, mais existait.

### Android : tâche de déchiffrement

La tâche de fond qui déchiffre les messages est maintenant définie dans
`mobile/index.ts`, chargé avant expo-router. Définie seulement via
`_layout.tsx`, elle était inconnue au réveil de l'app par une push, et la
notification disparaissait sans trace. Ne jamais repasser `"main"` sur
`expo-router/entry`.

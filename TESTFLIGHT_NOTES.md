# Notes TestFlight — à tester

Version 1.7.0, build 39.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous tient dans cette limite : c'est celui à coller.
  Le détail par point, plus bas, sert de référence et peut être envoyé
  séparément aux testeurs (message, email) pour ceux qui creusent.

  Volontairement absent du bloc court : le correctif de sécurité sur les
  jetons d'invité. Il n'apporte rien à leurs tests, et le détailler à des
  testeurs externes revient à décrire une faille corrigée à des gens qui
  n'ont pas à en connaître le fonctionnement. Il figure dans le patch note
  interne de l'application.
-->

## Version courte — à coller dans TestFlight

Cette version tourne autour des notifications : les couper sans tout couper.
Et elle termine le chantier des listes communes.

À TESTER EN PRIORITÉ

Couper les notifications d'une conversation. Une cloche apparaît en haut de
chaque discussion, privée comme d'événement : 1 heure, 8 heures, 1 semaine, ou
jusqu'à réactivation. Après avoir coupé, un message envoyé depuis un autre
compte ne doit plus faire sonner le téléphone, mais la conversation doit
remonter dans la liste avec son compteur de non-lus. C'est voulu : on coupe la
sonnerie, pas le message.

Réglages de notifications par événement, bouton "Notifications de cet
événement". Ouvert à tous les participants, plus seulement à l'organisateur.
Chacun voit les catégories qui le concernent : sept pour un organisateur, deux
pour un invité. L'annulation et le changement de date ne sont volontairement
pas coupables.

Discussions d'événement dans l'écran Discussions, sous un onglet "Événements".
Elles n'étaient joignables qu'en rouvrant l'événement.

Retenir une date ou un lieu. Organisateurs : appuyez directement sur une ligne
de résultats du vote. Il fallait jusqu'ici passer par "Modifier l'événement".

Listes communes : filtre par occasion et par état de réservation, cadeaux déjà
offerts rangés sous un trait, possibilité de masquer une idée aux invités. Les
gestionnaires voient enfin les réservations faites depuis le lien public et
peuvent les libérer. La vue des invités reprend celle des wishlists.

Lien public d'une liste : le code ouvre désormais la liste entière, sans lui le
lien ne montre rien. Le partage propose un lien qui embarque le code. En
réservant, on peut laisser son email pour retrouver sa réservation depuis un
autre appareil.

Rejoindre un événement sans compte : depuis la discussion, un invité peut se
connecter ou s'inscrire, et sa participation le suit — réponse de présence,
votes et idées cadeaux sont repris sur son compte.

CORRIGÉ

- Envoyer un message dans un chat d'événement déclenchait deux notifications
  chez l'organisateur.
- Les votes des invités sans compte n'étaient comptés nulle part sur les
  cadeaux.
- Le clavier masquait le champ du motif à l'annulation d'un événement, et le
  premier appui sur un bouton était avalé.
- Dans les notifications, "Tout lire" et "Tout supprimer" chevauchaient le
  titre.
- Les cartes d'idées cadeaux ne s'alignaient pas entre elles.
- Le coût d'un remboursement de cagnotte était sous-estimé : il est calculé sur
  les frais réellement prélevés.

POINTS DE VIGILANCE

Le remboursement d'une cagnotte n'a toujours jamais été exécuté de bout en bout
avec de l'argent réel. Ne le déclenchez pas sur une cagnotte alimentée sans me
prévenir.

Si la cloche ou l'écran de notifications d'un événement renvoie une erreur,
c'est que le serveur n'est pas encore à jour : signalez-le, ce n'est pas un bug
de l'application.

COMMENT SIGNALER

Une capture d'écran et ce que vous faisiez juste avant suffisent. Précisez le
modèle de téléphone si l'affichage est en cause.

---

## Détail par point

Les points 1 à 8 nécessitent la nouvelle version du serveur : si quelque chose
y échoue, signalez-le, cela peut venir de là.

## 1. Couper les notifications d'une conversation

Jusqu'ici, faire taire une conversation trop bavarde n'était pas possible : on
ne pouvait que couper la catégorie entière dans Profil, Notifications, Push —
donc toutes les conversations, ou tous les événements.

Une cloche apparaît maintenant en haut de chaque discussion, privée comme
d'événement. Quatre durées : 1 heure, 8 heures, 1 semaine, ou jusqu'à
réactivation. La cloche se barre et se colore quand c'est actif, et indique
jusqu'à quand.

Ce qui est coupé : uniquement la notification poussée sur le téléphone. La
conversation reste dans votre liste, ses messages non lus continuent de
s'afficher, et le centre de notifications de l'application les garde. Couper
les deux ferait disparaître les messages sans laisser de trace, et on ne
saurait plus qu'on a raté quelque chose.

À vérifier, à deux comptes : coupez pour 1 heure, faites envoyer un message
depuis l'autre compte, vérifiez que le téléphone ne sonne pas mais que la
conversation remonte avec son badge. Puis réactivez et refaites l'essai.

## 2. Réglages de notifications par événement

Nouveau bouton "Notifications de cet événement" sur la page d'un événement.
Ouvert à tous les participants : l'écran existait, mais était réservé à
l'organisateur, si bien qu'un invité n'avait aucun moyen de régler ses propres
notifications.

Les catégories dépendent du rôle, et c'est voulu. Les réponses aux invitations,
les votes, les cadeaux proposés et les contributions ne partent qu'à
l'organisateur : les proposer à un invité afficherait des interrupteurs sans
effet. Un organisateur voit donc sept catégories, un invité en voit deux —
messages du chat, et mises à jour de l'événement.

L'annulation et le changement de date ne figurent pas dans la liste. Ce sont
les deux seules notifications dont l'utilité est de rattraper quelqu'un qui ne
regarde pas l'application ; les couper, c'est se déplacer pour rien un samedi.

À vérifier : coupez "Messages du chat" sur un événement, faites envoyer un
message, vérifiez que rien n'arrive. Puis vérifiez qu'une modification de date
sur ce même événement vous prévient malgré tout.

## 3. Discussions d'événement dans l'écran Discussions

Les discussions d'événement n'apparaissaient nulle part dans la liste des
conversations : on ne pouvait les retrouver qu'en rouvrant l'événement, alors
que c'est précisément cet écran qu'on ouvre pour lire ses messages.

Un onglet "Événements" apparaît à côté de "Amis" dès qu'une discussion existe,
avec le total des non-lus. Seuls les événements ayant déjà des messages y
figurent : une liste de discussions vides n'aide personne.

Le chat d'un événement porte désormais son nom en titre, et un bandeau ramène à
l'événement. Ouvert depuis la liste, cet écran était une impasse : on lisait un
message parlant de la date ou d'un cadeau sans pouvoir rejoindre l'endroit où
en décider.

## 4. Retenir une date ou un lieu

Un organisateur voyait les résultats du vote sans aucun moyen d'en tirer une
conclusion : il devait rouvrir "Modifier l'événement" et rebasculer la date en
mode fixe, c'est-à-dire traverser tout le formulaire sans plus avoir les
décomptes sous les yeux au moment de choisir.

Il suffit maintenant d'appuyer sur une ligne de résultats. Une confirmation
prévient de ce que ça déclenche : le vote est clos, tous les participants sont
avertis et doivent reconfirmer leur présence. Retenir un lieu prévient aussi
les participants, en le nommant — ils recevaient auparavant un message générique
"l'événement a été modifié" et devaient aller voir eux-mêmes.

À vérifier, à deux comptes : votez depuis le second compte, retenez une date
depuis l'organisateur, vérifiez la notification reçue et que la présence est
bien repassée en attente.

## 5. Listes communes — tri et visibilité

Un filtre croise deux critères : l'occasion, et l'état de réservation (libres,
réservées, celles dont vous vous occupez). Chercher "ce qui reste à prendre
pour Noël" demande les deux à la fois.

Les cadeaux déjà offerts descendent sous un trait, en bas. Ils ne sont pas
supprimés : c'est la mémoire de ce qui a déjà été offert, et donc ce qui évite
d'offrir deux fois la même chose l'année suivante.

Nouvelle option pour masquer une idée aux invités et au lien public, tout en la
gardant visible entre gestionnaires — marquée d'un œil barré sur la carte.

La vue des invités reprend celle des wishlists : "Disponible" ou "Réservé", et
un bouton pour réserver. Ils voyaient jusqu'ici les commandes des gestionnaires
— statut, modification, suppression — qui échouaient toutes.

## 6. Listes communes — réservations

Les réservations faites depuis le lien public n'apparaissaient nulle part dans
l'application : les gestionnaires voyaient une idée libre alors que quelqu'un
s'en occupait déjà. Elles s'affichent maintenant au nom du visiteur.

Un gestionnaire peut aussi libérer la réservation de quelqu'un d'autre. Sans
cela, une idée réservée par un visiteur qui ne revient jamais restait bloquée
pour toujours.

## 7. Listes communes — lien public

Le code d'accès n'était demandé qu'au moment de réserver : le lien montrait
donc toute la liste à quiconque le recevait. Il ouvre désormais la liste
entière, et tant qu'il n'est pas saisi, les idées ne sont même pas envoyées par
le serveur.

Le partage propose en conséquence un lien qui embarque le code, pour ne pas
avoir à l'envoyer dans un second message. Le lien nu reste disponible pour qui
préfère donner le code de vive voix. Régénérer le code invalide les liens déjà
distribués qui le contenaient.

En réservant, on peut laisser son email : on reçoit une confirmation avec un
lien qui permet de retrouver sa réservation depuis n'importe quel appareil.
Auparavant, changer de navigateur faisait tout perdre — et il suffisait de
connaître un prénom pour défaire la réservation d'un autre.

## 8. Rejoindre un événement sans compte

La discussion d'un événement reste réservée aux comptes, parce qu'elle est
chiffrée de bout en bout et qu'un invité sans compte n'a pas de clé. Deux
boutons mènent désormais à la connexion ou à l'inscription.

Le point important : la participation suit. Réponse de présence, votes de date
et de lieu, idées cadeaux proposées — tout est repris sur le compte au lieu
d'être perdu. Sans cela, se créer un compte pour pouvoir écrire aurait fait
repartir de zéro, et l'organisateur aurait vu deux participants pour une seule
personne.

## 9. Cagnotte — coût réel d'un remboursement

Le coût annoncé avant de valider un remboursement était estimé au tarif d'une
carte européenne standard. Une carte professionnelle ou étrangère coûte
sensiblement plus : le chiffre affiché pouvait valoir la moitié de la perte
réelle, avant une opération irréversible.

Les frais réellement prélevés sont maintenant relevés à l'encaissement et
additionnés tels quels. Pour les contributions encaissées avant cette version,
il ne reste qu'une estimation : l'écran l'annonce alors comme un ordre de
grandeur, en précisant combien de contributions sont concernées.

En ouvrant une cagnotte, un encadré rappelle ce à quoi on s'engage : en cas
d'annulation, c'est à l'organisateur de rembourser, et les frais du paiement
d'origine restent à sa charge.

RAPPEL : cette partie n'a toujours jamais été exécutée de bout en bout avec de
l'argent réel. Ne déclenchez pas de remboursement sur une cagnotte alimentée
sans me prévenir.

## 10. Corrections diverses

Envoyer un message dans un chat d'événement déclenchait deux notifications sur
le téléphone de l'organisateur pour un seul message. Le doublon ne se voyait
que sur le téléphone : le centre de notifications de l'application, lui,
regroupait les deux.

L'interrupteur "messages du chat" des réglages d'un événement n'avait aucun
effet — le réglage était enregistré puis perdu — et coupait de surcroît les
notifications de tous les invités, pas seulement celles de l'organisateur.

Les votes des invités sans compte n'étaient comptés nulle part sur les
propositions de cadeaux : seuls ceux des membres apparaissaient.

Le clavier masquait le champ du motif quand on annulait un événement : on
écrivait à l'aveugle. Et clavier ouvert, le premier appui sur un bouton était
avalé pour fermer le clavier — il fallait appuyer deux fois. Corrigé pour
toutes les fenêtres à saisie, pas seulement celle-ci.

Dans l'écran des notifications, "Tout lire" et "Tout supprimer" chevauchaient
le titre. Les deux actions sont descendues sous l'en-tête, et les en-têtes
s'adaptent maintenant à la largeur de leurs boutons.

Les cartes d'idées cadeaux ne s'alignaient pas entre elles : selon la longueur
du titre ou l'absence de prix, l'occasion, le prix et le statut se retrouvaient
à des hauteurs différentes d'une carte à l'autre.

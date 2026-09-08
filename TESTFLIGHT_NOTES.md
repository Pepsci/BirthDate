# Notes TestFlight — à tester

Version 1.6.0, build 38.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous tient dans cette limite : c'est celui à coller.
  Le détail par point, plus bas, sert de référence et peut être envoyé
  séparément aux testeurs (message, email) pour ceux qui creusent.
-->

## Version courte — à coller dans TestFlight

Merci de signaler tout ce qui bloque, même mineur. Beaucoup de points
dépendent de la nouvelle version du serveur : si quelque chose échoue, cela
peut venir de là.

NOUVEAU

- Annuler un événement, avec un motif. Les invités sont prévenus par
  notification et par email, la page reste consultable. L'annulation peut être
  défaite. Un événement publié doit être annulé avant d'être supprimé.
- Transférer l'organisation d'un événement à un participant, qui doit
  accepter. La cagnotte ne suit pas le transfert.
- Un événement annulé n'accepte plus aucune participation : votes, réponses de
  présence, propositions de cadeaux, invitations et contributions sont fermés.
  Le chat, lui, reste ouvert.
- Rembourser tous les contributeurs d'une cagnotte. À tester avec une carte de
  test uniquement : cette partie n'a jamais été exécutée de bout en bout.
- Quitter un événement auquel on est invité, et copier son code d'accès seul.
- Les événements passés et annulés sont regroupés dans une section repliable.
- Rappels du calendrier réglables (Profil, Réglages). Jusqu'ici, ajouter un
  événement à son agenda ne posait aucun rappel.
- Listes communes : créer la carte de la personne en un geste quand on reçoit
  une liste, retrouver une demande non terminée dans Profil, Listes communes,
  et partager à un contact directement depuis la feuille de partage.

CORRIGÉ

- Les notifications reçues sur le téléphone n'ouvraient pas la bonne page.
  Toutes étaient touchées, pas seulement les anniversaires.
- Listes communes : les cadeaux déjà achetés ou offerts restaient visibles par
  les invités, au risque d'un double achat. Un invité ne pouvait pas quitter
  une liste. Une réservation par lien public ne prévenait personne.
- Les liens "se désabonner" des emails ne fonctionnaient pas, sauf celui des
  demandes d'ami.
- Accueil : "C'est la fête de Louis et Louis" avec deux prénoms identiques, et
  "0 anniversaire souhaité aujourd'hui" remplacé par une phrase.
- Les cartes cadeaux se décalaient entre elles selon la longueur du titre.
- Les boutons ronds de l'en-tête n'étaient pas centrés.

À REGARDER EN PRIORITÉ

1. Appuyer sur une notification depuis l'écran verrouillé : la bonne page
   doit s'ouvrir.
2. À deux comptes : partager une liste commune, la rattacher côté invité en
   créant la carte, passer un cadeau en "acheté" côté membre et vérifier qu'il
   disparaît côté invité.
3. Annuler un événement et vérifier que l'invité reçoit bien la notification
   et l'email.

---

## Détail par point

Merci de signaler tout ce qui bloque, même mineur. Les points 3, 4, 5, 8, 9,
10 et 11 nécessitent la nouvelle version du serveur : si quelque chose y
échoue, signalez-le, cela peut venir de là.

## 1. Notifications du téléphone

Appuyer sur une notification reçue sur le téléphone n'ouvrait pas la page
concernée : on arrivait sur l'accueil, ou nulle part. Toutes les
notifications système étaient touchées, pas seulement les anniversaires. Les
mêmes notifications ouvertes depuis le centre de notifications de
l'application, elles, fonctionnaient — d'où l'impression que le problème
n'existait que sur certaines.

À vérifier : depuis l'écran verrouillé et depuis le centre de notifications
du téléphone, un rappel d'anniversaire ouvre la carte de la personne, une
notification d'événement ouvre l'événement, un message ouvre la conversation.

## 2. Rappels du calendrier

Ajouter un événement à votre agenda ne posait aucun rappel : l'entrée ne se
signalait qu'à l'heure de l'événement. Ce n'était pas un comportement d'Apple
ou de Google, c'est l'application qui n'en demandait aucun.

Nouveau réglage dans Profil, Réglages, "Rappels du calendrier". Deux groupes
séparés : les événements datés se règlent en durée avant l'heure (1 jour
avant, 1 heure avant), les anniversaires et fêtes en heure d'horloge, puisque
ce sont des journées entières (la veille à 18 h, le jour même à 9 h).

À vérifier : ajoutez un événement à votre agenda, puis ouvrez l'entrée créée
dans l'application Calendrier — les rappels doivent y figurer. Changez les
réglages et refaites l'opération sur un autre événement.

## 3. Annuler un événement

Un organisateur peut annuler son événement, avec un motif facultatif.
L'événement n'est pas supprimé : la page reste consultable, barrée, avec le
motif affiché en haut. Tous les invités sont prévenus par notification et par
email. L'annulation peut être défaite.

Un événement publié ne peut plus être supprimé directement : il faut
l'annuler d'abord. Sans cela il disparaissait de la liste de chaque invité
sans un mot, en emportant le chat et l'historique.

À vérifier, idéalement à deux comptes : l'invité reçoit bien la notification
et l'email, voit le motif, et l'événement est passé dans la section
"Événements passés". Vérifiez aussi qu'un événement annulé puis rétabli
revient dans les événements à venir.

À vérifier également, en gardant la page de l'événement ouverte côté invité
pendant que l'organisateur annule : les votes et la réponse de présence
doivent être refusés, et l'organisateur ne doit plus recevoir de notification
de vote.

Un événement annulé n'accepte plus aucune participation : votes de date et de
lieu, réponse de présence, propositions et votes de cadeaux, invitations,
rejoindre par code, contributions à la cagnotte. Tout cela est refusé par le
serveur, pas seulement masqué à l'écran : un téléphone resté sur la page sans
la recharger continuait sinon d'envoyer des votes, et l'organisateur recevait
des notifications de vote sur un événement qu'il venait d'annuler.

Le chat reste ouvert, volontairement : c'est le moment où les participants ont
le plus besoin de se parler. Quitter l'événement reste possible également.

Attention : l'entrée déjà créée dans votre agenda ne disparaît pas. Une
application ne peut pas modifier une entrée de calendrier après coup, l'email
le rappelle.

## 4. Transférer l'organisation d'un événement

Un organisateur peut proposer l'organisation à un participant ayant confirmé
sa présence. La personne doit accepter : tant qu'elle n'a pas répondu, rien
ne change et l'organisateur garde la main. Elle peut refuser, et
l'organisateur peut retirer sa proposition.

Une fois le transfert accepté, tous les participants sont prévenus, et
l'ancien organisateur reste participant.

La cagnotte ne suit jamais le transfert. L'argent déjà versé se trouve sur le
compte de paiement de l'ancien organisateur et ne peut pas en être déplacé :
la cagnotte est fermée, et c'est à lui de rembourser ou de reverser. Le
message envoyé aux participants le dit explicitement.

À vérifier : la proposition arrive bien chez la personne visée, refuser
prévient l'organisateur, et après acceptation les deux comptes voient le bon
organisateur.

## 5. Rembourser une cagnotte

Nouveau bloc dans l'écran Cagnotte, visible dès qu'il y a quelque chose à
rembourser — y compris quand la cagnotte est déjà fermée par une annulation
ou un transfert.

Les contributeurs récupèrent l'intégralité de ce qu'ils ont versé. Les frais
du paiement d'origine, eux, ne sont pas restitués et restent à la charge de
l'organisateur : le montant exact est annoncé avant validation. L'opération
est irréversible et ferme la cagnotte.

Si un remboursement échoue, les autres aboutissent quand même et l'opération
peut être relancée : seules les contributions non remboursées sont reprises.

À vérifier : le montant annoncé correspond, et après quelques instants les
contributions apparaissent comme remboursées, les contributeurs recevant leur
notification.

Attention : à tester avec une carte de test, pas un vrai paiement. C'est la
seule partie de cette version qui touche à de l'argent réel, et elle n'a
encore jamais été exécutée de bout en bout.

## 6. Quitter un événement, copier le code

Un bouton "Quitter l'événement" est apparu sous votre réponse de présence.
Répondre "Non" et quitter sont deux gestes différents : décliner laisse
l'organisateur informé, quitter retire l'invitation.

Un bouton copie seulement le code d'accès, pour le coller dans une
conversation déjà ouverte ailleurs — le partage existant envoie le lien
complet par la feuille de partage du système.

## 7. Événements passés

Les événements passés sont regroupés dans une section repliable en bas de la
liste, avec le nombre entre parenthèses. Les événements annulés y vont aussi,
quelle que soit leur date.

Rien n'est archivé définitivement : si l'organisateur repousse un événement à
une date future, il remonte tout seul dans les à-venir. Même chose pour un
vote sur plusieurs dates dont toutes sont passées, si une nouvelle option est
ajoutée.

À vérifier : la section se replie et se déplie, l'état est retenu quand on
revient, et un événement dont la date est repoussée ressort des archives.

## 8. Listes communes — ce que voient les invités

Un invité (quelqu'un à qui la liste a été partagée, sans pouvoir la modifier)
voyait tous les cadeaux, y compris ceux déjà achetés ou offerts. Il pouvait
donc acheter en double, ce que la liste sert précisément à éviter. Ces
cadeaux ne lui sont plus montrés, ni dans l'application ni via le lien
public.

Un invité peut désormais quitter une liste. Le bouton existait, mais le
serveur refusait la demande : l'accès restait et la liste réapparaissait au
rechargement suivant.

Un invité ne voit plus les boutons qui lui étaient interdits — ajouter,
modifier, supprimer une idée renvoyaient une erreur.

À vérifier, à deux comptes : passez un cadeau en "acheté" côté membre, il
doit disparaître côté invité. Puis quittez la liste côté invité et
rechargez : elle ne doit plus apparaître.

## 9. Listes communes — recevoir et rattacher

Une liste commune ne s'affiche que posée sur la carte de la personne
concernée. Il fallait donc déjà avoir cette personne dans son carnet pour
accepter — alors qu'on est justement invité à préparer le cadeau de
quelqu'un qu'on n'a pas forcément enregistré.

L'application propose maintenant de créer la carte en un geste, préremplie
avec le nom et la date de naissance de la personne, repris du carnet de
celui qui partage. Ces informations restent modifiables ensuite depuis la
carte, y compris si la date était fausse chez lui.

La liste des cartes existantes se replie au-delà de cinq cartes et devient
cherchable, pour ne plus dérouler tout le carnet.

À vérifier : depuis un compte sans la carte de la personne, la création en un
geste fonctionne et vous emmène sur la carte créée.

## 10. Listes communes — retrouver une demande, partager, notifications

Nouvelle entrée "Listes communes" dans le menu Profil. Une liste partagée
dont vous n'avez pas terminé le rattachement s'y retrouve, ainsi que les
invitations en attente. Jusqu'ici ces demandes n'étaient accessibles que
depuis la notification : la fermer par erreur les rendait introuvables.

"Partager à un contact" figure directement dans la feuille de partage, au
lieu d'être enterré dans l'écran de gestion des accès.

Les invités reçoivent une notification quand une idée est ajoutée, et quand
un cadeau qu'ils avaient réservé est retiré — ils comptaient dessus. Ils ne
reçoivent rien d'autre, pour ne pas suivre chaque changement d'une liste qui
ne leur appartient pas.

Une réservation faite depuis le lien public prévient désormais les membres.
Elle ne prévenait personne : les membres continuaient de voir une idée à
prendre que quelqu'un avait déjà bloquée.

À vérifier : ouvrez la notification de partage, fermez l'écran sans rattacher
la liste, supprimez la notification, puis retrouvez la demande dans Profil,
Listes communes.

## 11. Emails

Les liens "se désabonner" des emails ne fonctionnaient pas, à l'exception de
celui des demandes d'ami qui passait par un autre chemin. Ils fonctionnent
tous désormais, et la page confirme précisément ce qui a été désactivé.

Le récap mensuel affichait une double flèche sur son bouton.

À vérifier : le lien de désabonnement d'un rappel d'anniversaire ouvre une
page de confirmation, et le réglage correspondant est bien coupé dans votre
profil.

## 12. Corrections d'affichage

Sur l'accueil, "C'est la fête de Louis et Louis" quand deux proches portaient
le même prénom. Le compteur d'anniversaires affichait "0 anniversaire
souhaité aujourd'hui", ce qui se lisait comme un échec ; il affiche
maintenant une phrase.

Les cartes cadeaux de la grille se décalaient entre elles selon la longueur
du titre.

Les boutons ronds de l'en-tête n'étaient toujours pas centrés. Les icônes
sont redessinées et l'en-tête ne dépend plus du fond dessiné par le système
derrière les boutons.

L'écran de modification d'un événement affichait "Modifier - Nom" avec un
tiret superflu.

À vérifier : les en-têtes sur plusieurs écrans (carte, événement,
conversation), en thème clair comme en thème sombre.

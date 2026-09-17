# Notes TestFlight — à tester

Version 2.0.0, build 44.

Les testeurs viennent du build 43 : le bloc court ne couvre donc que 2.0.0.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous tient dans cette limite : c'est celui à coller.

  ⚠️ Ces notes sont attachées à UN build : elles ne remontent pas toutes
  seules sur le suivant. Réécrire ce fichier à chaque build, et recoller.

  ⚠️ Ce build est le premier à s'installer nativement sur iPad
  (ios.supportsTablet = true). Les testeurs qui n'ont pas d'iPad ne verront
  aucune différence à l'écran — mais beaucoup d'écrans ont été réorganisés
  en interne, d'où la liste « à vérifier sur iPhone » plus bas.

  Volontairement absent du bloc court : le détail technique (composants
  extraits, calcul du décalage clavier, seuils de largeur). Voir la section
  de référence.
-->

## Version courte — à coller dans TestFlight

BirthReminder 2.0.0 (build 44)

Ce build fait entrer BirthReminder sur iPad. Sur iPhone, rien ne change à l'écran — mais beaucoup d'écrans ont été retouchés en interne : si quelque chose te semble bizarre, même sans rapport avec l'iPad, signale-le.

— SI TU AS UN IPAD —
- L'app s'installe maintenant en version iPad, plus en version iPhone agrandie.
- Fiche d'une personne : la carte reste à gauche, les cadeaux s'affichent à droite. Tes idées, sa wishlist et la liste commune sont trois onglets.
- « Discuter » et « Organiser un événement » s'ouvrent aussi à droite, sans quitter la fiche.
- Page d'un événement à l'horizontale : l'événement à gauche, et à droite le chat, les cadeaux, les invitations, la cagnotte ou les réglages de notifications selon le bouton.
- Accueil : 3 colonnes d'anniversaires à la verticale, 4 à l'horizontale.
- Les formulaires ne s'étirent plus sur toute la largeur.
- À vérifier surtout : tourner l'iPad en pleine saisie, ouvrir le clavier dans une discussion affichée à droite, et le Split View avec une autre app (l'app doit revenir à une seule colonne sans rien perdre).

— SUR IPHONE : RIEN NE DOIT AVOIR CHANGÉ —
Merci de refaire un tour rapide sur :
- une discussion privée (envoi, réactions, appui long, clavier) ;
- le chat d'un événement ;
- la création d'un événement, puis l'écran d'invitation qui suit ;
- les réglages de notifications d'un événement ;
- une cagnotte : configuration côté organisateur, participation côté invité ;
- l'invitation d'amis à un événement ;
- l'ouverture d'un cadeau et la fenêtre qui glisse depuis le bas.
Si l'un de ces écrans s'ouvre vide, affiche un mauvais titre ou revient au mauvais endroit, c'est exactement ce qu'on cherche.

— CORRECTIONS —
- Les fenêtres qui glissent depuis le bas se fermaient de travers après une rotation d'écran.
- Dans une discussion en panneau, le clavier recouvrait le champ de saisie.

## Référence — détail technique (ne pas coller)

### Ce que contient le build

- `ios.supportsTablet: true`. Expo autorise alors les 4 orientations sur iPad
  et le multitâche (`UISupportedInterfaceOrientations~ipad`). L'iPhone reste
  verrouillé en portrait : aucune dépendance native ajoutée.
- `lib/use-split-view.ts` : deux panneaux si largeur ≥ 600 **et** hauteur ≥ 600
  (la condition de hauteur évite un iPhone Pro Max à l'horizontale), plus une
  option `landscapeOnly` utilisée par la page d'un événement. Réglage
  utilisateur prévu, stocké en SecureStore, pas encore exposé dans le Profil.
- `lib/layout.ts` : largeurs maximales centrées — 480 (authentification),
  560 (formulaires), 760 (listes et textes). Appliquées à une trentaine
  d'écrans via `contentContainerStyle`.
- Grille d'accueil : 2 / 3 / 4 colonnes selon la largeur (seuils 820 et 1100).
  La `FlatList` est recréée via sa `key` au changement de colonnes — React
  Native refuse de changer `numColumns` à chaud, d'où un retour en haut de
  liste à la rotation.

### Écrans extraits en composants réutilisables

Le contenu n'a pas changé ; seule leur enveloppe est devenue un composant, pour
servir à la fois d'écran plein et de panneau. C'est ici que peuvent se cacher
des régressions iPhone :

| Composant | Route qui l'utilise encore en plein écran |
|---|---|
| `components/DMChat.tsx` | `app/chat/[friendId].tsx` |
| `components/EventChat.tsx` | `app/event/chat/[shortId].tsx` |
| `components/NewEventForm.tsx` | `app/event/new.tsx` |
| `components/EventInviteFriends.tsx` | `app/event/invite/[shortId].tsx` |
| `components/EventNotificationsSettings.tsx` | `app/event/notifications/[shortId].tsx` |
| `components/PoolConfig.tsx` | `app/event/pool-config/[shortId].tsx` |
| `components/PoolContribute.tsx` | `app/event/pool/[shortId].tsx` |

En mode panneau (`embedded`), ces composants n'écrivent pas dans l'en-tête de
la pile — il appartient à l'écran hôte — et affichent leur titre et leurs
actions dans une barre interne.

### Le piège du clavier (corrigé)

`KeyboardAvoidingView` mesure sa vue par rapport à son parent et le clavier par
rapport à la fenêtre. En plein écran les deux repères coïncident ; dans un
panneau, le parent commence sous l'en-tête de l'écran hôte, et le champ de
saisie restait caché derrière le clavier. `DMChat` et `EventChat` mesurent
donc leur position dans la fenêtre (`measureInWindow`) et la passent en
`keyboardVerticalOffset`. Si un trou apparaît au-dessus du clavier, c'est cette
mesure qu'il faut regarder en premier.

### Reste à faire

- Interrupteur « Affichage deux panneaux » dans le Profil (le mécanisme existe).
- Les onglets Accueil, Événements et Messages ne se divisent pas encore
  (liste à gauche / détail à droite).
- La page d'un événement déjà créé reste en plein écran quand on l'ouvre
  depuis une carte.
- Numérotation : `app.json` reste en `version: "1.0.0"` alors que le changelog
  interne annonce 2.0.0. Seul `buildNumber` est incrémenté (44).

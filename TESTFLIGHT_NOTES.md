# Notes TestFlight — à tester

Version 2.3.1, build 49.

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous en fait ~1 100 : c'est celui à coller.

  ⚠️ Ces notes sont attachées à UN build : elles ne remontent pas toutes
  seules sur le suivant. Réécrire ce fichier à chaque build, et recoller.

  ⚠️ Build obligatoire (pas de mise à jour à chaud dans l'app) : le calendrier
  des fêtes du mode sans compte est embarqué dans l'app.

  ⚠️ Avant l'archive : si le calendrier a été modifié dans l'admin depuis,
  Exporter JSON → remplacer server/data/namedays/fr.json →
  node scripts/build-namedays.js, sinon l'app part avec l'ancienne copie.
-->

## Version courte — à coller dans TestFlight

BirthReminder 2.3.1 (build 49)

— FÊTES —
Nouveau calendrier des fêtes, plus complet et vérifié. Certains prénoms étaient fêtés à la mauvaise date, d'autres pas du tout.

À tester :
- Créez une carte « Mia » : fête le 15 août (avant : 29 septembre). « Arthur » : 15 novembre.
- « Jean marc » avec un espace : fête le 25 avril, comme « Jean-Marc ».
- Choisissez vous-même une autre date de fête sur une carte : elle ne doit plus jamais changer toute seule.
- Sans compte : Profil → Rappels, le texte doit annoncer les fêtes à 9h. Une fête programmée doit sonner à 9h, un anniversaire toujours à minuit.
— SUPPORT DANS L'APP —
- Envoyez un message au support (ou un signalement de fête) : un onglet « Support » apparaît dans Messages, avec la conversation.
- Quand je vous réponds, vous devez recevoir une notification ; en la touchant, la conversation s'ouvre. Répondez-moi depuis l'app.
- Une conversation fermée ne doit plus accepter de réponse, mais proposer « Nouveau sujet ».

— SIGNALER UNE FÊTE —
- Avec un compte : ouvrez une carte, touchez « Fête incorrecte ? » sous la fête. Le prénom est pré-rempli ; choisissez une date et envoyez. Même chose depuis Profil → Contacter le support → « Une fête incorrecte ? ». Sans compte, ces liens ne doivent pas apparaître.

— CE QUI M'INTÉRESSE LE PLUS —
Un prénom de votre répertoire qui n'a pas de fête, ou une date qui vous semble fausse : envoyez-moi le prénom, je corrige le calendrier.

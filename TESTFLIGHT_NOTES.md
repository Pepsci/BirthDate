# Notes TestFlight — à tester

Version 2.2.0, build 47.

Les testeurs viennent du build 45 : ce bloc couvre donc **deux** mises à jour,
2.1.0 (hors ligne, build 46, jamais distribué) et 2.2.0 (mode sans compte).

<!--
  Le champ "What to Test" de TestFlight est limité à 4 000 caractères.
  Le bloc ci-dessous en fait ~2 650 : c'est celui à coller.

  ⚠️ Ces notes sont attachées à UN build : elles ne remontent pas toutes
  seules sur le suivant. Réécrire ce fichier à chaque build, et recoller.

  ⚠️ Build obligatoire (pas de mise à jour à chaud) : ajout du module natif
  expo-document-picker, utilisé par l'import de sauvegarde.

  ⚠️ Avant de distribuer : LOCAL_MODE_READY = true dans src/lib/app-mode.ts,
  sinon le mode sans compte reste invisible. Et déployer le front : les CGU
  (art. 2.4) et la politique de confidentialité (§ 2.3) parlent du mode sans
  compte.

  Volontairement absent du bloc court : le détail technique du stockage
  local, la limite iOS des 64 notifications, le format de sauvegarde.
  Voir mobile/docs/MODE_LOCAL.md.
-->

## Version courte — à coller dans TestFlight

BirthReminder 2.2.0 (build 47)

Deux mises à jour d'un coup : vous venez du build 45, ce build contient donc aussi le mode hors ligne (2.1.0), que personne n'a encore testé.

— NOUVEAU : UTILISER SANS COMPTE —
L'app s'utilise maintenant sans créer de compte : tout reste sur le téléphone, rien n'est envoyé. Pour l'essayer, déconnectez-vous, puis « Continuer sans compte » sur l'écran de connexion (ou « Utiliser sans compte » sur l'accueil).
⚠️ Utilisez de préférence un compte de test : en vous déconnectant, vous perdez les modifications faites hors ligne pas encore envoyées.

À tester :
- Créer des cartes, des idées de cadeaux, ajouter une photo, la liste d'envies, l'agenda. Le prénom doit détecter la fête tout seul (Julie → 8 avril).
- Profil → Rappels : « Envoyer un rappel de test », puis fermez l'app. La notification doit arriver 5 secondes plus tard.
- Profil → Mes données : « Exporter une sauvegarde », enregistrez le fichier, puis « Effacer toutes mes données », et réimportez-le. Tout doit revenir, photos comprises.
- Inscription avant 15 ans : mettez une date de naissance de 2015. Le formulaire doit se replier et proposer « Utiliser sans compte ».
- Reconnectez-vous ensuite à votre compte : l'app doit proposer d'importer vos cartes locales. Vérifiez qu'il n'y a pas de doublon, y compris si vous relancez l'import.
- Sans compte, il ne doit y avoir QUE deux onglets (Anniversaires, Profil), et une icône 📱 à la place de la cloche. Si vous tombez sur un écran d'erreur « Indisponible sans compte », dites-moi lequel.

— MODE HORS LIGNE (build 46, jamais testé) —
Mettez le téléphone en mode avion :
- Vos anniversaires, l'agenda et vos événements à venir restent consultables. Un bandeau indique de quand datent les données.
- Vous pouvez ajouter, modifier ou supprimer une carte : elle porte un badge « ⏳ En attente » et part toute seule au retour du réseau.
- Ouvrir l'app sans réseau ne doit plus vous déconnecter.
- Un événement jamais ouvert avant doit quand même s'afficher hors ligne.

— AUTRES NOUVEAUTÉS —
- Cartes d'événement : couleur et emoji selon le type, badge « Aujourd'hui » ou « J-3 », compte à rebours.
- « Importer depuis une liste » propose aussi votre propre liste d'envies.
- Un événement ouvert depuis un lien ou une notification a enfin un bouton retour.
- Sur iPad, modifier une carte se fait dans le panneau de droite.

— CE QUI M'INTÉRESSE LE PLUS —
Tout ce qui ressemble à une perte de données : une carte qui disparaît, une photo qui ne revient pas après un import, un doublon après l'import vers un compte. Précisez ce que vous faisiez juste avant, et si vous étiez avec ou sans compte.

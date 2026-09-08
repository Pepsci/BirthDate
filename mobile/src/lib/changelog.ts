/**
 * Notes de mise à jour affichées dans Profil → Notes de mise à jour.
 *
 * Pas d'API dédiée pour l'instant : liste statique, à compléter à chaque
 * publication notable (nouvelle version sur les stores ou changement UX
 * visible). Garder l'ordre du plus récent au plus ancien.
 */
export interface ChangelogEntry {
  version: string;
  date: string; // "AAAA-MM-JJ"
  build: string;
  title: string;
  /** Avertissement général affiché au-dessus des items (ex: dépendance serveur). */
  note?: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.6.0",
    date: "2026-09-07",
    build: "38",
    title:
      "Annulation et transfert d'événement, cagnotte remboursable, listes communes revues",
    note: "Merci de signaler tout ce qui bloque. Les points marqués ⚠️ nécessitent la nouvelle version du serveur.",
    items: [
      "🔔 Les notifications du téléphone n'ouvraient pas la bonne page : appuyer dessus ne menait nulle part. Toutes les notifications système étaient concernées, pas seulement les anniversaires — le centre de notifications dans l'application, lui, fonctionnait.",
      "🗓️ Ajouter un événement à ton agenda ne posait aucun rappel : l'entrée ne se signalait qu'à l'heure de l'événement. Ce n'était pas Apple ni Google, c'est l'application qui n'en demandait aucun. Nouveau réglage dans Profil → Réglages → Rappels du calendrier, avec un choix distinct pour les événements et pour les anniversaires.",
      "❌ ⚠️ Annuler un événement, avec un motif facultatif. L'événement n'est pas supprimé : il reste consultable, barré, et tous les invités sont prévenus par notification et par email. Il peut être rétabli. Un événement publié ne peut plus être supprimé directement — il faut l'annuler d'abord, pour que personne ne le voie disparaître sans explication.",
      "🚫 ⚠️ Un événement annulé n'accepte plus aucune participation : votes de date et de lieu, réponse de présence, propositions de cadeaux, invitations et contributions à la cagnotte sont fermés. L'organisateur recevait sinon des notifications de vote sur un événement qu'il venait d'annuler, depuis les téléphones qui n'avaient pas encore rechargé la page. Le chat reste ouvert : c'est le moment où l'on a le plus besoin de se parler.",
      "🤝 ⚠️ Transférer l'organisation d'un événement à un participant. Il doit accepter : tant qu'il n'a pas répondu, tu restes l'organisateur. La cagnotte ne suit jamais le transfert — les sommes déjà versées sont sur ton compte de paiement, à toi de les rembourser ou de les reverser, et le message envoyé aux participants le dit explicitement.",
      "💸 ⚠️ Rembourser tous les contributeurs d'une cagnotte, depuis l'écran Cagnotte. Les contributeurs récupèrent l'intégralité de ce qu'ils ont versé ; les frais du paiement d'origine, eux, ne sont pas restitués et restent à ta charge — le montant exact t'est annoncé avant que tu valides.",
      "🚪 Bouton pour quitter un événement auquel tu es invité, sous ta réponse de présence. Décliner prévient l'organisateur, quitter retire l'invitation : ce sont deux gestes différents.",
      "📋 Bouton pour copier seulement le code d'accès d'un événement, quand tu veux le coller dans une conversation déjà ouverte ailleurs.",
      "🗄️ Les événements passés sont regroupés dans une section repliable en bas de la liste, avec les événements annulés. Un événement dont la date est repoussée en ressort tout seul.",
      "🎁 ⚠️ Listes communes — les cadeaux déjà achetés ou offerts ne sont plus montrés aux invités : les leur montrer les poussait à acheter en double, ce que la liste sert précisément à éviter.",
      "🚪 ⚠️ Listes communes — un invité peut enfin quitter une liste. Le bouton existait mais le serveur refusait la demande : l'accès restait, et la liste réapparaissait au rechargement suivant.",
      "➕ ⚠️ Listes communes — quand on te partage une liste pour quelqu'un que tu n'as pas dans ton carnet, l'application te propose de créer sa carte en un geste, préremplie avec son nom et sa date de naissance. Tu pourras les corriger ensuite. La liste des cartes existantes se replie et devient cherchable au lieu de tout dérouler.",
      "📂 ⚠️ Listes communes — nouvelle entrée dans le menu Profil. Une liste partagée dont tu n'as pas terminé le rattachement s'y retrouve, même si tu as fermé la notification : elle n'était jusqu'ici accessible que depuis ce message.",
      "👤 Listes communes — « Partager à un contact » est directement dans la feuille de partage, au lieu d'être enterré dans l'écran de gestion des accès.",
      "🔔 ⚠️ Listes communes — les invités reçoivent une notification quand une idée est ajoutée, et quand un cadeau qu'ils avaient réservé est retiré. Une réservation faite depuis le lien public prévient désormais les membres : elle ne prévenait personne.",
      "📧 ⚠️ Les liens « se désabonner » des emails ne fonctionnaient pas — sauf celui des demandes d'ami, qui passait par un autre chemin.",
      "🎂 Sur l'accueil, « C'est la fête de Louis et Louis ! » quand deux proches portent le même prénom. Et à zéro, le compteur d'anniversaires affiche une phrase plutôt qu'un « 0 » qui se lisait comme un échec.",
      "🃏 Les cartes cadeaux de la grille se décalaient entre elles selon la longueur du titre.",
      "🔘 Les boutons ronds de l'en-tête n'étaient toujours pas centrés : les icônes sont redessinées, et l'en-tête ne dépend plus du fond que le système dessine derrière.",
      "✉️ Récap mensuel : une double flèche traînait sur le bouton « Voir le mois prochain ».",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-08-19",
    build: "36",
    title: "Listes communes partageables, r\u00e9servations & correctif de d\u00e9connexion",
    note: "Merci de signaler tout ce qui bloque. Les points marqu\u00e9s \u26a0\ufe0f n\u00e9cessitent la nouvelle version du serveur.",
    items: [
      "\ud83d\udd11 \u26a0\ufe0f Tu \u00e9tais d\u00e9connect\u00e9 sans raison ? La moindre modification de profil \u2014 m\u00eame un simple interrupteur de notification \u2014 ramenait ta session de 30 jours \u00e0 6 heures. Fermer l'application une nuit suffisait alors \u00e0 devoir se reconnecter. Une derni\u00e8re reconnexion sera n\u00e9cessaire, puis la session tiendra bien 30 jours.",
      "\ud83c\udf81 \u26a0\ufe0f Listes communes \u2014 r\u00e9servation : \u00ab Je m'en occupe \u00bb sur une id\u00e9e. Les autres membres la voient gris\u00e9e avec ton pr\u00e9nom, et toi seul peux annuler ta r\u00e9servation si le cadeau n'est finalement pas offert.",
      "\ud83d\udd17 \u26a0\ufe0f Listes communes \u2014 partage par lien : g\u00e9n\u00e8re un lien consultable sans compte. Un code, que tu g\u00e9n\u00e8res depuis \u00ab G\u00e9rer les acc\u00e8s \u00bb, est demand\u00e9 pour r\u00e9server ; consulter ne l'exige pas. Les visiteurs ne voient jamais qui a r\u00e9serv\u00e9 quoi.",
      "\ud83d\udc65 \u26a0\ufe0f Listes communes \u2014 partage \u00e0 un contact : il pourra consulter et r\u00e9server, jamais modifier la liste. Il la rattache \u00e0 une carte existante ou en cr\u00e9e une, et elle appara\u00eet alors dans son application.",
      "\ud83d\udd10 \u26a0\ufe0f Listes communes \u2014 gestion des acc\u00e8s : un \u00e9cran montre les membres, les invit\u00e9s et par qui ils ont \u00e9t\u00e9 invit\u00e9s, avec la possibilit\u00e9 de retirer un acc\u00e8s \u00e0 tout moment.",
      "\ud83d\uddc2\ufe0f \u26a0\ufe0f Une carte ne peut porter qu'une seule liste commune. Si tu en re\u00e7ois une seconde pour la m\u00eame personne, l'application te le dit et te propose de remplacer l'actuelle.",
      "\u21a9\ufe0f Supprimer une id\u00e9e d'une liste commune laisse maintenant quelques secondes pour annuler, comme sur tes id\u00e9es personnelles.",
      "\u2611\ufe0f \u00ab Ajouter depuis une liste \u00bb est remont\u00e9 \u00e0 c\u00f4t\u00e9 de \u00ab + Ajouter \u00bb, et le partage se fait depuis le haut de l'encart \u2014 plus besoin de d\u00e9filer jusqu'en bas sur une longue liste.",
      "\ud83d\udd14 \u26a0\ufe0f Notifications de liste commune : ajout, modification, suppression d'une id\u00e9e et d\u00e9part d'un membre. Le passage en achet\u00e9 ou offert est indiqu\u00e9 dans le texte, pour \u00e9viter d'acheter deux fois le m\u00eame cadeau. Elles ont leur propre interrupteur dans Notifications push.",
      "\ud83c\udf82 \u26a0\ufe0f Anniversaires et f\u00eates ont d\u00e9sormais chacun leur interrupteur push : ils partageaient le m\u00eame, impossible de garder l'un sans l'autre.",
      "\ud83d\udcec Dans le centre de notifications, appuyer sur une notification la fait dispara\u00eetre une fois qu'elle t'a emmen\u00e9 au bon endroit. Le bouton \u00ab D\u00e9plier / R\u00e9duire \u00bb a \u00e9t\u00e9 retir\u00e9 : il s'affichait sur des textes qui tenaient d\u00e9j\u00e0 en entier \u00e0 l'\u00e9cran.",
      "\ud83d\uddd3\ufe0f Ajout au calendrier : appuyer plusieurs fois cr\u00e9ait autant de doublons. Le bouton passe maintenant en \u00ab Dans ton calendrier \u00bb et permet de retirer l'\u00e9v\u00e9nement. Si tu supprimes l'entr\u00e9e \u00e0 la main dans ton agenda, il redevient \u00ab Ajouter \u00bb.",
      "\ud83d\udc1b Correction d'un blocage du d\u00e9filement : sur certains \u00e9crans, apr\u00e8s avoir repli\u00e9 une section ou chang\u00e9 d'onglet, le contenu restait bloqu\u00e9 en haut jusqu'\u00e0 ce qu'on change de page.",
      "\ud83d\udc1b Les boutons ronds de l'en-t\u00eate (retour, chat, crayon) \u00e9taient d\u00e9centr\u00e9s dans leur fond.",
      "\u270f\ufe0f Formulations des notifications revues, sans le tiret qui coupait les phrases : \u00ab L'organisateur a modifi\u00e9 D\u00eener \u00bb, \u00ab Nouveaux messages dans D\u00eener \u00bb.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-16",
    build: "34",
    title:
      "Notifications réparées, ajout au calendrier & présences des événements",
    note: "Merci de signaler tout ce qui bloque. Les points marqués ⚠️ nécessitent la nouvelle version du serveur.",
    items: [
      "🔔 ⚠️ Notifications : couper un réglage de la section email coupait aussi les notifications push et le centre de notifications. Les trois canaux sont maintenant indépendants — un réglage \"email\" ne concerne plus que les emails. Si tu ne recevais plus rien depuis que tu avais désactivé un rappel, c'était ça.",
      "📱 ⚠️ Les interrupteurs de la section Notifications push n'avaient en réalité aucun effet : ils sont désormais respectés. Et couper le push ne se réactive plus tout seul au redémarrage de l'application.",
      "🗓️ Nouveau bouton \"Ajouter à mon calendrier\" sur la page d'un événement et dans l'agenda : l'événement est créé dans le calendrier du téléphone. Rien n'est synchronisé ensuite — si la date change, il faut réappuyer.",
      "👤 ⚠️ L'organisateur d'un événement figure maintenant parmi les participants : le décompte comptait tout le monde sauf l'hôte.",
      "📅 ⚠️ Quand l'organisateur change la date d'un événement, les réponses de présence repassent en attente et chacun est invité à reconfirmer. Les invités sans compte sont prévenus par email.",
      "✏️ ⚠️ Dans le centre de notifications, la modification d'un événement s'affichait comme un \"Rappel\". Elle apparaît désormais comme \"Événement modifié\", et un changement de date est annoncé comme tel.",
      "📤 Partage d'une carte ou d'idées cadeaux : appuyer sur un nom l'envoyait aussitôt, sans retour possible. Il faut maintenant sélectionner le destinataire, puis confirmer avec le bouton \"Envoyer à …\".",
      "👥 ⚠️ Amis → Envoyées : le nombre de demandes en attente est affiché sur l'onglet, et chaque demande d'ami ou invitation par email peut être annulée.",
      "🐛 Le chevron du bouton retour n'était pas centré dans son rond.",
      "🐛 Le bouton d'action en haut à droite (crayon, chat, corbeille) prenait parfois une forme allongée, jusqu'à ce qu'on change de page.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-14",
    build: "33",
    title: "Fête du jour, photo sur les cartes & aperçu rapide dans le chat",
    note: "Merci de signaler tout ce qui bloque. Les points marqués ⚠️ nécessitent la nouvelle version du serveur.",
    items: [
      "🎉 ⚠️ Réglages → Affichage accueil : le toggle \"Afficher la fête du jour\" ne contrôle désormais que le bandeau sur l'écran d'accueil — il n'a plus aucun effet sur les emails de rappel de fêtes. Le bandeau se cache et se réaffiche maintenant correctement en le basculant.",
      "🔔 ⚠️ Notifications → \"Rappels de fêtes\" : ce toggle était mélangé avec celui des anniversaires et ne sauvegardait pas son état. Il est maintenant indépendant et fonctionne correctement, sur mobile comme sur le site.",
      "🖼️ ⚠️ Photo sur une carte ajoutée manuellement : possible depuis la fiche de la personne, en plus de sur le site.",
      "💬 Nouvel aperçu rapide dans une conversation : appuyer sur le nom du contact en haut de l'écran ouvre une carte avec son âge, son prochain anniversaire, ses idées cadeaux, et un bouton \"Voir le profil\" pour y accéder directement.",
      "🔴 Le badge sur l'icône de l'application affiche maintenant le nombre de messages et notifications non lus.",
      "🎂 ⚠️ Les notifications de rappel d'anniversaire et de fête ouvraient la mauvaise page : elles redirigent maintenant correctement vers la carte de la personne concernée.",
      "🐛 Correction d'un bas de page tronqué sur l'écran Notifications.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-09",
    build: "31",
    title: "Notifications repliables & cagnottes mises en avant",
    items: [
      "🐛 Correction d'un bug de défilement : sur certains écrans (notifications, wishlist, événement), il était impossible de remonter après avoir défilé jusqu'en bas.",
      "🔔 Les notifications peuvent maintenant être repliées/dépliées individuellement, et supprimées d'un tap (plus besoin d'appui long).",
      "🎂 Nouveau : active/désactive les rappels d'anniversaire personne par personne depuis Profil → Notifications.",
      "🔽 Les sections Notifications email, Notifications push et Rappels par personne se replient désormais aussi individuellement, et leur état est mémorisé quand tu quittes puis reviens sur l'écran.",
      "📌 Les encarts d'un événement (cagnotte, invitations, participants…) gardent maintenant leur état replié/déplié quand tu reviens sur la page.",
      "💰 La cagnotte est maintenant présentée sur l'écran d'accueil (avant connexion) et sur le site web, qui la donnait encore comme fonctionnalité à venir.",
      "📝 Ajout de cet écran de notes de mise à jour.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-08",
    build: "30",
    title: "Statistiques, partage de carte, blocage renforcé & confidentialité",
    note: "Merci de signaler tout ce qui bloque, même mineur. Les points marqués ⚠️ nécessitent la nouvelle version du serveur : si quelque chose y échoue, ça peut venir de là.",
    items: [
      "📊 Statistiques d'accueil corrigées : les chiffres étaient lus comme personnels alors qu'ils concernaient toute la communauté. Les libellés sont désormais explicites (\"anniversaires souhaités aujourd'hui\"). Nouveau réglage Profil → Réglages : \"Afficher mes statistiques\", qui bascule l'encart sur tes propres chiffres, avec les prénoms sous le total.",
      "🎉 Fête modifiable : le champ existe désormais aussi sur mobile, à l'ajout comme à la modification d'une carte (sélecteur mois puis jour). Sans y toucher, la fête reste détectée automatiquement depuis le prénom.",
      "📤 ⚠️ Partage d'une carte : nouveau bouton \"Partager cette carte\" sur la fiche d'une personne, envoyée dans ta conversation. Tes idées cadeaux ne sont jamais transmises. Pour une personne inscrite : elle peut t'envoyer une demande d'ami à accepter, sa carte se crée alors automatiquement des deux côtés. Sinon, elle peut simplement créer la carte chez elle.",
      "🗑️ Retirer une conversation : appui long sur une conversation (onglet Messages). Le retrait ne vaut que pour toi, ton correspondant garde son historique — volontaire, pour que personne ne puisse effacer des messages chez quelqu'un d'autre, notamment ceux servant de preuve après un signalement. Un nouveau message fait réapparaître la conversation, avec les nouveaux messages seulement.",
      "❌ ⚠️ Suppression de compte : même principe — tes conversations sont retirées de ton côté, tes correspondants gardent leur copie où tes messages apparaissent sous la mention \"Utilisateur supprimé\".",
      "🚫 ⚠️ Blocage renforcé : bloquer quelqu'un masquait la conversation mais la personne pouvait continuer à écrire sans le savoir. Le blocage empêche désormais aussi les messages, les demandes d'ami et les invitations à un événement ou à une liste commune.",
      "⬇️ ⚠️ Télécharger mes données : Profil → \"Télécharger mes données\" génère un fichier avec ton profil, tes dates, tes amis, tes cadeaux, tes événements et tes conversations. Tes messages sont chiffrés de bout en bout, nos serveurs ne peuvent pas les lire : ils sont déchiffrés sur ton appareil. Depuis un appareil où ta clé n'a pas été restaurée, ils apparaîtront comme non déchiffrables, c'est normal.",
      "🔑 Mot de passe : un bouton \"Afficher\" révèle ce que tu tapes dans les trois champs de changement de mot de passe. L'écran de réinitialisation précise désormais que le chiffrement maximum (phrase de 12 mots) permet de retrouver les anciens messages, contrairement au chiffrement standard où ils deviennent illisibles.",
      "🎁 Wishlist : le champ \"URL de l'image\" manquait sur mobile alors qu'il existait sur le site. Tu peux désormais coller un lien d'image à la main, en plus du bouton \"Remplir\".",
      "📖 Guide et textes : le guide (Profil → Guide) couvre maintenant la cagnotte, le chiffrement et la phrase de récupération, le partage de carte, le signalement et le blocage. Conditions d'utilisation, politique de confidentialité et cookies ont été mis à jour.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-01",
    build: "1",
    title: "Lancement de l'application",
    items: [
      "🎉 Première version de l'application mobile BirthReminder.",
      "🎂 Suivi des anniversaires et fêtes de tes proches.",
      "🎁 Wishlists, propositions de cadeaux et réservations.",
      "📅 Organisation d'événements : votes de date/lieu, invitations, cagnottes.",
      "💬 Messagerie privée et de groupe.",
    ],
  },
];

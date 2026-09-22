// Contenu de la FAQ, partagé entre le Guide (/guide, référence complète) et
// le centre d'aide du support (/contact, recherche guidée avant d'écrire).
// Une seule source : ajoute ou modifie une question ici, elle apparaît aux
// deux endroits. Voir front/src/data/faqData.js pour l'équivalent web (le
// contenu diffère un peu, adapté au vocabulaire de chaque plateforme).

export interface QA {
  q: string;
  a: string;
  /** Marche à suivre numérotée, quand la réponse est une procédure. */
  steps?: string[];
}

export interface Section {
  id: string;
  emoji: string;
  title: string;
  items: QA[];
  /**
   * Action propre à la catégorie. Un litige portant sur de l'argent mérite un
   * chemin direct vers le support, pas la sortie générique « je n'ai pas
   * trouvé ma réponse ».
   */
  action?: { kind: "poolIssue"; label: string };
}

export const FAQ_SECTIONS: Section[] = [
  {
    id: "local",
    emoji: "📱",
    title: "Utiliser sans compte",
    items: [
      {
        q: "Peut-on utiliser BirthReminder sans compte ?",
        a: "Oui, sur l'application mobile. Choisis « Utiliser sans compte » à l'accueil (ou « Continuer sans compte » sur l'écran de connexion). Tes cartes, idées de cadeaux, photos et ta liste d'envies restent sur ton téléphone : rien n'est envoyé à nos serveurs. C'est aussi possible avant 15 ans, puisqu'aucune donnée n'est collectée.",
      },
      {
        q: "Qu'est-ce qui ne marche pas sans compte ?",
        a: "Tout ce qui relie plusieurs personnes : amis, chat, événements, listes communes, cagnottes, wishlist publique et réservation de cadeaux. Pas d'accès depuis le site web ni de synchronisation entre plusieurs appareils non plus.",
      },
      {
        q: "Comment fonctionnent les rappels sans compte ?",
        a: "C'est ton téléphone qui les programme, à minuit, selon les réglages de chaque carte. Il les prévoit sur les 60 jours qui viennent : ouvre l'app de temps en temps pour qu'il programme la suite. Si elle reste fermée trop longtemps, une notification te le rappelle. Profil → Rappels pour vérifier et envoyer un rappel de test.",
      },
      {
        q: "Comment sauvegarder mes cartes ?",
        a: "Sans compte, tes données n'existent que sur ce téléphone : si tu le perds ou supprimes l'app, elles disparaissent. Fais des sauvegardes régulières.",
        steps: [
          "Profil → Mes données (sauvegarde)",
          "« Exporter une sauvegarde »",
          "Enregistre le fichier dans Fichiers, iCloud Drive, ou envoie-le-toi par mail",
          "Pour restaurer : même écran → « Importer une sauvegarde » (photos comprises)",
        ],
      },
      {
        q: "Et si je crée un compte plus tard ?",
        a: "Après ta connexion, l'app te propose d'importer tes cartes dans ton compte, avec leurs idées de cadeaux, leurs photos et leurs rappels. Une carte déjà présente dans ton compte n'est pas recréée. Tes cartes ne sont retirées du téléphone qu'une fois toutes bien arrivées.",
      },
    ],
  },
  {
    id: "dates",
    emoji: "🎂",
    title: "Ajouter une date",
    items: [
      {
        q: "Comment ajouter un anniversaire ?",
        a: "Depuis l'onglet Anniversaires, appuie sur le bouton ＋ en haut à droite. Renseigne un prénom, une date et éventuellement la relation (famille, ami…).",
      },
      {
        q: "Comment modifier ou supprimer une date ?",
        a: "Appuie sur une carte pour ouvrir sa fiche. Pour une date manuelle, tu y trouveras les options de modification et de suppression.",
      },
      {
        q: "Les anniversaires de mes amis s'ajoutent-ils tout seuls ?",
        a: "Oui ! Dès qu'un ami accepte ta demande, son anniversaire apparaît automatiquement dans ta liste avec un badge AMI.",
      },
    ],
  },
  {
    id: "friends",
    emoji: "👥",
    title: "Amis & demandes",
    items: [
      {
        q: "Comment ajouter un ami ?",
        a: "Va dans l'onglet Profil → Mes amis. Recherche une personne par son email et envoie-lui une demande.",
      },
      {
        q: "Où voir mes demandes reçues ?",
        a: "Un badge rouge sur la cloche 🔔 (en haut) t'indique les demandes en attente. Ouvre Profil → Mes amis → onglet Reçues.",
      },
      {
        q: "Puis-je ouvrir la fiche d'un ami ?",
        a: "Oui, appuie sur son nom dans Mes amis, ou sur sa carte depuis l'accueil.",
      },
    ],
  },
  {
    id: "wishlist",
    emoji: "🎁",
    title: "Wishlist & cadeaux",
    items: [
      {
        q: "Comment créer ma liste de souhaits ?",
        a: "Va dans Profil → Ma wishlist et ajoute tes envies (titre, prix, lien du produit).",
      },
      {
        q: "Comment voir la wishlist d'un ami ?",
        a: "Ouvre sa carte → bouton Voir les cadeaux → onglet « Sa wishlist ».",
      },
      {
        q: "Comment réserver un cadeau ?",
        a: "Dans la wishlist d'un ami, appuie sur un cadeau disponible puis « Je réserve ». Les cadeaux déjà réservés par d'autres sont masqués.",
      },
      {
        q: "Comment gérer mes idées cadeaux pour quelqu'un ?",
        a: "Sur sa carte → Voir les cadeaux → « Mes idées ». Tu peux ajouter, filtrer par occasion et changer le statut (À acheter, Acheté, À offrir, Offert).",
      },
    ],
  },
  {
    id: "events",
    emoji: "🎉",
    title: "Événements",
    items: [
      {
        q: "Comment créer un événement ?",
        a: "Onglet Événements → ＋, ou depuis la carte d'une personne → Organiser un événement.",
      },
      {
        q: "Comment inviter du monde ?",
        a: "Sur la page de l'événement : « Inviter mes amis » (depuis ta liste) ou « Partager le lien + code ». Les invités peuvent aussi inviter si tu l'autorises.",
      },
      {
        q: "À quoi sert la sélection de cadeaux ?",
        a: "En tant qu'organisateur, tu peux « Retenir » un ou plusieurs cadeaux proposés ; ils sont marqués ⭐ pour tout le monde.",
      },
      {
        q: "Comment fonctionne la cagnotte ?",
        a: "L'organisateur peut ouvrir une cagnotte en connectant son compte Stripe (paiements sécurisés). Les invités peuvent ensuite participer directement depuis la page de l'événement, et chacun voit le total collecté.",
      },
      {
        q: "Comment annuler un événement ?",
        a: "Sur la page de l'événement → Annuler l'événement. Tu peux joindre une raison, transmise telle quelle ; sans elle, les invités reçoivent un message générique. Tout le monde est prévenu par notification, push et email.",
      },
      {
        q: "Que devient un événement annulé ?",
        a: "Il passe dans les événements passés avec un bandeau « Annulé », et plus personne ne peut y voter, répondre, proposer un cadeau ou contribuer. Rien n'est effacé : tu peux le réactiver, ou le supprimer définitivement une fois annulé.",
      },
      {
        q: "Puis-je confier l'organisation à quelqu'un d'autre ?",
        a: "Oui : propose le rôle à un participant depuis la page de l'événement. Il doit l'accepter pour que le transfert soit effectif ; tant qu'il n'a pas accepté, rien ne change.",
      },
      {
        q: "Que devient la cagnotte si je transmets l'organisation ?",
        a: "Elle est gelée et tes coordonnées bancaires sont retirées de l'événement. L'argent déjà collecté reste sur TON compte Stripe — il ne suit pas le rôle. C'est à toi de le reverser ou de le rembourser, et le nouvel organisateur peut ouvrir sa propre cagnotte. Tous les participants sont prévenus.",
      },
      {
        q: "Comment quitter un événement ?",
        a: "Depuis la page de l'événement → Quitter l'événement. Tu ne recevras plus ses notifications. Si tu as contribué à la cagnotte, quitter ne te rembourse pas : demande-le à l'organisateur.",
      },
    ],
  },
  {
    id: "cagnotte",
    emoji: "💶",
    title: "Cagnotte : ce qu'il faut savoir",
    action: {
      kind: "poolIssue",
      label: "Un souci avec ta participation à une cagnotte ?",
    },
    items: [
      {
        q: "J'ai un problème avec ma participation : que dois-je faire ?",
        a: "BirthReminder ne détient jamais l'argent d'une cagnotte : il est encaissé directement par l'organisateur. Nous ne pouvons donc pas rembourser à sa place, ni trancher un désaccord — mais nous pouvons prouver que tu as payé, et relancer l'organisateur. Suis les étapes dans l'ordre, la plupart des situations se règlent à la première.",
        steps: [
          "Contacte l'organisateur. Il est le seul à détenir les fonds et le seul à pouvoir déclencher le remboursement. Donne-lui la référence de ta contribution : tu la trouves dans « Mes contributions », avec un bouton qui prépare le message pour toi.",
          "Écris-nous si tu restes sans réponse. Nous confirmons le paiement, vérifions que le compte de l'organisateur existe toujours et le relançons.",
          "Saisis un conciliateur de justice si le désaccord persiste. C'est gratuit, cela se demande auprès de ta mairie, et c'est un préalable obligatoire avant toute action en justice pour les litiges de moins de 5 000 €.",
          "Conteste le paiement auprès de ta banque en dernier recours seulement : cette démarche fait supporter des frais à l'organisateur, en plus du montant repris.",
          "Dépose plainte si tu penses avoir été victime d'une escroquerie — événement inventé, organisateur disparu avec les fonds. Signale-le-nous aussi : nous gelons la cagnotte concernée.",
        ],
      },
      {
        q: "Où va l'argent des contributions ?",
        a: "Directement sur le compte de l'organisateur, via notre prestataire Stripe. BirthReminder ne détient jamais les fonds et ne prélève aucune commission.",
      },
      {
        q: "Pourquoi dois-je vérifier mon identité pour ouvrir une cagnotte ?",
        a: "C'est une obligation légale pour encaisser de l'argent. Stripe vérifie ton identité et tes coordonnées bancaires, ce qui protège aussi tes invités.",
      },
      {
        q: "Et si l'événement est annulé ?",
        a: "La cagnotte est gelée immédiatement : plus aucune contribution n'est possible. L'organisateur reste responsable de rembourser, et dispose d'un bouton « Tout rembourser » qui rend à chacun l'intégralité de ce qu'il a versé. Comme nous ne détenons pas les fonds, nous ne pouvons pas le faire à sa place : ne contribue qu'à des cagnottes ouvertes par des personnes que tu connais.",
      },
      {
        q: "Combien me coûte un remboursement en tant qu'organisateur ?",
        a: "Le contributeur récupère 100 % de ce qu'il a payé, mais Stripe ne te restitue pas les frais de la transaction d'origine : environ 1,5 % du montant plus 0,25 € par contribution restent à ta charge. L'application te montre ce total AVANT que tu lances l'opération.",
      },
      {
        q: "Comment savoir que j'ai été remboursé ?",
        a: "Tu reçois une notification dès que le remboursement est enregistré, et ta contribution passe en « remboursée » sur la page de l'événement. Le crédit apparaît ensuite sur ton relevé sous 5 à 10 jours ouvrés selon ta banque. Attention : si le remboursement intervient peu après ton paiement, ta banque peut simplement annuler l'opération d'origine au lieu de créditer une somme. Dans ce cas tu ne verras aucun remboursement arriver — c'est le paiement lui-même qui disparaît de ton relevé. C'est normal, et le compte est bon.",
      },
      {
        q: "Un remboursement est-il possible sur une cagnotte par virement ?",
        a: "Non. L'application ne voit pas ces virements et ne peut rien rembourser : tout se règle de banque à banque, directement avec l'organisateur.",
      },
      {
        q: "Puis-je collecter par virement plutôt que par carte ?",
        a: "Oui, en partageant ton RIB. Attention : ces virements se font de banque à banque, hors de l'application. Aucune trace n'en est conservée et rien ne pourra être prouvé en cas de désaccord.",
      },
      {
        q: "Puis-je utiliser une cagnotte que j'ai déjà ouverte ailleurs ?",
        a: "Oui. Dans les réglages de la cagnotte, active « Cagnotte sur un autre service » et colle le lien (Leetchi, Lydia, Le Pot Commun…). Il s'affichera sur la page de l'événement, visible par tous les invités, y compris ceux qui arrivent plus tard — contrairement à un lien collé dans le chat, qui disparaît sous les messages.",
      },
      {
        q: "Qu'est-ce que ça change de passer par une cagnotte externe ?",
        a: "Tout se déroule sur le service choisi : BirthReminder n'en voit ni les montants, ni les participants. Nous ne pouvons rien confirmer en cas de désaccord, aucun reçu n'est envoyé, rien n'apparaît dans « Mes contributions », et aucun remboursement n'est possible depuis l'application. C'est un simple lien affiché — pratique, mais sans aucune des garanties de la cagnotte intégrée.",
      },
      {
        q: "Comment savoir où m'envoie un lien de cagnotte externe ?",
        a: "Le vrai domaine du site est affiché sous le bouton, en petit. Le nom de la cagnotte est choisi par l'organisateur et ne prouve rien : c'est le domaine qu'il faut regarder avant de cliquer. Dans le doute, demande à l'organisateur.",
      },
      {
        q: "Puis-je participer sans que mon nom apparaisse ?",
        a: "Oui, ta contribution peut être anonyme ou faite sous un pseudonyme, y compris vis-à-vis de l'organisateur.",
      },
    ],
  },
  {
    id: "encryption",
    emoji: "🔒",
    title: "Chiffrement des messages",
    items: [
      {
        q: "Qui peut lire mes messages ?",
        a: "Seulement toi et ton correspondant. Les messages sont chiffrés de bout en bout : nos serveurs ne stockent que du texte chiffré, illisible pour nous.",
      },
      {
        q: "À quoi sert la phrase de 12 mots ?",
        a: "Dans Profil → Chiffrement, le mode maximum génère une phrase de récupération de 12 mots. Note-la et garde-la en lieu sûr, hors de ton téléphone : elle permet de retrouver tes messages sur un nouvel appareil.",
      },
      {
        q: "Que se passe-t-il si j'oublie mon mot de passe ?",
        a: "En mode standard, ta clé est protégée par ton mot de passe : le réinitialiser rend définitivement illisibles les messages échangés jusque-là. En mode maximum, tu ressaisis ta phrase de 12 mots et tu retrouves tout.",
      },
      {
        q: "Et si je perds ma phrase de récupération ?",
        a: "Personne ne peut la retrouver, pas même nous — c'est précisément ce qui rend tes messages illisibles par des tiers. Sans elle ni ton mot de passe, les anciens messages sont perdus.",
      },
    ],
  },
  {
    id: "sharing",
    emoji: "📤",
    title: "Partage & liste commune",
    items: [
      {
        q: "Comment partager une carte anniversaire ?",
        a: "Depuis la fiche d'une personne → Partager cette carte. Ton ami reçoit dans le chat le prénom, la date de naissance et la fête. Tes idées cadeaux ne sont jamais transmises.",
      },
      {
        q: "Que peut faire celui qui la reçoit ?",
        a: "L'ajouter à ses propres anniversaires. Si la personne concernée a un compte, il peut aussi lui envoyer une demande d'ami, qu'elle devra accepter.",
      },
      {
        q: "À quoi sert une liste de cadeaux commune ?",
        a: "À préparer les cadeaux d'un proche à plusieurs : vous voyez et modifiez la même liste, ce qui évite les doublons. Lance-la depuis la fiche de la personne → Liste commune.",
      },
      {
        q: "Quelle différence entre un gestionnaire et un invité ?",
        a: "Un gestionnaire ajoute, modifie et supprime des idées, et gère les accès. Un invité consulte et réserve, rien de plus : il ne voit ni les cadeaux déjà achetés ou offerts, ni qui a réservé quoi.",
      },
      {
        q: "Où retrouver mes listes communes ?",
        a: "Profil → Listes communes. Tu y vois celles que tu gères et celles où tu es invité, et tu peux les ouvrir directement ou les quitter.",
      },
      {
        q: "À quoi sert « Je m'en occupe » ?",
        a: "À signaler aux autres que tu prends ce cadeau en charge, pour que personne ne l'achète en double. Tu peux libérer ta réservation à tout moment, et un gestionnaire peut libérer celle de quelqu'un d'autre — utile quand la personne ne revient jamais.",
      },
      {
        q: "Comment partager la liste à quelqu'un sans compte ?",
        a: "Active le lien public depuis Partager. Si la liste a un code d'accès, le lien seul ne montre rien tant que le code n'est pas saisi : utilise « Envoyer le lien (code inclus) » pour tout transmettre en une fois. Changer le code invalide les liens déjà envoyés qui le contenaient.",
      },
      {
        q: "Puis-je cacher une idée aux invités ?",
        a: "Oui : ouvre l'idée puis « Masquer aux invités ». Elle reste visible des gestionnaires, marquée 🙈, mais disparaît pour les invités et pour le lien public.",
      },
      {
        q: "Comment m'y retrouver dans une longue liste ?",
        a: "Le filtre croise deux critères : l'occasion, et l'état de réservation (libres, réservées, ou celles dont tu t'occupes). Les cadeaux déjà offerts descendent sous un trait en bas : ils ne sont pas supprimés, c'est la mémoire de ce qui a déjà été offert.",
      },
      {
        q: "Que se passe-t-il si je quitte une liste commune ?",
        a: "Elle est retirée de ta carte et tu n'en vois plus les idées. Les autres membres la conservent, et il faudra qu'on te la repartage pour y revenir.",
      },
    ],
  },
  {
    id: "security",
    emoji: "🛡️",
    title: "Sécurité & modération",
    items: [
      {
        q: "Comment signaler un message ou une personne ?",
        a: "Appui long sur un message, ou depuis le profil de la personne → Signaler, en précisant le motif. Chaque signalement est examiné, en principe sous 72 heures.",
      },
      {
        q: "Que fait le blocage ?",
        a: "La personne bloquée ne peut plus t'envoyer de messages, de demandes d'ami ni d'invitations. Elle n'en est pas informée. Tu gères tes blocages dans Profil → Utilisateurs bloqués.",
      },
      {
        q: "Que se passe-t-il si je retire une conversation ?",
        a: "Appui long sur une conversation pour la retirer de ta liste. Elle disparaît de ton côté, mais ton correspondant garde sa copie : personne ne peut effacer des messages chez quelqu'un d'autre, surtout s'ils servent de preuve après un signalement.",
      },
    ],
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "Notifications",
    items: [
      {
        q: "Comment gérer les rappels par email ?",
        a: "Profil → Notifications email. Choisis d'être rappelé 30, 14, 7, 3, 1 jour(s) avant, ou le jour J.",
      },
      {
        q: "Les notifications push sont-elles natives ?",
        a: "Oui. Accepte la permission de notifications au lancement de l'app. Tu peux régler les rappels par date depuis la fiche d'une personne.",
      },
      {
        q: "Les messages sont-ils lisibles dans les notifs ?",
        a: "Les messages sont chiffrés de bout en bout et déchiffrés sur ton téléphone : le texte s'affiche directement dans la notification, comme sur WhatsApp.",
      },
    ],
  },
  {
    id: "account",
    emoji: "⚙️",
    title: "Mon compte",
    items: [
      {
        q: "Comment modifier mes informations ?",
        a: "Profil → Mes informations (prénom, nom, date de naissance, avatar).",
      },
      {
        q: "Comment changer mon mot de passe ?",
        a: "Profil → Changer mon mot de passe. Ton mot de passe actuel te sera demandé.",
      },
      {
        q: "Comment récupérer une copie de mes données ?",
        a: "Profil → Télécharger mes données. Tu obtiens un fichier avec ton profil, tes dates, tes amis, tes cadeaux, tes événements et tes conversations. Tes messages sont déchiffrés par ton téléphone au moment de l'export.",
      },
      {
        q: "Comment supprimer mon compte ?",
        a: "Profil → tout en bas → Supprimer mon compte. Conforme au RGPD : tes données sont supprimées/anonymisées.",
      },
      {
        q: "Qu'advient-il de mes conversations si je supprime mon compte ?",
        a: "Elles sont retirées de ton côté, mais tes correspondants gardent leur copie des échanges. Tes messages y apparaîtront sous la mention « Utilisateur supprimé ».",
      },
    ],
  },
];

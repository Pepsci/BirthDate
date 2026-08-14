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
    version: "1.3.0",
    date: "2026-08-12",
    build: "32",
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

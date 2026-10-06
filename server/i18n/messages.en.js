/**
 * Messages renvoyés par les routes (`res.json({ message })`), en anglais.
 *
 * Les routes continuent d'écrire leurs messages en français, comme avant :
 * c'est middleware/translateErrors.js qui, pour une requête en anglais
 * (en-tête X-App-Language de l'app mobile), remplace le texte par sa
 * traduction s'il figure ici. Un message absent de ce fichier part en
 * français : rien ne casse, il manque juste une ligne à ajouter.
 *
 * - EXACT : texte français complet → texte anglais.
 * - PATTERNS : messages contenant une valeur (nom, nombre, date).
 *
 * En ajoutant un message d'erreur dans une route, ajouter sa traduction ici.
 */
const EXACT = {
  // ── Génériques ───────────────────────────────────────────────────────────
  "Erreur serveur": "Server error",
  "Erreur serveur.": "Server error.",
  "Internal server error": "Server error",
  "Internal Server Error": "Server error",
  "Non autorisé": "Not allowed",
  "Accès non autorisé": "Access denied",
  "Accès non autorisé.": "Access denied.",
  "Accès réservé aux administrateurs.": "Admins only.",
  "Authentification requise.": "Please log in.",
  "Session invalide": "Invalid session",
  "Session expirée. Reconnectez-vous.": "Session expired. Please log in again.",
  "Paramètres invalides": "Invalid parameters",
  "Identifiant invalide": "Invalid identifier",
  "Identifiant manquant.": "Missing identifier.",
  "ID invalide": "Invalid ID",
  "ID invalides": "Invalid IDs",
  "IDs invalides": "Invalid IDs",
  "Lien invalide": "Invalid link",
  "Lien invalide.": "Invalid link.",
  "Statut invalide": "Invalid status",
  "Motif invalide": "Invalid reason",
  "Durée invalide": "Invalid duration",
  "Durée invalide.": "Invalid duration.",
  "Email invalide": "Invalid email",
  "Email manquant": "Missing email",
  "Adresse email invalide": "Invalid email address",
  "Adresse email trop longue.": "Email address is too long.",
  "Nom requis": "Name is required",
  "URL invalide": "Invalid URL",
  "URL requise": "URL is required",
  "URL non autorisée": "This URL is not allowed",
  "Seules les URL http(s) sont autorisées": "Only http(s) URLs are allowed",
  "Accès à un hôte interne interdit": "Access to an internal host is not allowed",
  "Hôte introuvable": "Host not found",
  "Langue non prise en charge.": "This language is not supported.",
  "Trop de requêtes, réessayez dans une minute.":
    "Too many requests, please try again in a minute.",

  // ── Compte, connexion ────────────────────────────────────────────────────
  "Email ou mot de passe incorrect.": "Incorrect email or password.",
  "Provide email and password.": "Please enter your email and password.",
  "Provide email, password, name and surname.":
    "Please enter your email, password, first name and last name.",
  "Please provide a valid email address.": "Please enter a valid email address.",
  "Please provide a valid birth date.": "Please enter a valid date of birth.",
  "User already exists": "An account already exists with this email.",
  "User not found": "User not found",
  "Current password is incorrect": "Your current password is incorrect.",
  "Invalid or expired token": "This link is invalid or has expired.",
  "Vous devez accepter les conditions d'utilisation.":
    "You must accept the terms of use.",
  "Un email de vérification vous a été envoyé afin de pouvoir vous connecter. Pensez à regarder dans vos spams.":
    "A verification email has been sent so you can log in. Remember to check your spam folder.",
  "Veuillez vérifier vos emails avant de vous connecter. Un nouvel email de vérification a été envoyé — pensez à regarder dans vos spams.":
    "Please verify your email before logging in. A new verification email has been sent. Remember to check your spam folder.",
  "Ce lien de vérification a expiré.": "This verification link has expired.",
  "Token de vérification invalide": "Invalid verification link",
  "Ce compte a été supprimé.": "This account has been deleted.",
  "Ce compte a déjà été supprimé": "This account has already been deleted",
  "Utilisateur non trouvé": "User not found",
  "Utilisateur non trouvé.": "User not found.",
  "Utilisateur introuvable": "User not found",
  "Utilisateur introuvable.": "User not found.",
  "Utilisateur invalide": "Invalid user",
  "Vous ne pouvez modifier que votre propre compte":
    "You can only edit your own account",
  "Vous ne pouvez supprimer que votre propre compte":
    "You can only delete your own account",
  "Trop de tentatives, réessayez dans 15 minutes.":
    "Too many attempts, please try again in 15 minutes.",
  "Trop de tentatives depuis cette adresse, réessayez dans 15 minutes.":
    "Too many attempts from this address, please try again in 15 minutes.",
  "Trop de créations de compte depuis cette adresse, réessayez plus tard.":
    "Too many accounts created from this address, please try again later.",
  "Trop de demandes de réinitialisation, réessayez dans une heure.":
    "Too many reset requests, please try again in an hour.",
  "Trop de demandes de réinitialisation depuis cette adresse, réessayez plus tard.":
    "Too many reset requests from this address, please try again later.",
  "Trop de changements de photo de profil. Réessayez dans une heure.":
    "Too many profile photo changes. Please try again in an hour.",
  "Trop de demandes d'export, réessayez dans une heure.":
    "Too many export requests, please try again in an hour.",
  "Password must have at least 8 characters and contain at least one number, one lowercase and one uppercase letter.":
    "Password must have at least 8 characters and contain at least one number, one lowercase and one uppercase letter.",
  "Invalid nameday format. Use MM-DD (e.g., 03-13)":
    "Invalid name day format. Use MM-DD (e.g. 03-13)",
  "Les timings de fête doivent être 1 (veille) ou 7 (semaine avant)":
    "Name day reminders must be 1 (day before) or 7 (week before)",
  "Timings doit être un tableau": "Timings must be a list",

  // ── Cartes (dates) ───────────────────────────────────────────────────────
  "Date non trouvée": "Card not found",
  "Date non trouvée ou non autorisée": "Card not found or not allowed",
  "Date not found": "Card not found",
  "Date not found or unauthorized": "Card not found or not allowed",
  "Date or Gift not found or unauthorized": "Card or gift not found or not allowed",
  "Anniversaire non trouvé": "Birthday not found",
  "Carte introuvable": "Card not found",
  "Carte invalide": "Invalid card",
  "Cartes non trouvées": "Cards not found",
  "Carte initiatrice introuvable": "Original card not found",
  "Impossible d'ajouter une photo à une date liée à un ami.":
    "You cannot add a photo to a card linked to a friend.",
  "Impossible de modifier une date liée à un ami. Les modifications doivent se faire via le profil de l'ami.":
    "You cannot edit a card linked to a friend. Changes have to be made from the friend's own profile.",
  "Impossible de supprimer une date liée à un ami. Supprimez l'ami de votre liste d'amis pour retirer sa date.":
    "You cannot delete a card linked to a friend. Remove the friend from your friends list to remove their card.",
  "Impossible de créer la carte : aucune date de naissance connue.":
    "Could not create the card: no date of birth is known.",
  "Impossible de créer la carte : prénom ou date de naissance manquants.":
    "Could not create the card: first name or date of birth is missing.",
  "La carte de destination doit être une carte ami (avec linkedUser)":
    "The destination card must be a friend's card",
  "La carte source ne doit pas être une carte ami":
    "The source card must not be a friend's card",
  "Les cartes partagées ne peuvent pas être modifiées":
    "Shared cards cannot be edited",
  "Erreur lors de la fusion": "Could not merge",
  "Indique le prénom concerné.": "Please enter the first name concerned.",
  "La date proposée est invalide.": "The suggested date is invalid.",

  // ── Amis ─────────────────────────────────────────────────────────────────
  "Amitié non trouvée": "Friendship not found",
  "Demande non trouvée": "Request not found",
  "Cette demande n'est plus en attente": "This request is no longer pending",
  "Vous ne pouvez pas accepter cette demande": "You cannot accept this request",
  "Vous ne pouvez pas refuser cette demande": "You cannot decline this request",
  "Vous ne pouvez pas vous ajouter vous-même": "You cannot add yourself",
  "Une relation existe déjà avec cet utilisateur":
    "You are already connected with this user",
  "Une invitation a déjà été envoyée à cet email":
    "An invitation has already been sent to this email",
  "Invitation non trouvée": "Invitation not found",
  "Invitation introuvable": "Invitation not found",
  "Invitation déjà traitée": "This invitation has already been handled",
  "Cette invitation a déjà été acceptée": "This invitation has already been accepted",
  "L'amitié doit être acceptée pour lier une date":
    "The friend request must be accepted before linking a card",
  "Vous avez atteint votre quota journalier de demandes d'ami (30 sur 24 h). Vous pourrez en envoyer de nouvelles demain.":
    "You have reached your daily limit of friend requests (30 per 24 hours). You can send more tomorrow.",
  "You are not friends with this user": "You are not friends with this user",
  "Impossible de se bloquer soi-même": "You cannot block yourself",

  // ── Chat ─────────────────────────────────────────────────────────────────
  "Conversation introuvable": "Conversation not found",
  "Conversation invalide": "Invalid conversation",
  "Conversation not found": "Conversation not found",
  "Cette conversation n'est plus disponible": "This conversation is no longer available",
  "Type de conversation inconnu.": "Unknown conversation type.",
  "Message introuvable": "Message not found",
  "Message not found": "Message not found",
  "Le message est requis": "A message is required",
  "Le message est trop long": "The message is too long",
  "Le message ne peut pas être vide": "The message cannot be empty",
  "Les messages chiffrés ne peuvent pas être modifiés":
    "Encrypted messages cannot be edited",
  "Impossible d'envoyer le message": "Could not send the message",
  "Destinataire manquant": "Missing recipient",
  "Réaction inconnue": "Unknown reaction",
  "Réaction impossible": "Could not react",
  "Trop de messages envoyés, réessayez plus tard.":
    "Too many messages sent, please try again later.",
  "Trop de messages envoyés depuis cette adresse, réessayez plus tard.":
    "Too many messages sent from this address, please try again later.",

  // ── Wishlist ─────────────────────────────────────────────────────────────
  "Item non trouvé": "Item not found",
  "Item introuvable": "Item not found",
  "Item non trouvé ou non autorisé": "Item not found or not allowed",
  "Cet item est déjà réservé": "This item is already reserved",
  "Cet item n'est pas réservé": "This item is not reserved",
  "Cet item a déjà été acheté": "This item has already been bought",
  "Article déjà acheté": "Item already bought",
  "Déjà réservé": "Already reserved",
  "Vous ne pouvez pas annuler cette réservation": "You cannot cancel this reservation",
  "Seule la personne ayant réservé peut annuler":
    "Only the person who reserved can cancel",
  "Impossible de récupérer les infos de ce site":
    "Could not fetch details from this site",
  "Erreur lors de la récupération des infos": "Could not fetch the details",
  "Code d'accès invalide": "Invalid access code",
  "Code d'accès requis.": "Access code required.",
  "Code incorrect": "Incorrect code",
  "Indique ton prénom": "Please enter your first name",

  // ── Listes communes ──────────────────────────────────────────────────────
  "Liste introuvable": "List not found",
  "Proposition introuvable": "Suggestion not found",
  "Tu gères cette liste : ajoute l'idée directement, sans passer par une proposition.":
    "You manage this list: add the idea directly, without making a suggestion.",
  "Cette liste a déjà beaucoup de propositions en attente. Réessaie plus tard.":
    "This list already has many pending suggestions. Try again later.",
  "Cadeau introuvable": "Gift not found",
  "Ce cadeau est déjà réservé": "This gift is already reserved",
  "Ce cadeau est déjà réservé par un membre":
    "This gift is already reserved by a member",
  "Ce cadeau n'est pas réservé": "This gift is not reserved",
  "Seul le membre qui a réservé peut annuler": "Only the member who reserved can cancel",
  "Seuls les membres peuvent libérer cette réservation":
    "Only members can release this reservation",
  "Cette réservation ne peut pas être annulée ici":
    "This reservation cannot be cancelled here",
  "Cette personne est déjà membre de la liste":
    "This person is already a member of the list",
  "Cette personne a déjà accès à la liste": "This person already has access to the list",
  "Cette personne a déjà une liste commune. Tu ne peux en avoir qu'une par carte.":
    "This person already has a shared list. You can only have one per card.",
  "Cet invité n'a pas d'accès": "This guest has no access",
  "Contact invalide": "Invalid contact",
  "Choisis un autre membre": "Please choose another member",
  "Précise une carte existante ou une nouvelle":
    "Please choose an existing card or a new one",
  "Sélectionne au moins une idée à partager.": "Select at least one idea to share.",
  "Aucune proposition en attente": "No pending proposal",
  "Cette proposition ne t'est pas adressée": "This proposal is not addressed to you",

  // ── Événements ───────────────────────────────────────────────────────────
  "Événement introuvable": "Event not found",
  "Événement introuvable.": "Event not found.",
  "Événement déjà annulé": "The event is already cancelled",
  "Cet événement n'est pas annulé": "This event is not cancelled",
  "Cet événement est annulé.": "This event is cancelled.",
  "Cet événement est annulé : il n'accepte plus d'invitations.":
    "This event is cancelled: it no longer accepts invitations.",
  "Cet événement est annulé : il n'accepte plus de participation.":
    "This event is cancelled: it no longer accepts any participation.",
  "Cet événement est annulé : la cagnotte n'accepte plus de contribution.":
    "This event is cancelled: the money pool no longer accepts contributions.",
  "Annule d'abord cet événement : tes invités seront prévenus. Tu pourras le supprimer ensuite.":
    "Cancel this event first: your guests will be notified. You can delete it afterwards.",
  "Un brouillon n'a jamais été annoncé : il se supprime, il ne s'annule pas.":
    "A draft was never announced: delete it instead of cancelling it.",
  "Erreur lors de la création de l'événement": "Could not create the event",
  "L'événement est complet": "The event is full",
  "Les invités externes ne sont pas autorisés.": "External guests are not allowed.",
  "Vous n'êtes pas invité à cet événement.": "You are not invited to this event.",
  "Action non autorisée. Vous n'êtes pas invité à cet événement.":
    "Not allowed. You are not invited to this event.",
  "Erreur de vérification d'accès.": "Could not check access.",
  "Erreur de vérification des droits d'accès à l'événement":
    "Could not check your access to the event",
  "Token invité invalide ou expiré.": "Guest link is invalid or has expired.",
  "L'organisateur ne peut pas modifier son RSVP via cette route.":
    "The host cannot change their reply this way.",
  "L'organisateur ne vote pas via cette route.": "The host does not vote this way.",
  "L'organisateur ne peut pas quitter son propre événement":
    "The host cannot leave their own event",
  "L'organisateur ne peut pas être retiré de son propre événement":
    "The host cannot be removed from their own event",
  "Cette invitation n'appartient pas à cet événement":
    "This invitation does not belong to this event",
  "Proposition introuvable": "Suggestion not found",
  "Tu organises déjà cet événement": "You are already hosting this event",
  "Tu ne peux transférer l'organisation qu'à un participant ayant confirmé sa présence.":
    "You can only transfer hosting to a participant who has confirmed they are coming.",
  "Une proposition de transfert est déjà en attente.":
    "A transfer proposal is already pending.",

  // ── Cagnotte, paiements ──────────────────────────────────────────────────
  "La cagnotte n'est pas active pour cet événement.":
    "The money pool is not active for this event.",
  "Aucun compte Stripe connecté pour cet événement.":
    "No Stripe account is connected for this event.",
  "Aucun compte de paiement associé à ce profil.":
    "No payment account is linked to this profile.",
  "Aucun compte à déconnecter.": "No account to disconnect.",
  "L'organisateur ne peut pas encaisser de paiements pour le moment.":
    "The host cannot accept payments at the moment.",
  "Vous devez d'abord connecter votre compte Stripe pour activer la cagnotte.":
    "You must connect your Stripe account before turning on the money pool.",
  "Votre compte de paiement n'est pas encore finalisé. Terminez la configuration Stripe avant d'accéder au tableau de bord.":
    "Your payment account is not fully set up yet. Finish the Stripe setup before opening the dashboard.",
  "Impossible d'ouvrir votre tableau de bord Stripe.":
    "Could not open your Stripe dashboard.",
  "Erreur lors de la création du lien Stripe": "Could not create the Stripe link",
  "Erreur lors de la création du paiement": "Could not create the payment",
  "Vous devez accepter les conditions d'utilisation pour contribuer.":
    "You must accept the terms of use to contribute.",
  "Une adresse email valide est nécessaire pour vous envoyer le reçu de votre contribution.":
    "A valid email address is needed to send you the receipt for your contribution.",
  "Trop de tentatives de paiement depuis cette adresse. Réessayez dans quelques minutes.":
    "Too many payment attempts from this address. Please try again in a few minutes.",
  "Aucune contribution à rembourser": "No contribution to refund",
  "Aucune contribution de votre part n'est enregistrée sur cette cagnotte.":
    "No contribution from you is recorded on this money pool.",
  "L'ouverture de cagnottes est suspendue pour ton compte. Contacte le support pour en savoir plus.":
    "Opening money pools is suspended for your account. Contact support to find out more.",
  "Renseigne ta date de naissance dans ton profil pour ouvrir une cagnotte.":
    "Add your date of birth in your profile to open a money pool.",
  "IBAN invalide.": "Invalid IBAN.",
  "Lien PayPal invalide (ex : https://paypal.me/votrepseudo).":
    "Invalid PayPal link (e.g. https://paypal.me/yourname).",
  "Indiquez le lien de votre cagnotte.": "Please enter the link to your money pool.",
  "Le lien doit être en https :// — une page de paiement non sécurisée ne peut pas être proposée à vos invités.":
    "The link must start with https://. An unsecured payment page cannot be offered to your guests.",
  "Ce lien pointe vers BirthReminder. Pour une cagnotte sur BirthReminder, utilisez la cagnotte intégrée de l'événement.":
    "This link points to BirthReminder. For a money pool on BirthReminder, use the event's built-in money pool.",
  "Erreur lors de l'enregistrement du RIB": "Could not save the bank details",
  "Erreur lors de la récupération du RIB": "Could not load the bank details",
  "Erreur lors de la suppression du RIB": "Could not delete the bank details",

  // ── Support, modération ──────────────────────────────────────────────────
  "L'objet est requis": "A subject is required",
  "Ticket introuvable": "Ticket not found",
  "Tu as déjà une conversation en cours avec le support.":
    "You already have an open conversation with support.",
  "Ce ticket est fermé, ouvre un nouveau sujet pour une nouvelle demande.":
    "This ticket is closed. Open a new topic for a new request.",
  "Vous avez déjà une conversation en cours au sujet d'une cagnotte. Poursuivez-la plutôt que d'en ouvrir une seconde.":
    "You already have an open conversation about a money pool. Please continue it rather than opening a second one.",
  "Erreur lors de l'envoi du message": "Could not send the message",
  "Erreur lors du signalement": "Could not send the report",
  "Signalement introuvable": "Report not found",
  "Type de contenu invalide": "Invalid content type",
  "Un contenu ou un utilisateur cible est requis": "A content item or a user is required",
  "Désabonnement impossible": "Could not unsubscribe",
};

// Fin commune des messages de quota (services/quotas.js : SUPPORT_HINT).
const SUPPORT_HINT_EN =
  "Need more? Write to support (Profile → Contact support): the limit can be raised.";

/** Délai avant réessai, tel que le compose retryLabel() dans services/quotas.js. */
function retryLabelEn(fr) {
  if (fr === "dans les prochaines 24 h") return "within the next 24 hours";
  if (fr === "dans moins d'une heure") return "in less than an hour";
  const hours = fr.match(/^dans environ (\d+) h$/);
  return hours ? `in about ${hours[1]} h` : fr;
}

/** [expression régulière sur le texte français, fonction qui rend l'anglais] */
const PATTERNS = [
  [
    /^Tu as déjà (\d+) propositions en attente sur cette liste\. Attends une réponse avant d'en envoyer d'autres\.$/,
    (m) =>
      `You already have ${m[1]} pending suggestions on this list. Wait for an answer before sending more.`,
  ],
  [
    /^Tu dois avoir au moins (\d+) ans pour créer un compte BirthReminder\.$/,
    (m) => `You must be at least ${m[1]} to create a BirthReminder account.`,
  ],
  [
    /^Tu dois avoir au moins (\d+) ans pour utiliser un compte BirthReminder\.$/,
    (m) => `You must be at least ${m[1]} to use a BirthReminder account.`,
  ],
  [
    /^La cagnotte est réservée aux personnes majeures\. Tu pourras en ouvrir une à partir de tes (\d+) ans\.$/,
    (m) =>
      `Money pools are for adults only. You will be able to open one once you turn ${m[1]}.`,
  ],
  [
    /^Ta date de naissance a été modifiée récemment : tu pourras ouvrir une cagnotte à partir du (.+)\.$/,
    (m) =>
      `Your date of birth was changed recently: you will be able to open a money pool from ${m[1]}.`,
  ],
  [
    /^Le montant doit être compris entre (.+) € et (.+) €\.$/,
    (m) => `The amount must be between ${m[1]} € and ${m[2]} €.`,
  ],
  [
    /^Ce cadeau est déjà réservé par (.+)$/,
    (m) => `This gift is already reserved by ${m[1]}`,
  ],
  [
    /^Vous ne pouvez pas proposer plus de (\d+) cadeau\(x\)\.$/,
    (m) => `You cannot suggest more than ${m[1]} gift(s).`,
  ],
  [
    /^(.+) ne supporte pas le remplissage automatique — remplis les champs manuellement$/,
    (m) => `${m[1]} does not support auto-fill. Please fill in the fields manually`,
  ],
  [
    /^Tu as déjà signalé la fête de (.+)\. On te répond dans la conversation en cours\.$/,
    (m) =>
      `You already reported the name day for ${m[1]}. We will reply in the open conversation.`,
  ],
  [
    /^Vous avez déjà une conversation en cours au sujet de « (.+) »\.$/,
    (m) => `You already have an open conversation about "${m[1]}".`,
  ],
  [
    /^(\d+) adresses email maximum par envoi\. Envoyez vos invitations en plusieurs fois\.$/,
    (m) =>
      `${m[1]} email addresses maximum per send. Please send your invitations in several batches.`,
  ],
  [
    /^Cet événement a (\d+) contributions? encaissées? et non remboursées?\. Rembourse les participants avant de supprimer : une fois l'événement effacé, plus aucun remboursement n'est possible\.$/,
    (m) =>
      `This event has ${m[1]} collected contribution(s) not yet refunded. Refund the participants before deleting: once the event is erased, no refund is possible.`,
  ],
  [
    /^Vous avez (\d+) contributions? encaissées? et non remboursées?\. Remboursez vos participants avant de déconnecter votre compte : une fois le lien coupé, aucun remboursement ne sera plus possible depuis l'application\.$/,
    (m) =>
      `You have ${m[1]} collected contribution(s) not yet refunded. Refund your participants before disconnecting your account: once the link is cut, no refund will be possible from the app.`,
  ],
  [
    /^Vous avez atteint la limite de (\d+) événements en cours\. Annulez ou supprimez-en un pour en créer un nouveau — les événements passés ne comptent pas\./,
    (m) =>
      `You have reached the limit of ${m[1]} ongoing events. Cancel or delete one to create a new one. Past events do not count. ${SUPPORT_HINT_EN}`,
  ],
  [
    /^Vous avez atteint votre quota journalier : (\d+) événements créés sur 24 h\. Vous pourrez en créer un nouveau (.+?)\. Besoin de plus/,
    (m) =>
      `You have reached your daily limit: ${m[1]} events created in 24 hours. You can create a new one ${retryLabelEn(m[2])}. ${SUPPORT_HINT_EN}`,
  ],
  [
    /^Cet événement a atteint sa limite de (\d+) invitations par email \(il en reste (\d+)\)\./,
    (m) =>
      `This event has reached its limit of ${m[1]} email invitations (${m[2]} left). Your guests can still join the event with the link and access code, shared by message. ${SUPPORT_HINT_EN}`,
  ],
  [
    /^Vous avez atteint votre quota journalier d'invitations par email \((\d+) sur 24 h, il vous en reste (\d+)\)\. Il se renouvelle (.+?)\. En attendant/,
    (m) =>
      `You have reached your daily limit of email invitations (${m[1]} per 24 hours, ${m[2]} left). It renews ${retryLabelEn(m[3])}. In the meantime, your guests can join the event with the link and access code, shared by message. ${SUPPORT_HINT_EN}`,
  ],
];

/**
 * Traduction d'un message d'erreur français. Rend le texte d'origine s'il
 * n'est pas connu (ou si la langue demandée n'est pas l'anglais).
 */
function translateMessage(text, lang) {
  if (lang !== "en" || typeof text !== "string" || !text) return text;
  if (Object.prototype.hasOwnProperty.call(EXACT, text)) return EXACT[text];
  for (const [pattern, build] of PATTERNS) {
    const match = text.match(pattern);
    if (match) return build(match);
  }
  return text;
}

module.exports = { translateMessage, EXACT, PATTERNS };

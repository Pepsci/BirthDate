// ============================================================
// server/routes/sharedGifts.public.js
// Consultation et réservation d'une liste d'idées commune — sans compte.
//
// Monté AVANT le routeur authentifié dans app.js : sinon "/public/:slug"
// serait capturé par le "/:id" de sharedGifts.js et exigerait un compte.
//
// ── Deux règles qui expliquent tout ce fichier ─────────────────────────────
//
// 1. LE CODE GARDE LA PORTE, pas seulement le bouton. Tant qu'il n'est pas
//    donné, l'API ne renvoie PAS les idées : le lien seul ne montre rien.
//    Avant, le code n'était demandé qu'au moment de réserver ; le lien
//    circulait donc en montrant toute la liste à qui le recevait. Une liste
//    sans code reste ouverte au lien seul, c'est un choix du propriétaire.
//
// 2. LE PRÉNOM N'EST PAS UNE PREUVE D'IDENTITÉ. Il servait à ça, et ça
//    donnait deux défauts : le serveur ne pouvait pas reconnaître le
//    navigateur du réserveur (chaque visiteur voyait « libérer ma
//    réservation » sur les cadeaux des autres), et connaître un prénom
//    suffisait à défaire la réservation de quelqu'un. Un jeton opaque, tiré
//    par le client et jamais deviné, joue ce rôle ; le prénom redevient ce
//    qu'il est, un libellé affiché aux membres.
//
// Ce que ce fichier ne renvoie JAMAIS : l'identité des membres, qui a ajouté
// quoi, le prénom des réserveurs, et l'adresse mail d'un visiteur. Un lien
// public peut être transféré à n'importe qui, y compris à la personne
// concernée — « réservé » suffit à éviter le doublon sans rien révéler.
// ============================================================

const router = require("express").Router();
const crypto = require("crypto");
const SharedGiftList = require("../models/sharedGiftList.model");
const { notify } = require("../utils/notify");
const { sendPushToUser } = require("../services/pushService");
const {
  sendGuestReservationEmail,
} = require("../services/emailTemplates/guestReservationEmail");

/**
 * Statuts invisibles depuis le lien public — même règle que pour les invités
 * dans l'application (voir HIDDEN_STATUSES_FOR_VIEWER dans sharedGifts.js).
 * Un cadeau déjà acheté ou déjà offert n'est plus à prendre : l'afficher à
 * quelqu'un qui vient chercher quoi offrir l'invite au doublon.
 */
const HIDDEN_STATUSES = new Set(["bought", "to_give", "offered"]);

/** Comparaison de code : insensible à la casse et aux espaces collés. */
const codeMatches = (given, expected) =>
  !!expected &&
  String(given || "").trim().toUpperCase() === String(expected).toUpperCase();

/**
 * Comparaison de jetons à temps constant. Un `===` laisserait fuir, par le
 * temps de réponse, la longueur du préfixe correct — marginal ici, mais ce
 * jeton est la seule chose qui protège une réservation.
 */
function tokenMatches(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Format d'adresse — volontairement permissif, on ne valide pas la boîte. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const FRONTEND_URL = process.env.FRONTEND_URL || "https://birthreminder.com";

/**
 * Lien qui redonne au visiteur l'accès à SA réservation depuis n'importe quel
 * appareil : le code ouvre la liste, le jeton l'identifie.
 */
const manageUrlFor = (slug, code, token) => {
  const qs = new URLSearchParams();
  if (code) qs.set("c", code);
  if (token) qs.set("g", token);
  const q = qs.toString();
  return `${FRONTEND_URL}/liste/${slug}${q ? `?${q}` : ""}`;
};

/**
 * Garde-fou d'envoi de mails. Cette page est ouverte à tous et accepte une
 * adresse saisie librement : sans plafond, elle devient une machine à
 * expédier des messages à des boîtes qu'on ne possède pas. Compteur en
 * mémoire, remis à zéro chaque heure — suffisant pour ce qu'il protège, et
 * sans dépendance à ajouter.
 */
const mailQuota = new Map(); // slug -> { count, resetAt }
const MAILS_PER_HOUR = 20;

function mailAllowed(slug) {
  const now = Date.now();
  const entry = mailQuota.get(slug);
  if (!entry || now > entry.resetAt) {
    mailQuota.set(slug, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= MAILS_PER_HOUR) return false;
  entry.count += 1;
  return true;
}

/**
 * Vue d'une liste pour un visiteur donné.
 *
 * `reservedByMe` est calculé à partir du jeton, jamais du prénom : c'est ce
 * qui permet d'afficher « libérer ma réservation » au seul navigateur qui a
 * réservé, et « réservé » à tous les autres.
 */
function publicView(list, guestToken) {
  return {
    label: list.label || null,
    memberCount: (list.members || []).length,
    requiresCode: !!list.accessCode,
    locked: false,
    gifts: (list.gifts || [])
      // `hiddenFromViewers` : idée réservée aux membres. Le lien public est
      // le canal le plus large de tous — c'est là que le filtre compte le plus.
      .filter((g) => !HIDDEN_STATUSES.has(g.status) && !g.hiddenFromViewers)
      .map((g) => ({
        _id: g._id,
        giftName: g.giftName,
        occasion: g.occasion,
        price: g.price,
        url: g.url,
        image: g.image,
        status: g.status,
        isReserved: !!g.reservedBy || !!g.reservedByGuest,
        reservedByMe: tokenMatches(guestToken, g.reservedByGuestToken),
      })),
  };
}

/** Charge une liste publique, ou termine la réponse en 404. */
async function loadPublicList(req, res) {
  const list = await SharedGiftList.findOne({
    publicSlug: req.params.slug,
    isPublic: true,
  });
  if (!list) {
    res.status(404).json({ message: "Liste introuvable" });
    return null;
  }
  return list;
}

/**
 * Vérifie le code. Renvoie `false` APRÈS avoir répondu 403.
 *
 * Le `reason` compte : le client confondait « code invalide » et « ce n'est
 * pas ta réservation », tous deux en 403, et affichait « code incorrect » à
 * quelqu'un dont le code était bon.
 */
function requireCode(req, res, list) {
  if (!list.accessCode) return true;
  if (codeMatches(req.body?.code, list.accessCode)) return true;
  res.status(403).json({ reason: "BAD_CODE", message: "Code d'accès invalide" });
  return false;
}

/**
 * Prévient les membres qu'un visiteur du lien public a réservé une idée.
 *
 * Jamais bloquant : la réservation est déjà enregistrée quand on arrive ici, et
 * la réponse est déjà partie. Le lien pointe vers la carte de chaque
 * destinataire — résolu côté sharedGifts.js pour les routes authentifiées ;
 * ici on reste simple et on vise l'accueil, faute de contexte utilisateur.
 */
async function notifySharedListMembers(req, list, { giftName, guestName }) {
  for (const memberId of list.members || []) {
    try {
      const card = await require("../models/date.model")
        .findOne({ owner: memberId, sharedGiftList: list._id })
        .select("_id");
      const link = card
        ? `/home?tab=date&dateId=${card._id}`
        : "/home?tab=friends";
      await notify(req.app, {
        userId: memberId,
        type: "shared_gift_updated",
        data: {
          fromName: guestName,
          giftName,
          statusLabel: "s'occupe de",
          listLabel: list.label || null,
        },
        link,
      });
      await sendPushToUser(memberId, {
        title: "🎁 Cadeau réservé",
        body: `${guestName} s'occupe de « ${giftName} »`,
        url: link,
        tag: `shared-list-${list._id}`,
        type: "shared_list",
      });
    } catch (err) {
      console.error(
        `[sharedGifts.public] notification échouée pour ${memberId}:`,
        err.message,
      );
    }
  }
}

// ─── GET /api/shared-gifts/public/:slug ──────────────────────
// Coquille de la page : juste de quoi afficher le titre et savoir s'il faut
// demander un code. Aucune idée n'est renvoyée ici quand la liste en a un.
router.get("/:slug", async (req, res) => {
  try {
    const list = await loadPublicList(req, res);
    if (!list) return;

    if (list.accessCode) {
      return res.json({
        label: list.label || null,
        memberCount: (list.members || []).length,
        requiresCode: true,
        locked: true,
      });
    }

    res.json(publicView(list, null));
  } catch (err) {
    console.error("[sharedGifts.public] GET error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/view ────────────────
// Ouvre la liste : code (si la liste en a un) + jeton du visiteur, qui sert
// à marquer ses propres réservations. Remplace l'ancien /verify, qui ne
// validait le code que pour déverrouiller des boutons déjà affichés.
router.post("/:slug/view", async (req, res) => {
  try {
    const list = await loadPublicList(req, res);
    if (!list) return;
    if (!requireCode(req, res, list)) return;

    res.json(publicView(list, req.body?.guestToken));
  } catch (err) {
    console.error("[sharedGifts.public] view error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/gifts/:giftId/reserve ─
// Réservation par un visiteur sans compte. Le prénom est ce que les membres
// verront ; le jeton est ce qui lui permettra de libérer SA réservation ;
// l'adresse, facultative, ne sert qu'à lui renvoyer ce jeton par mail.
router.post("/:slug/gifts/:giftId/reserve", async (req, res) => {
  try {
    const { guestName, guestToken, guestEmail } = req.body || {};

    const list = await loadPublicList(req, res);
    if (!list) return;
    if (!requireCode(req, res, list)) return;

    if (!guestName || !String(guestName).trim())
      return res
        .status(400)
        .json({ reason: "NAME_REQUIRED", message: "Indique ton prénom" });

    if (!guestToken || String(guestToken).length < 16)
      return res
        .status(400)
        .json({ reason: "TOKEN_REQUIRED", message: "Session invalide" });

    const email = String(guestEmail || "").trim();
    if (email && !EMAIL_RE.test(email))
      return res
        .status(400)
        .json({ reason: "BAD_EMAIL", message: "Adresse email invalide" });

    const gift = list.gifts.id(req.params.giftId);
    if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
    if (gift.reservedBy || gift.reservedByGuest)
      return res.status(409).json({
        reason: "ALREADY_RESERVED",
        message: "Ce cadeau est déjà réservé",
      });

    const who = String(guestName).trim().slice(0, 40);
    gift.reservedByGuest = who;
    gift.reservedByGuestToken = String(guestToken);
    gift.reservedByGuestEmail = email || null;
    gift.reservedAt = new Date();
    await list.save();

    // La vue est renvoyée telle que ce visiteur doit la voir : son cadeau
    // passe en « réservé par moi » sans second aller-retour.
    res.json(publicView(list, guestToken));

    // ⚠️ Une réservation depuis le lien public ne prévenait PERSONNE : les
    // membres continuaient de voir une idée « à prendre » que quelqu'un avait
    // déjà bloquée, et pouvaient l'acheter en double.
    await notifySharedListMembers(req, list, {
      giftName: gift.giftName,
      guestName: who,
    });

    if (email && mailAllowed(req.params.slug)) {
      try {
        await sendGuestReservationEmail({
          email,
          guestName: who,
          giftName: gift.giftName,
          listLabel: list.label || null,
          manageUrl: manageUrlFor(
            req.params.slug,
            list.accessCode || null,
            guestToken,
          ),
        });
      } catch (err) {
        // Jamais bloquant : la réservation est faite, et le visiteur garde
        // son jeton dans son navigateur même sans le mail.
        console.error(
          "[sharedGifts.public] mail de confirmation échoué:",
          err.message,
        );
      }
    }
  } catch (err) {
    console.error("[sharedGifts.public] reserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/gifts/:giftId/unreserve ─
// Un visiteur ne libère que SA réservation, prouvée par son jeton. Il ne peut
// pas toucher à celle d'un membre (reservedBy), qui se libère depuis l'app.
router.post("/:slug/gifts/:giftId/unreserve", async (req, res) => {
  try {
    const { guestToken } = req.body || {};

    const list = await loadPublicList(req, res);
    if (!list) return;
    if (!requireCode(req, res, list)) return;

    const gift = list.gifts.id(req.params.giftId);
    if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });

    if (!gift.reservedByGuest)
      return res.status(403).json({
        reason: "NOT_YOURS",
        message: "Cette réservation ne peut pas être annulée ici",
      });

    if (!tokenMatches(guestToken, gift.reservedByGuestToken))
      return res.status(403).json({
        reason: "NOT_YOURS",
        message: "Seule la personne ayant réservé peut annuler",
      });

    gift.reservedByGuest = null;
    gift.reservedByGuestToken = null;
    gift.reservedByGuestEmail = null;
    gift.reservedAt = null;
    await list.save();

    res.json(publicView(list, guestToken));
  } catch (err) {
    console.error("[sharedGifts.public] unreserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;

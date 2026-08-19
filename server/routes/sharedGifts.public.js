// ============================================================
// server/routes/sharedGifts.public.js
// Consultation publique d'une liste d'idées commune — sans authentification.
//
// Monté AVANT le routeur authentifié dans app.js : sinon "/public/:slug"
// serait capturé par le "/:id" de sharedGifts.js et exigerait un compte.
//
// Ne renvoie que ce qui est nécessaire à l'affichage. Volontairement absents :
// l'identité des membres et qui a ajouté quoi.
//
// Le prénom du réserveur n'est PAS exposé ici : seuls les membres de la liste
// le voient, dans l'application. Un lien public peut être transféré à
// n'importe qui, y compris à la personne concernée — « réservé » suffit à
// éviter le doublon sans révéler qui offre quoi.
//
// Réserver depuis cette page exige le code d'accès de la liste ; le consulter
// non. Même règle que le code ami des wishlists personnelles.
// ============================================================

const router = require("express").Router();
const SharedGiftList = require("../models/sharedGiftList.model");

/** Comparaison de code : insensible à la casse et aux espaces collés. */
const codeMatches = (given, expected) =>
  !!expected &&
  String(given || "").trim().toUpperCase() === String(expected).toUpperCase();

// ─── GET /api/shared-gifts/public/:slug ──────────────────────
router.get("/:slug", async (req, res) => {
  try {
    const list = await SharedGiftList.findOne({
      publicSlug: req.params.slug,
      isPublic: true,
    });

    if (!list) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    res.json({
      label: list.label || null,
      memberCount: (list.members || []).length,
      // Permet à la page de savoir s'il faut demander un code avant de
      // réserver, sans jamais transmettre le code lui-même.
      requiresCode: !!list.accessCode,
      gifts: (list.gifts || []).map((g) => ({
        _id: g._id,
        giftName: g.giftName,
        occasion: g.occasion,
        price: g.price,
        url: g.url,
        image: g.image,
        status: g.status,
        isReserved: !!g.reservedBy || !!g.reservedByGuest,
      })),
    });
  } catch (err) {
    console.error("[sharedGifts.public] GET error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/verify ──────────────
// Vérifie le code sans rien réserver : la page peut ainsi déverrouiller ses
// boutons avant la première action, comme le fait la wishlist publique.
router.post("/:slug/verify", async (req, res) => {
  try {
    const list = await SharedGiftList.findOne({
      publicSlug: req.params.slug,
      isPublic: true,
    }).select("accessCode");

    if (!list) return res.status(404).json({ message: "Liste introuvable" });
    if (!list.accessCode) return res.json({ valid: true });

    res.json({ valid: codeMatches(req.body?.code, list.accessCode) });
  } catch (err) {
    console.error("[sharedGifts.public] verify error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/gifts/:giftId/reserve ─
// Réservation par un visiteur sans compte. Exige le code et un prénom : le
// prénom est ce qui lui permettra de libérer SA réservation plus tard, et ce
// que les membres verront dans l'application.
router.post("/:slug/gifts/:giftId/reserve", async (req, res) => {
  try {
    const { code, guestName } = req.body || {};

    const list = await SharedGiftList.findOne({
      publicSlug: req.params.slug,
      isPublic: true,
    });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });

    if (list.accessCode && !codeMatches(code, list.accessCode))
      return res.status(403).json({ message: "Code d'accès invalide" });

    if (!guestName || !String(guestName).trim())
      return res.status(400).json({ message: "Indique ton prénom" });

    const gift = list.gifts.id(req.params.giftId);
    if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });
    if (gift.reservedBy || gift.reservedByGuest)
      return res.status(409).json({ message: "Ce cadeau est déjà réservé" });

    gift.reservedByGuest = String(guestName).trim().slice(0, 40);
    gift.reservedAt = new Date();
    await list.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[sharedGifts.public] reserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ─── POST /api/shared-gifts/public/:slug/gifts/:giftId/unreserve ─
// Un visiteur ne libère que SA réservation : on compare le prénom saisi.
// Il ne peut pas toucher à celle d'un membre (reservedBy), qui se libère
// depuis l'application.
router.post("/:slug/gifts/:giftId/unreserve", async (req, res) => {
  try {
    const { code, guestName } = req.body || {};

    const list = await SharedGiftList.findOne({
      publicSlug: req.params.slug,
      isPublic: true,
    });
    if (!list) return res.status(404).json({ message: "Liste introuvable" });

    if (list.accessCode && !codeMatches(code, list.accessCode))
      return res.status(403).json({ message: "Code d'accès invalide" });

    const gift = list.gifts.id(req.params.giftId);
    if (!gift) return res.status(404).json({ message: "Cadeau introuvable" });

    if (!gift.reservedByGuest)
      return res
        .status(403)
        .json({ message: "Cette réservation ne peut pas être annulée ici" });

    if (
      String(gift.reservedByGuest).trim().toLowerCase() !==
      String(guestName || "").trim().toLowerCase()
    )
      return res
        .status(403)
        .json({ message: "Seule la personne ayant réservé peut annuler" });

    gift.reservedByGuest = null;
    gift.reservedAt = null;
    await list.save();

    res.json({ ok: true });
  } catch (err) {
    console.error("[sharedGifts.public] unreserve error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;

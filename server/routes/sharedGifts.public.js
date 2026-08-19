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
// En revanche le PRÉNOM du réserveur est exposé, à la différence de la
// wishlist publique qui se contente d'un « réservé ». C'est la raison d'être
// d'une liste commune : plusieurs personnes se coordonnent sur les mêmes
// cadeaux, et savoir qui s'occupe de quoi est précisément l'information qu'on
// vient y chercher. Le lien reste à distribuer en connaissance de cause : le
// transmettre à la personne concernée lui apprendrait qui lui offre quoi.
// ============================================================

const router = require("express").Router();
const SharedGiftList = require("../models/sharedGiftList.model");

// ─── GET /api/shared-gifts/public/:slug ──────────────────────
router.get("/:slug", async (req, res) => {
  try {
    const list = await SharedGiftList.findOne({
      publicSlug: req.params.slug,
      isPublic: true,
    }).populate("gifts.reservedBy", "name");

    if (!list) {
      return res.status(404).json({ message: "Liste introuvable" });
    }

    res.json({
      label: list.label || null,
      memberCount: (list.members || []).length,
      gifts: (list.gifts || []).map((g) => ({
        _id: g._id,
        giftName: g.giftName,
        occasion: g.occasion,
        price: g.price,
        url: g.url,
        image: g.image,
        status: g.status,
        isReserved: !!g.reservedBy,
        // Prénom seul, jamais le nom de famille ni l'identifiant du compte :
        // de quoi se coordonner, sans exposer l'annuaire des membres.
        reservedByName: g.reservedBy?.name || null,
      })),
    });
  } catch (err) {
    console.error("[sharedGifts.public] GET error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;

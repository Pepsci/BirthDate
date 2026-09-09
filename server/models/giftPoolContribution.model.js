const { Schema, model } = require("mongoose");

const giftPoolContributionSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    contributor: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = invité externe
    guestName: { type: String, trim: true },
    amount: { type: Number, required: true }, // centimes
    currency: { type: String, default: "eur" },
    message: { type: String, maxlength: 280, trim: true },
    anonymous: { type: Boolean, default: false },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "refunded"],
      default: "pending",
    },

    /**
     * Frais RÉELLEMENT prélevés par Stripe sur ce paiement, en centimes, lus
     * sur la `balance_transaction` de la charge et figés à l'encaissement.
     *
     * ⚠️ Pourquoi ce champ existe. Le coût d'un remboursement était estimé à
     * partir d'une constante — 1,5 % + 0,25 €, le tarif d'une carte
     * européenne standard. Or c'est un cas de figure sur quatre : une carte
     * européenne professionnelle est à 2,8 %, une carte britannique à 2,5 %,
     * une carte hors Europe à 3,15 % plus 2 % de conversion. L'organisateur
     * voyait donc, AVANT une opération irréversible, un chiffre qui pouvait
     * valoir la moitié de ce qu'il allait réellement perdre.
     *
     * Figé au moment de l'encaissement, jamais recalculé : c'est le barème
     * appliqué CE jour-là qui compte, et Stripe fait évoluer sa grille.
     *
     * `null` pour les contributions encaissées avant l'ajout de ce champ :
     * elles retombent sur l'estimation, faute de mieux.
     */
    feeCents: { type: Number, default: null },

    // ── Remboursement ─────────────────────────────────────────────────────
    // Le passage en "refunded" est prononcé par le webhook `charge.refunded`,
    // jamais par la route qui déclenche le remboursement : Stripe reste la
    // source de vérité, exactement comme pour l'encaissement.
    stripeRefundId: { type: String, default: null },
    refundedAt: { type: Date, default: null },
    // Ce que l'opération coûte à l'ORGANISATEUR. Stripe ne restitue pas les
    // frais de la transaction d'origine : le contributeur récupère 100 % de sa
    // contribution, et l'écart reste à la charge de l'organisateur. On fige le
    // montant au moment du remboursement plutôt que de le recalculer plus
    // tard, car le barème peut changer.
    refundFeeLoss: { type: Number, default: null }, // centimes
  },
  { timestamps: true },
);

module.exports = model("GiftPoolContribution", giftPoolContributionSchema);

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

    /**
     * Horodatage de l'acceptation des conditions d'utilisation par un
     * contributeur SANS COMPTE.
     *
     * ⚠️ Un contributeur inscrit a accepté les conditions à l'inscription, et
     * le serveur l'horodate déjà sur son compte (`acceptedTermsAt`). Un
     * visiteur arrivé par le lien public, lui, n'avait jamais rien accepté :
     * il pouvait payer sans qu'aucun texte ne lui soit opposable. Or c'est
     * exactement la personne qui se retournera vers nous le jour où
     * l'événement est annulé — et le seul texte qui répond à sa question
     * (« BirthReminder ne détient pas les fonds, le litige se règle avec
     * l'organisateur ») ne vaut que si elle l'a accepté.
     *
     * `null` pour un contributeur inscrit : son acceptation vit sur son
     * compte, la dupliquer ici n'apporterait rien.
     */
    guestTermsAcceptedAt: { type: Date, default: null },

    /**
     * Adresse du contributeur SANS COMPTE, saisie avant le paiement.
     *
     * ⚠️ Ce champ est la preuve de paiement du seul contributeur qui n'en a
     * aucune autre. Un inscrit retrouve sa contribution dans l'application et
     * reçoit le reçu Stripe sur l'adresse de son compte ; un visiteur venu par
     * le lien public n'a ni l'un ni l'autre. Sans adresse, il paie et il ne
     * reste rien : ni reçu, ni référence, ni trace côté navigateur. Le jour où
     * l'événement est annulé, il ne peut même pas prouver à l'organisateur
     * qu'il a versé quelque chose.
     *
     * Le reçu automatique de Stripe ne suffit pas à lui seul : sur une charge
     * directe il dépend des réglages du compte de l'ORGANISATEUR, qui peut
     * avoir coupé les emails de paiement. D'où notre propre accusé de
     * réception, envoyé par le webhook.
     *
     * Usage strictement limité à cet envoi : jamais renvoyée par l'API, jamais
     * montrée à l'organisateur ni aux autres participants.
     *
     * `null` pour un contributeur inscrit : son adresse vit sur son compte.
     */
    guestEmail: { type: String, trim: true, lowercase: true, default: null },

    /**
     * Horodatage de l'envoi de notre accusé de réception, pour que le rejeu
     * d'un webhook par Stripe n'envoie pas le mail deux fois.
     */
    receiptSentAt: { type: Date, default: null },
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

const { Schema, model } = require("mongoose");

/**
 * Registre de traitement des alertes de cagnotte.
 *
 * ⚠️ Ce modèle n'existe pas pour le confort de l'administrateur : il existe
 * pour prouver la diligence.
 *
 * Les alertes sont recalculées à la volée par `computePoolAlerts()` — elles
 * n'ont donc, par nature, aucune mémoire. Or le cron `poolFraudAlerts` nous
 * envoie un mail à chaque détection : la date à laquelle nous avons SU est
 * établie, et bien établie. Ne rien conserver de ce que nous en avons fait
 * crée une asymétrie défavorable : une alerte qui se rallume tous les jours
 * depuis trois mois, sans la moindre trace d'examen, se lit comme une
 * plateforme qui savait et qui n'a pas bougé.
 *
 * Le régime de responsabilité des hébergeurs repose sur l'absence de
 * connaissance effective de l'activité illicite. On ne construit pas un
 * système de détection pour plaider ensuite l'ignorance : à partir du moment
 * où il tourne, la seule position défendable est de montrer que chaque alerte
 * a été regardée et tranchée. Écarter une alerte est une décision parfaitement
 * légitime — à condition qu'elle soit datée, signée et motivée.
 *
 * D'où le motif OBLIGATOIRE : une case cochée sans explication ne prouve rien.
 */
const poolAlertReviewSchema = new Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    // Type de règle déclenchée (bigContribution, velocity, refundRatio…).
    // Une même cagnotte peut faire l'objet de plusieurs alertes distinctes,
    // chacune tranchée séparément : la clé est donc (event + alertType).
    alertType: { type: String, required: true },

    status: {
      type: String,
      enum: ["dismissed", "actioned"],
      required: true,
    },

    /**
     * Motif de la décision. Obligatoire, et c'est tout l'intérêt du registre.
     * « Organisateur connu, cagnotte de mariage, montants cohérents » vaut une
     * défense ; une case cochée ne vaut rien.
     */
    reason: { type: String, required: true, trim: true, maxlength: 1000 },

    /** Ce qui a été fait, quand status vaut "actioned". */
    actionTaken: {
      type: String,
      enum: ["frozen", "refunded", "organizer_contacted", "account_suspended", "other"],
      default: null,
    },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * Empreinte des données au moment de la décision.
     *
     * ⚠️ C'est ce qui empêche le registre de se vider de son sens. Sans elle,
     * une alerte écartée réapparaît au prochain passage du cron et l'on
     * ré-écarte tous les matins : le registre se remplit de décisions qui ne
     * décident rien. Avec elle, une alerte écartée reste écartée TANT QUE la
     * situation n'a pas bougé — et se rouvre d'elle-même dès que le montant
     * collecté ou le nombre de contributions change, c'est-à-dire au moment
     * précis où il faut la regarder à nouveau.
     */
    snapshot: {
      collected: Number,
      contributions: Number,
      refunded: Number,
    },
  },
  { timestamps: true },
);

// Une décision par (cagnotte, type d'alerte) : la nouvelle remplace la
// précédente, et `updatedAt` dit quand on a tranché pour la dernière fois.
poolAlertReviewSchema.index({ event: 1, alertType: 1 }, { unique: true });

module.exports = model("PoolAlertReview", poolAlertReviewSchema);

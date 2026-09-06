const mongoose = require("mongoose");
const { Schema, model } = mongoose;

/**
 * Journal d'audit.
 *
 * Deux familles d'actions y cohabitent, avec des durées de conservation
 * différentes (voir `expiresAt` plus bas) :
 *  - les actions de compte (connexion, modification, suppression), utiles au
 *    support et à la sécurité sur une fenêtre courte ;
 *  - les actions à conséquence durable — annulation d'événement, transfert
 *    d'organisation, activation de cagnotte, remboursement, enregistrement ou
 *    suppression d'un RIB. Celles-là engagent des personnes entre elles, et
 *    parfois de l'argent : elles doivent rester consultables bien au-delà.
 */
const logSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // ── Compte ────────────────────────────────────────────────────────
        "login",
        "logout",
        "signup",
        // Demande de réinitialisation (formulaire « mot de passe oublié »),
        // à distinguer de password_reset qui n'est écrit qu'une fois le
        // nouveau mot de passe réellement enregistré.
        "password_reset_request",
        "password_reset",
        "account_update",
        "account_delete",
        "friend_add",
        "message_send",

        // ── Événements ────────────────────────────────────────────────────
        // Ces actions changent l'événement pour TOUS ses participants, pas
        // seulement pour celui qui les déclenche : c'est ce qui justifie de les
        // tracer. « Qui a annulé ? », « qui m'a passé l'organisation ? » sont
        // des questions qu'on ne peut pas reconstituer après coup sans ça.
        "event_create",
        "event_cancel",
        "event_uncancel",
        "event_delete",
        "event_transfer_lead",

        // ── Argent ────────────────────────────────────────────────────────
        // En charges directes, l'organisateur est le marchand : BirthReminder
        // n'a aucune trace côté Stripe de ce qui s'est décidé dans l'app. Ce
        // journal est donc la seule source qui relie une décision produite ici
        // à un mouvement d'argent là-bas.
        "pool_enable",
        "pool_disable",
        "pool_freeze",
        "pool_refund",
        "bankinfo_set",
        "bankinfo_delete",
      ],
    },
    // Absente pour les écritures qui ne viennent pas d'une requête utilisateur
    // (webhook Stripe, cron) : on y met alors "system".
    ipAddress: { type: String, default: "system" },
    userAgent: String,
    // Contexte de l'action : shortId de l'événement, montants, motif, ancien et
    // nouvel organisateur… Volontairement libre, c'est ce qui rend le journal
    // lisible des mois plus tard.
    metadata: Schema.Types.Mixed,

    /**
     * Date de purge automatique.
     *
     * ⚠️ L'index TTL porte sur CE champ avec expireAfterSeconds: 0, et non plus
     * sur `createdAt` avec 365 jours. La différence est essentielle : MongoDB
     * ignore les documents dont le champ TTL est absent, ce qui permet à une
     * entrée de ne jamais expirer. Les actions à conséquence durable sont
     * écrites sans `expiresAt` et restent donc indéfiniment, là où l'ancien
     * index effaçait tout à un an sans distinction — y compris la trace d'un
     * remboursement.
     *
     * ⚠️ MIGRATION : l'ancien index { createdAt: 1 } doit être supprimé, sinon
     * il continue de tout purger à un an et ce champ ne sert à rien. Voir
     * server/scripts/migrate-log-retention.js.
     */
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  },
);

logSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Recherche par événement dans le journal (« que s'est-il passé sur cet
// événement ? ») — sparse : la grande majorité des logs n'a pas ce champ.
logSchema.index({ "metadata.eventShortId": 1, createdAt: -1 }, { sparse: true });
logSchema.index({ userId: 1, createdAt: -1 });

module.exports = model("Log", logSchema);

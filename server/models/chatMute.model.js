const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Silencieux posé par une personne sur UNE conversation — privée ou
 * discussion d'événement.
 *
 * ⚠️ Ne coupe que les notifications PUSH. La notification in-app est toujours
 * créée, et la conversation continue de remonter avec son badge de non-lus :
 * couper les deux ferait disparaître les messages sans laisser de trace, et
 * on ne saurait plus qu'on a raté quelque chose. Même comportement que les
 * messageries grand public.
 *
 * `until` :
 *  - une date  → silencieux temporaire (1 h, 8 h, 1 semaine) ;
 *  - `null`    → « toujours », jusqu'à réactivation explicite.
 *
 * L'index TTL supprime les lignes dont la date est passée. Un document dont
 * le champ vaut `null` n'expire JAMAIS pour MongoDB — c'est précisément ce
 * qui permet de coder « toujours » sans champ supplémentaire.
 */
const chatMuteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["dm", "event"], required: true },
    /**
     * Identifiant de la cible, en chaîne : l'id de conversation pour un chat
     * privé, le `shortId` de l'événement pour une discussion d'événement.
     * C'est ce que les payloads de push portent déjà, donc rien à résoudre au
     * moment d'envoyer.
     */
    targetId: { type: String, required: true },
    until: { type: Date, default: null },
  },
  { timestamps: true },
);

// Un seul silencieux par personne et par conversation : reposer un silencieux
// remplace le précédent au lieu d'en empiler.
chatMuteSchema.index({ user: 1, kind: 1, targetId: 1 }, { unique: true });
chatMuteSchema.index({ until: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ChatMute", chatMuteSchema);

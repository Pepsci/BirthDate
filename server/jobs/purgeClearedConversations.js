const cron = require("node-cron");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const Report = require("../models/report.model");

/**
 * Purge des conversations effacées par LES DEUX participants.
 *
 * « Supprimer une conversation » ne détruit rien : chacun horodate son
 * effacement (champ `clears`), pour que personne ne puisse effacer des
 * messages chez quelqu'un d'autre — notamment les preuves d'un harcèlement
 * signalé. Restait un trou : ces données étaient alors conservées sans limite.
 *
 * Ce job fixe la durée de conservation. Quand les deux participants ont fait
 * le ménage et que rien n'a bougé depuis 12 mois, plus personne n'y accède et
 * plus aucun signalement n'est plausible : on supprime pour de bon.
 *
 * 12 mois : borne haute de la recommandation CNIL sur les journaux de
 * sécurité, et délai raisonnable pour qu'un signalement tardif soit traité.
 *
 * Exception : un message visé par un signalement n'est jamais purgé, sinon le
 * dispositif de modération perdrait ses pièces au bout d'un an.
 */
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

async function purgeOnce() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  let purgedConversations = 0;
  let purgedMessages = 0;
  let keptForReports = 0;

  // Candidates : les deux participants ont un effacement, et aucun message
  // n'est arrivé depuis (lastMessageAt antérieur au seuil).
  const candidates = await Conversation.find({
    "clears.1": { $exists: true },
    lastMessageAt: { $lt: cutoff },
  })
    .select("_id participants clears lastMessageAt")
    .lean();

  for (const conv of candidates) {
    // Les deux effacements doivent être anciens ET couvrir tout le fil.
    const clears = conv.clears || [];
    const everyoneCleared = (conv.participants || []).every((p) =>
      clears.some((c) => String(c.user) === String(p)),
    );
    if (!everyoneCleared) continue;
    if (clears.some((c) => c.at > cutoff)) continue;

    const messageIds = (
      await Message.find({ conversation: conv._id }).select("_id").lean()
    ).map((m) => m._id);

    // Un message signalé est une pièce de modération : on ne touche à rien.
    const reported = await Report.exists({
      contentType: "message",
      contentId: { $in: messageIds },
    });
    if (reported) {
      keptForReports++;
      continue;
    }

    const del = await Message.deleteMany({ conversation: conv._id });
    await Conversation.deleteOne({ _id: conv._id });
    purgedMessages += del.deletedCount || 0;
    purgedConversations++;
  }

  return { purgedConversations, purgedMessages, keptForReports };
}

// Tous les jours à 4h, après la purge des comptes supprimés (3h).
const purgeClearedConversations = cron.schedule(
  "0 4 * * *",
  async () => {
    try {
      console.log("🗑️  [CRON] Purge des conversations effacées...");
      const stats = await purgeOnce();
      console.log(
        `✅ [CRON] ${stats.purgedConversations} conversation(s) et ${stats.purgedMessages} message(s) purgés, ${stats.keptForReports} conservée(s) pour signalement`,
      );
    } catch (error) {
      console.error("❌ [CRON] Erreur purge conversations:", error);
    }
  },
  { scheduled: false },
);

module.exports = purgeClearedConversations;
module.exports.purgeOnce = purgeOnce;

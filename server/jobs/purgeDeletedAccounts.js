const cron = require("node-cron");
const userModel = require("../models/user.model");
const Log = require("../models/log.model");
const DateModel = require("../models/date.model");
const Friend = require("../models/friend.model");
const { removeAvatarFiles } = require("../config/avatarStorage");

// Tourne tous les jours à 3h du matin
const purgeDeletedAccounts = cron.schedule(
  "0 3 * * *",
  async () => {
    try {
      console.log("🗑️  [CRON] Début de la purge des comptes supprimés...");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Trouve les comptes supprimés il y a plus de 30 jours
      const accountsToDelete = await userModel.find({
        deletedAt: { $lt: thirtyDaysAgo, $ne: null },
      });

      console.log(`📊 ${accountsToDelete.length} compte(s) à purger`);

      for (const user of accountsToDelete) {
        // Filet de sécurité : le fichier avatar est normalement déjà supprimé
        // par DELETE /users/:id, mais on repasse ici pour les comptes soft-
        // deleted avant la migration disque, ou si l'unlink avait échoué.
        await removeAvatarFiles(user._id);

        // Supprimer les logs de cet utilisateur
        await Log.deleteMany({ userId: user._id });

        // Supprimer les dates d'anniversaire
        await DateModel.deleteMany({ owner: user._id });

        // Supprimer les relations d'amitié
        await Friend.deleteMany({
          $or: [{ user: user._id }, { friend: user._id }],
        });

        // Supprimer définitivement le compte
        await userModel.findByIdAndDelete(user._id);

        console.log(`✅ Compte ${user._id} purgé définitivement`);
      }

      console.log("✅ [CRON] Purge terminée");
    } catch (error) {
      console.error("❌ [CRON] Erreur lors de la purge:", error);
    }
  },
  {
    scheduled: false, // Important : ne démarre PAS automatiquement
  },
);

module.exports = purgeDeletedAccounts;

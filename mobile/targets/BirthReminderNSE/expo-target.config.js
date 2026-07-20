/**
 * Cible Notification Service Extension — recréée à chaque prebuild par
 * @bacons/apple-targets (pas besoin de Mac, compatible EAS cloud).
 *
 * Rôle : déchiffrer les notifs de message E2E avant affichage (voir
 * NotificationService.swift dans ce dossier et ios-nse/README.md).
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "notification-service",
  name: "BirthReminderNSE",
  bundleIdentifier: "com.birthreminder.app.BirthReminderNSE",
  deploymentTarget: "15.1",
  frameworks: ["UserNotifications"],
  entitlements: {
    // Mêmes valeurs que ios-nse/BirthReminderNSE.entitlements :
    // App Group + Keychain partagés avec l'app principale (lecture clé privée E2E).
    "com.apple.security.application-groups": ["group.com.birthreminder.app"],
    "keychain-access-groups": [
      "$(AppIdentifierPrefix)group.com.birthreminder.app",
    ],
  },
};

/**
 * withNotifReplyKeepAlive.js — Config plugin Expo
 *
 * Réponse depuis une notification (voir src/lib/notif-reply.ts).
 *
 * ⚠️ Pourquoi du natif. Quand on répond depuis la notification, iOS (re)lance
 * l'app en arrière-plan puis attend qu'on appelle `completionHandler`.
 * expo-notifications l'appelle IMMÉDIATEMENT (NotificationCenterManager.swift),
 * avant même que le JS ait chiffré et envoyé la réponse : iOS peut alors
 * suspendre l'app, et la requête part… au prochain lancement.
 *
 * Ce plugin ajoute un délégué qui, pour une réponse texte uniquement, demande
 * à iOS un sursis d'arrière-plan (~25 s, `beginBackgroundTask`). Il ne consomme
 * pas la réponse (`return false`) : expo-notifications la transmet toujours au
 * JS. Aucune crypto ici.
 *
 * Posé en plugin car `ios/` est régénéré par `expo prebuild --clean`.
 */
const { withAppDelegate } = require("expo/config-plugins");

const MARK = "// withNotifReplyKeepAlive";

const IMPORT = `import EXNotifications ${MARK}\nimport UserNotifications`;

const REGISTER = `    NotificationCenterManager.shared.addDelegate(NotifReplyKeepAlive.shared) ${MARK}\n`;

const CLASS = `
${MARK} — sursis d'arrière-plan pour la réponse depuis une notification
final class NotifReplyKeepAlive: NotificationDelegate {
  static let shared = NotifReplyKeepAlive()

  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    guard response is UNTextInputNotificationResponse else { return false }
    DispatchQueue.main.async {
      var task: UIBackgroundTaskIdentifier = .invalid
      let end = {
        if task != .invalid {
          UIApplication.shared.endBackgroundTask(task)
          task = .invalid
        }
      }
      task = UIApplication.shared.beginBackgroundTask(withName: "notif-reply", expirationHandler: end)
      DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: end)
    }
    return false
  }
}
`;

module.exports = function withNotifReplyKeepAlive(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("withNotifReplyKeepAlive: AppDelegate Swift attendu");
    }
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    src = src.replace(/^import Expo$/m, (m) => `${m}\n${IMPORT}`);

    const anchor = "    return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
    if (!src.includes(anchor) || !src.includes(IMPORT)) {
      throw new Error("withNotifReplyKeepAlive: ancre AppDelegate introuvable");
    }
    src = src.replace(anchor, `${REGISTER}${anchor}`);
    src += CLASS;

    cfg.modResults.contents = src;
    return cfg;
  });
};

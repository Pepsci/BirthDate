/**
 * index.ts — Point d'entrée de l'app (remplace "expo-router/entry" dans package.json).
 *
 * ── Pourquoi ce fichier ─────────────────────────────────────────────────────
 * Sur Android, une push de message privé est DATA-ONLY : Android n'affiche
 * rien tout seul, c'est la tâche de fond `birthreminder-background-notif`
 * (lib/notif-decrypt.ts) qui déchiffre puis présente la notification.
 *
 * Quand la push arrive app tuée ou gelée, Android relance le JS en mode
 * « headless » : le bundle est évalué, mais AUCUN écran n'est rendu. Or la
 * tâche n'était définie que via un import de `app/_layout.tsx` — un fichier
 * que expo-router ne charge qu'au rendu. Résultat : tâche inconnue au réveil,
 * push livrée par FCM puis ignorée en silence, sans le moindre log.
 *
 * La doc Expo l'exige : `TaskManager.defineTask` doit être exécuté dans un
 * module chargé tôt, typiquement le fichier d'entrée. L'import ci-dessous
 * suffit : notif-decrypt.ts appelle defineBackgroundNotifTask() à l'import.
 *
 * iOS n'est pas concerné (la NSE déchiffre), mais l'import y est inoffensif :
 * defineBackgroundNotifTask est idempotent.
 */
import "./src/lib/notif-decrypt";

// Doit rester APRÈS : démarre expo-router normalement.
import "expo-router/entry";

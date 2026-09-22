import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import type { DateEntry } from "./dates";
import { localFetchDates } from "./local-dates";
import { onLocalChange, readLocal } from "./local-store";

/**
 * Rappels du mode local — docs/MODE_LOCAL.md § 5.4.
 *
 * En mode compte, le serveur envoie des push chaque nuit à minuit
 * (jobs/sendReminders.js). Sans compte, pas de serveur : le téléphone
 * programme lui-même ses notifications à l'avance, et iOS les affiche à
 * l'heure dite, app fermée, même en mode avion.
 *
 * ⚠️ LIMITE iOS : 64 notifications programmées au maximum par app. Au-delà,
 * iOS garde les plus proches et ignore les autres SANS RIEN DIRE. D'où :
 * 1. calcul des échéances des 60 prochains jours ;
 * 2. tri par date, on garde les 59 plus proches + 1 notification « ouvre
 *    l'app » (60 au total, 4 de marge) ;
 * 3. on annule NOS notifications programmées, puis on reprogramme ;
 * 4. à refaire à chaque ouverture, retour au premier plan, et après toute
 *    modification d'une carte ou d'un réglage (onLocalChange).
 *
 * ⚠️ JAMAIS en mode compte : doublon avec le push serveur. auth-context
 * appelle stopLocalReminders() dès que le mode n'est plus « local ».
 */

/** Jours couverts à l'avance. */
const HORIZON_DAYS = 60;
/** Total programmé, notification « ouvre l'app » comprise (limite iOS : 64). */
const MAX_SCHEDULED = 60;
/** Sans troncature, la notification « ouvre l'app » tombe à J+55. */
const WAKE_UP_DAY = 55;
/**
 * Préfixe de NOS identifiants. On n'annule que ceux-là : les notifications
 * immédiates d'autres modules (messages déchiffrés, réponses) ne sont pas
 * concernées.
 */
const ID_PREFIX = "br-local-";

export interface PlannedReminder {
  id: string;
  at: Date;
  title: string;
  body: string;
  dateId: string | null;
}

// ---- Calcul (fonctions pures, testables sans téléphone) ----

/** Minuit (heure du téléphone) du jour `today + offset`. */
function midnight(from: Date, offset: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset, 0, 0, 0, 0);
}

/** Même libellé que le serveur (buildBirthdayPushPayload). */
function birthdayLabel(days: number): string {
  if (days === 1) return "demain";
  if (days === 7) return "dans 1 semaine";
  if (days === 14) return "dans 2 semaines";
  if (days === 30) return "dans 1 mois";
  return `dans ${days} jours`;
}

/** Même libellé que le serveur (buildNamedayPushPayload). */
function namedayLabel(days: number): string {
  if (days === 1) return "demain";
  if (days === 7) return "dans 1 semaine";
  return `dans ${days} jours`;
}

/**
 * Toutes les échéances des HORIZON_DAYS prochains jours, triées.
 *
 * Mêmes règles que le serveur :
 * - `receiveNotifications: false` → aucun rappel pour la carte ;
 * - anniversaire : `timings` (jours avant, défaut [1]) + jour J si
 *   `notifyOnBirthday` ; comparaison mois + jour (un 29 février ne sonne
 *   donc que les années bissextiles, comme côté serveur) ;
 * - fête : `namedayPreferences.timings` (1 ou 7) + jour J si `notifyOnNameday`.
 *
 * Le jour 0 (aujourd'hui) est exclu : minuit est déjà passé.
 */
export function planReminders(dates: DateEntry[], now = new Date()): PlannedReminder[] {
  const out: PlannedReminder[] = [];

  for (const d of dates) {
    if (d.receiveNotifications === false) continue;
    const name = d.name || "Quelqu'un";

    const bPrefs = d.notificationPreferences ?? { timings: [1], notifyOnBirthday: true };
    const bOffsets = [
      ...(bPrefs.notifyOnBirthday !== false ? [0] : []),
      ...(bPrefs.timings ?? [1]),
    ];
    const birth = new Date(d.date);

    const nPrefs = d.namedayPreferences ?? { timings: [1], notifyOnNameday: true };
    const nOffsets = [
      ...(nPrefs.notifyOnNameday !== false ? [0] : []),
      ...(nPrefs.timings ?? [1]),
    ];
    const nd = d.nameday && /^\d{2}-\d{2}$/.test(d.nameday) ? d.nameday : null;
    const [ndMonth, ndDay] = nd ? nd.split("-").map(Number) : [0, 0];

    for (let day = 1; day <= HORIZON_DAYS; day++) {
      const fireAt = midnight(now, day);

      for (const offset of new Set(bOffsets)) {
        const target = midnight(now, day + offset);
        if (target.getMonth() !== birth.getMonth() || target.getDate() !== birth.getDate()) {
          continue;
        }
        out.push({
          id: `birthday-${d._id}-${offset}-${fireAt.getTime()}`,
          at: fireAt,
          title:
            offset === 0
              ? `🎂 C'est l'anniversaire de ${name} !`
              : `🎂 Anniversaire de ${name} ${birthdayLabel(offset)}`,
          body:
            offset === 0
              ? "Pensez à lui souhaiter un joyeux anniversaire 🎉"
              : "N'oubliez pas de préparer quelque chose !",
          dateId: d._id,
        });
      }

      if (!nd) continue;
      for (const offset of new Set(nOffsets)) {
        const target = midnight(now, day + offset);
        if (target.getMonth() + 1 !== ndMonth || target.getDate() !== ndDay) continue;
        out.push({
          id: `nameday-${d._id}-${offset}-${fireAt.getTime()}`,
          at: fireAt,
          title:
            offset === 0
              ? `🌸 C'est la fête de ${name} !`
              : `🌸 Fête de ${name} ${namedayLabel(offset)}`,
          body:
            offset === 0
              ? "Pensez à lui souhaiter une bonne fête 🎉"
              : "N'oubliez pas de lui souhaiter !",
          dateId: d._id,
        });
      }
    }
  }

  // Tri stable : à heure égale, l'ordre de calcul est conservé
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Ne garde que ce qu'iOS acceptera, et ajoute la notification « ouvre
 * l'app » : placée juste après le dernier rappel gardé si la liste a été
 * tronquée (sinon, plus rien ne sonnerait au-delà), à J+55 sinon.
 */
export function fitToLimit(planned: PlannedReminder[], now = new Date()): PlannedReminder[] {
  const kept = planned.slice(0, MAX_SCHEDULED - 1);
  const truncated = planned.length > kept.length;
  const last = kept[kept.length - 1];
  const wakeAt = truncated && last
    ? new Date(last.at.getTime() + 60_000) // une minute après le dernier
    : midnight(now, WAKE_UP_DAY);
  return [
    ...kept,
    {
      id: `wakeup-${wakeAt.getTime()}`,
      at: wakeAt,
      title: "📱 Ouvre BirthReminder",
      body: "Ouvre l'app pour continuer à recevoir tes rappels d'anniversaires.",
      dateId: null,
    },
  ];
}

// ---- Programmation ----

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Même canal que les push (lib/push.ts), qui n'est pas appelé en mode local
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifications BirthReminder",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3b82f6",
  });
}

export type ReminderPermission = "granted" | "denied" | "undetermined";

export async function getReminderPermission(): Promise<ReminderPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as ReminderPermission;
}

/**
 * Demande la permission si elle ne l'a jamais été. iOS n'affiche sa fenêtre
 * qu'une seule fois : après un refus, seul l'utilisateur peut revenir dessus
 * dans les Réglages du téléphone.
 */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  if (current.status === "denied" && !current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

/** Annule uniquement NOS notifications programmées. */
async function cancelOurs(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function remindersEnabled(): Promise<boolean> {
  const prefs = (await readLocal("prefs"))[0];
  return prefs?.remindersEnabled !== false;
}

async function doReschedule(): Promise<number> {
  await cancelOurs();
  if (!(await remindersEnabled())) return 0;
  if (!(await ensurePermission())) return 0;
  await ensureAndroidChannel();

  const now = new Date();
  const toSchedule = fitToLimit(planReminders(await localFetchDates(), now), now);
  for (const r of toSchedule) {
    if (r.at.getTime() <= now.getTime()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${r.id}`,
      content: {
        title: r.title,
        body: r.body,
        sound: "default",
        // Route mobile directe (voir webLinkToMobileRoute) : les ids locaux
        // ne ressemblent pas à ceux du serveur.
        data: { url: r.dateId ? `/date/${r.dateId}` : "/", localReminder: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: "default",
      },
    });
  }
  return toSchedule.length;
}

// Une seule reprogrammation à la fois ; une demande pendant qu'une autre
// tourne est regroupée en UNE relance à la fin (pas une par modification).
let running: Promise<number> | null = null;
let again = false;

export function rescheduleLocalReminders(): Promise<number> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let count = 0;
    do {
      again = false;
      try {
        count = await doReschedule();
      } catch (e) {
        console.warn("[local-reminders] reprogrammation impossible", e);
      }
    } while (again);
    return count;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Rappels programmés par nous, triés (écran Rappels). */
export async function listScheduledLocalReminders(): Promise<
  { title: string; at: Date | null }[]
> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((n) => n.identifier.startsWith(ID_PREFIX) && !n.identifier.includes("wakeup-"))
    .map((n) => {
      const t = n.trigger as { value?: number; date?: number | string } | null;
      const raw = t?.value ?? t?.date;
      return { title: n.content.title ?? "", at: raw != null ? new Date(raw) : null };
    })
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
}

/** Notification de test, dans 5 secondes (écran Rappels). */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: `${ID_PREFIX}test-${Date.now()}`,
    content: {
      title: "🎂 Rappel de test",
      body: "Tes rappels fonctionnent : tu seras prévenu à minuit le jour venu.",
      sound: "default",
      data: { url: "/", localReminder: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: "default",
    },
  });
  return true;
}

// ---- Cycle de vie (piloté par auth-context) ----

let stopFn: (() => void) | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

/**
 * Mode local actif : reprogramme maintenant, au retour au premier plan, et
 * après chaque modification (regroupées sur 800 ms : ajouter trois idées de
 * cadeau d'affilée ne déclenche qu'une reprogrammation).
 */
export function startLocalReminders(): void {
  if (stopFn) return;
  rescheduleLocalReminders();

  const unsubscribe = onLocalChange((c) => {
    if (c === "wishlist") return; // sans effet sur les rappels
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => rescheduleLocalReminders(), 800);
  });
  const appSub = AppState.addEventListener("change", (s) => {
    if (s === "active") rescheduleLocalReminders();
  });
  stopFn = () => {
    unsubscribe();
    appSub.remove();
    if (debounce) clearTimeout(debounce);
    debounce = null;
  };
}

/**
 * Sortie du mode local (connexion à un compte, effacement) : plus aucun
 * rappel local — le serveur prend le relais en mode compte.
 * Appelé aussi en mode compte au démarrage, pour nettoyer d'éventuels
 * restes d'une session locale précédente.
 */
export async function stopLocalReminders(): Promise<void> {
  stopFn?.();
  stopFn = null;
  try {
    await cancelOurs();
  } catch (e) {
    console.warn("[local-reminders] annulation impossible", e);
  }
}

import type * as CalendarTypes from "expo-calendar";
import * as SecureStore from "expo-secure-store";
import { Alert, Linking, Platform } from "react-native";
import { loadCalendarPrefs } from "./calendar-prefs";

/**
 * Ajout d'un événement BirthReminder au calendrier natif du téléphone.
 *
 * On n'écrit que sur appui explicite d'un bouton, et on ne parcourt jamais
 * l'agenda de l'utilisateur. Rien n'est synchronisé ensuite : une modification
 * côté BirthReminder ne met pas à jour l'entrée déjà créée.
 *
 * ⚠️ Anti-doublon. Appuyer trois fois sur le bouton créait trois entrées
 * identiques dans l'agenda, sans aucun moyen de le savoir depuis l'app. On
 * mémorise donc localement l'identifiant de l'entrée créée pour chaque
 * événement, ce qui permet au bouton de basculer en « déjà ajouté » et de
 * proposer de la retirer.
 *
 * Ce lien est délibérément vérifié à chaque affichage (`getLinkedEventId`) :
 * si l'utilisateur a supprimé l'entrée à la main dans son agenda, on l'oublie
 * et le bouton redevient « Ajouter ». Sans cette vérification, l'app
 * prétendrait indéfiniment que l'événement est dans un calendrier où il n'est
 * plus.
 */

const CALENDAR_TITLE = "BirthReminder";
const LINK_PREFIX = "cal_event_";

/**
 * `expo-calendar` embarque du code natif : il n'existe que dans un binaire
 * reconstruit après son ajout. Un `import` statique s'évalue au chargement du
 * module et lève « Cannot find native module 'ExpoCalendar' » dans un client
 * de développement plus ancien — ce qui faisait échouer l'évaluation de tout
 * l'écran Agenda et de la page événement (« Route is missing the required
 * default export »), alors qu'ils n'ont rien à voir avec le calendrier.
 *
 * On le charge donc paresseusement et sans jamais lever : si le module natif
 * est absent, `isCalendarAvailable()` renvoie false et l'interface masque
 * simplement le bouton. Le reste de l'app fonctionne normalement.
 */
let cachedModule: typeof CalendarTypes | null | undefined;

function getCalendar(): typeof CalendarTypes | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // require() et non import : l'évaluation doit rester dans le try.
    cachedModule = require("expo-calendar") as typeof CalendarTypes;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** Le module natif est-il présent dans ce binaire ? */
export function isCalendarAvailable(): boolean {
  return getCalendar() !== null;
}

/** Clé SecureStore : les caractères non alphanumériques y sont interdits. */
const linkKey = (eventKey: string) =>
  `${LINK_PREFIX}${eventKey.replace(/[^A-Za-z0-9._-]/g, "_")}`;

/**
 * Identifiant de l'entrée d'agenda créée pour cet événement, ou null.
 * Renvoie null — et oublie le lien — si l'entrée n'existe plus côté système.
 */
export async function getLinkedEventId(
  eventKey: string,
): Promise<string | null> {
  const Calendar = getCalendar();
  if (!Calendar) return null;
  try {
    const id = await SecureStore.getItemAsync(linkKey(eventKey));
    if (!id) return null;

    // Sans permission on ne peut pas vérifier : on préfère annoncer « pas
    // ajouté » plutôt que de bloquer l'utilisateur sur un état faux.
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== "granted") return null;

    try {
      const ev = await Calendar.getEventAsync(id);
      if (ev?.id) return id;
    } catch {
      // Entrée supprimée à la main dans l'agenda → on oublie le lien.
    }
    await SecureStore.deleteItemAsync(linkKey(eventKey));
    return null;
  } catch {
    return null;
  }
}

/** Retire l'entrée du calendrier et oublie le lien. */
export async function removeFromDeviceCalendar(
  eventKey: string,
): Promise<boolean> {
  const Calendar = getCalendar();
  if (!Calendar) return false;
  try {
    const id = await SecureStore.getItemAsync(linkKey(eventKey));
    if (id) {
      try {
        await Calendar.deleteEventAsync(id);
      } catch {
        // Déjà supprimée côté agenda : on continue, l'objectif est atteint.
      }
      await SecureStore.deleteItemAsync(linkKey(eventKey));
    }
    return true;
  } catch (e: any) {
    Alert.alert(
      "Impossible de retirer du calendrier",
      e?.message ?? "Une erreur est survenue.",
    );
    return false;
  }
}

/** Durée par défaut d'un événement sans heure de fin connue. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

async function ensurePermission(): Promise<boolean> {
  const Calendar = getCalendar();
  if (!Calendar) return false;
  const { status: existing } = await Calendar.getCalendarPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Calendar.requestCalendarPermissionsAsync();
    status = req.status;
  }
  if (status === "granted") return true;

  // Refus définitif : iOS ne redemande plus, il faut passer par les Réglages.
  Alert.alert(
    "Accès au calendrier refusé",
    "Autorise BirthReminder à accéder à ton calendrier dans les réglages du téléphone pour utiliser cette fonction.",
    [
      { text: "Plus tard", style: "cancel" },
      { text: "Ouvrir les réglages", onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

/**
 * Calendrier dans lequel écrire.
 * iOS : le calendrier par défaut de la source locale ; on retombe sur le
 * premier calendrier modifiable si l'appareil n'en expose pas.
 * Android : le premier calendrier accessible en écriture du compte principal.
 */
async function resolveTargetCalendarId(): Promise<string | null> {
  const Calendar = getCalendar();
  if (!Calendar) return null;
  if (Platform.OS === "ios") {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id && def.allowsModifications) return def.id;
    } catch {
      // Certains appareils n'ont pas de calendrier par défaut : on continue.
    }
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const writable = calendars.filter((c) => c.allowsModifications);
  if (writable.length === 0) return null;

  // Préfère un calendrier "principal" quand la plateforme l'indique.
  const primary = writable.find(
    (c) => (c as { isPrimary?: boolean }).isPrimary,
  );
  return (primary ?? writable[0]).id;
}

export interface CalendarEventInput {
  /** Identifiant stable de l'événement BirthReminder (shortId). Sert d'ancre
   *  au lien anti-doublon décrit en tête de fichier. */
  eventKey: string;
  title: string;
  /** Début de l'événement. */
  startDate: Date;
  /** Fin ; par défaut début + 2 h. */
  endDate?: Date;
  /** Journée entière (anniversaires, fêtes). */
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
}

/**
 * Crée l'événement dans le calendrier natif et mémorise le lien.
 * Gère seule permissions et messages d'erreur ; renvoie `true` si l'entrée a
 * bien été créée, `false` sinon (refus, aucun calendrier inscriptible, erreur).
 */
export async function addToDeviceCalendar(
  input: CalendarEventInput,
): Promise<boolean> {
  const Calendar = getCalendar();
  if (!Calendar) {
    Alert.alert(
      "Fonction indisponible",
      "L'ajout au calendrier nécessite une version plus récente de l'application.",
    );
    return false;
  }
  try {
    if (!(await ensurePermission())) return false;

    // Garde-fou : si l'entrée existe déjà, on ne la duplique pas. L'appelant
    // masque normalement le bouton dans ce cas, mais deux appuis rapprochés
    // peuvent passer avant que son état soit rafraîchi.
    const existing = await getLinkedEventId(input.eventKey);
    if (existing) {
      Alert.alert(
        "Déjà dans ton calendrier",
        `« ${input.title} » y figure déjà.`,
      );
      return false;
    }

    const calendarId = await resolveTargetCalendarId();
    if (!calendarId) {
      Alert.alert(
        "Aucun calendrier disponible",
        "Aucun calendrier modifiable n'a été trouvé sur cet appareil.",
      );
      return false;
    }

    const startDate = input.startDate;
    const endDate =
      input.endDate ?? new Date(startDate.getTime() + DEFAULT_DURATION_MS);

    // ⚠️ `alarms` est indispensable. Sans ce champ, ni iOS ni Android ne posent
    // le moindre rappel : l'entrée n'existe qu'à son heure, et l'utilisateur a
    // l'impression que « l'ajout au calendrier ne prévient de rien ». Les
    // agendas n'appliquent PAS leurs rappels par défaut à un événement créé par
    // une application tierce qui n'en demande aucun.
    //
    // Les décalages viennent des réglages (Profil → Réglages → Calendrier), et
    // diffèrent selon le type d'entrée : un événement a une heure, un
    // anniversaire est une journée entière qui commence à minuit — d'où deux
    // listes distinctes plutôt qu'une seule mal adaptée aux deux.
    const allDay = input.allDay ?? false;
    const prefs = await loadCalendarPrefs();
    const offsets = allDay ? prefs.allDay : prefs.timed;

    const createdId = await Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate,
      endDate,
      allDay,
      location: input.location ?? undefined,
      notes: input.notes ?? `Ajouté depuis ${CALENDAR_TITLE}`,
      alarms: offsets.map((relativeOffset) => ({ relativeOffset })),
    });

    if (createdId) {
      await SecureStore.setItemAsync(linkKey(input.eventKey), createdId);
    }

    Alert.alert(
      "Ajouté au calendrier",
      offsets.length
        ? `« ${input.title} » a été ajouté à ton calendrier, avec ${offsets.length > 1 ? "tes rappels" : "ton rappel"}.`
        : `« ${input.title} » a été ajouté à ton calendrier. Aucun rappel n'est posé — tu peux en choisir dans Profil → Réglages.`,
    );
    return true;
  } catch (e: any) {
    Alert.alert(
      "Impossible d'ajouter au calendrier",
      e?.message ?? "Une erreur est survenue.",
    );
    return false;
  }
}

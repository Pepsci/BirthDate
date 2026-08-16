import * as Calendar from "expo-calendar";
import { Alert, Linking, Platform } from "react-native";

/**
 * Ajout d'un événement BirthReminder au calendrier natif du téléphone.
 *
 * Volontairement en écriture seule : on ne lit jamais le calendrier de
 * l'utilisateur, on n'y écrit que sur appui explicite d'un bouton. Rien n'est
 * synchronisé ensuite — une modification côté BirthReminder ne met pas à jour
 * l'entrée déjà créée (ce serait un vrai mécanisme de sync, hors périmètre).
 */

const CALENDAR_TITLE = "BirthReminder";

/** Durée par défaut d'un événement sans heure de fin connue. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

async function ensurePermission(): Promise<boolean> {
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
 * Crée l'événement dans le calendrier natif.
 * Gère seule permissions et messages d'erreur ; renvoie `true` si l'entrée a
 * bien été créée, `false` sinon (refus, aucun calendrier inscriptible, erreur).
 */
export async function addToDeviceCalendar(
  input: CalendarEventInput,
): Promise<boolean> {
  try {
    if (!(await ensurePermission())) return false;

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

    await Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate,
      endDate,
      allDay: input.allDay ?? false,
      location: input.location ?? undefined,
      notes: input.notes ?? `Ajouté depuis ${CALENDAR_TITLE}`,
    });

    Alert.alert(
      "Ajouté au calendrier",
      `« ${input.title} » a été ajouté à ton calendrier.`,
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

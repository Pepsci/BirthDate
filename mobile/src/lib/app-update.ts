import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { CHANGELOG } from "./changelog";

/**
 * Bandeaux de l'accueil : « Nouvelle version disponible » et annonce libre.
 *
 * Source : GET /api/app-version, édité depuis l'admin web (« Bandeaux app ») —
 * version publiée, textes, annonce. En ligne immédiatement, sans nouveau
 * build de l'app.
 *
 * Version installée : CHANGELOG[0].version, embarquée dans le bundle JS.
 * On ne lit PAS `expo.version` (app.json) : elle est restée longtemps figée à
 * 1.0.0 et n'est alignée sur le changelog que depuis la 2.3.2.
 */
export const INSTALLED_VERSION = CHANGELOG[0]?.version ?? "0.0.0";

const PLATFORM = Platform.OS === "ios" ? "ios" : "android";

export interface AvailableUpdate {
  version: string;
  url: string;
  title: string | null;
  message: string | null;
}

export interface Announcement {
  id: string;
  title: string | null;
  message: string | null;
  /** https://… (navigateur) ou /écran-de-l-app */
  url: string | null;
}

interface ApiRelease {
  version: string | null;
  url: string | null;
  title?: string | null;
  message?: string | null;
}

interface ApiResponse {
  android: ApiRelease | null;
  ios: ApiRelease | null;
  announcement: (Announcement & { platforms: string[] }) | null;
}

/** "2.10.0" > "2.9.3" : comparaison numérique, segment par segment. */
export function isNewer(latest: string, installed: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = installed.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// ── Annonces déjà fermées (mémorisées sur le téléphone) ────────────────────
const DISMISSED_KEY = "br-dismissed-announcements";
const DISMISSED_MAX = 20;

async function getDismissed(): Promise<string[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(DISMISSED_KEY)) || "[]");
  } catch {
    return [];
  }
}

/** Une annonce fermée ne revient jamais (sauf nouvel id côté serveur). */
export async function dismissAnnouncement(id: string): Promise<void> {
  const ids = (await getDismissed()).filter((x) => x !== id);
  ids.push(id);
  await SecureStore.setItemAsync(
    DISMISSED_KEY,
    JSON.stringify(ids.slice(-DISMISSED_MAX)),
  ).catch(() => {});
}

// ── Bandeau « nouvelle version » déjà fermé ────────────────────────────────
// On mémorise la VERSION annoncée au moment de la fermeture : le bandeau ne
// revient plus pour cette version-là, ni au prochain lancement ni après. Il
// réapparaît dès que l'admin annonce un AUTRE numéro, plus récent que la
// version installée. (Il n'était mémorisé que le temps d'une session : il revenait donc
// à chaque ouverture de l'app, même fermé à la main.)
const DISMISSED_UPDATE_KEY = "br-dismissed-update-version";

export async function dismissUpdate(version: string): Promise<void> {
  await SecureStore.setItemAsync(DISMISSED_UPDATE_KEY, version).catch(() => {});
}

async function getDismissedUpdate(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DISMISSED_UPDATE_KEY);
  } catch {
    return null;
  }
}

/**
 * Ce qu'il faut afficher. Jamais d'erreur : un bandeau absent ne gêne
 * personne (serveur injoignable, plateforme non renseignée…).
 *
 * ⚠️ Mode compte uniquement : en mode local, aucune requête ne part
 * (docs/MODE_LOCAL.md) — l'appelant vérifie le mode avant.
 */
export async function fetchHomeBanners(): Promise<{
  update: AvailableUpdate | null;
  announcement: Announcement | null;
}> {
  try {
    const res = await api<ApiResponse>("/app-version");

    const rel = res[PLATFORM];
    const dismissedUpdate = await getDismissedUpdate();
    const update =
      rel?.version &&
      rel.url &&
      isNewer(rel.version, INSTALLED_VERSION) &&
      // Fermé pour CETTE version précise : on ne le remontre pas. Comparaison
      // à l'identique, pas « plus récente que » : si un numéro trop grand a
      // été saisi par erreur dans l'admin puis corrigé à la baisse, le bandeau
      // doit revenir pour la vraie version suivante.
      rel.version !== dismissedUpdate
        ? {
            version: rel.version,
            url: rel.url,
            title: rel.title ?? null,
            message: rel.message ?? null,
          }
        : null;

    let announcement: Announcement | null = null;
    const a = res.announcement;
    if (a && a.platforms.includes(PLATFORM)) {
      const dismissed = await getDismissed();
      if (!dismissed.includes(a.id)) {
        announcement = { id: a.id, title: a.title, message: a.message, url: a.url };
      }
    }

    return { update, announcement };
  } catch {
    return { update: null, announcement: null };
  }
}

import { Platform } from "react-native";
import { api } from "./api";
import { CHANGELOG } from "./changelog";

/**
 * « Une nouvelle version est disponible » — comparaison de versions.
 *
 * Version installée : CHANGELOG[0].version, embarquée dans le bundle JS.
 * On ne lit PAS `expo.version` (app.json) : elle reste figée à 1.0.0, seuls
 * les numéros de build bougent.
 *
 * Dernière version : GET /api/app-version (server/config/mobileRelease.json),
 * renseignée à la main une fois le build réellement disponible en store.
 */
export const INSTALLED_VERSION = CHANGELOG[0]?.version ?? "0.0.0";

export interface AvailableUpdate {
  version: string;
  url: string;
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

/**
 * La mise à jour à proposer, ou null (à jour, plateforme non renseignée,
 * serveur injoignable). Jamais d'erreur : un bandeau absent ne gêne personne.
 *
 * ⚠️ Mode compte uniquement : en mode local, aucune requête ne part
 * (docs/MODE_LOCAL.md) — l'appelant vérifie le mode avant.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  try {
    const res = await api<Record<string, AvailableUpdate | null>>("/app-version");
    const latest = res[Platform.OS === "ios" ? "ios" : "android"];
    if (!latest?.version || !latest.url) return null;
    return isNewer(latest.version, INSTALLED_VERSION) ? latest : null;
  } catch {
    return null;
  }
}

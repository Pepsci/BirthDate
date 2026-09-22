import { api } from "./api";
import { isLocalMode } from "./app-mode";
import { localFetchDates } from "./local-dates";

/**
 * Stats publiques de la communauté (mêmes chiffres que la landing web).
 * Route : GET /api/date/stats — 🌍 public, aucune donnée personnelle.
 */
export interface PublicStats {
  today: number;
  thisMonth: number;
  thisYear: number;
  total: number;
  totalUsers: number;
}

export function fetchPublicStats(): Promise<PublicStats> {
  return api<PublicStats>("/date/stats");
}

/**
 * Mêmes chiffres, mais restreints aux dates de l'utilisateur connecté.
 * Route : GET /api/date/stats/me — 🔒 authentifiée.
 * `total` = nombre de proches enregistrés (et non le total communauté).
 */
export function fetchMyStats(): Promise<PublicStats> {
  if (isLocalMode()) return localMyStats();
  return api<PublicStats>("/date/stats/me");
}

/**
 * Mode local : mêmes chiffres que GET /date/stats/me, calculés sur les
 * cartes du téléphone (même formule que server/routes/date.stats.js).
 * `totalUsers` n'a pas de sens sans serveur : 0, jamais affiché en mode perso.
 */
async function localMyStats(): Promise<PublicStats> {
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const dates = await localFetchDates();
  let today = 0;
  let thisMonth = 0;
  for (const entry of dates) {
    const d = new Date(entry.date);
    if (d.getMonth() + 1 !== todayMonth) continue;
    thisMonth++;
    if (d.getDate() === todayDay) today++;
  }
  // Côté serveur, la condition de `thisYear` est toujours vraie : il vaut
  // le total. Reproduit tel quel pour afficher la même chose dans les deux modes.
  return { today, thisMonth, thisYear: dates.length, total: dates.length, totalUsers: 0 };
}

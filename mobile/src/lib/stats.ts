import { api } from "./api";

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
  return api<PublicStats>("/date/stats/me");
}

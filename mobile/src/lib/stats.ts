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

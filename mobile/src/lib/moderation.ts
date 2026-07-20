/**
 * moderation.ts — Signalement de contenu et blocage d'utilisateurs.
 * Conformité stores : Apple guideline 1.2 / Google Play UGC policy.
 * Backend : server/routes/moderation.js (/api/moderation/*)
 */

import { Alert } from "react-native";
import { api } from "./api";

export type ReportContentType =
  | "message"
  | "eventMessage"
  | "giftProposal"
  | "wishlist"
  | "user"
  | "other";

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "scam"
  | "other";

export interface BlockedUser {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string;
  email?: string;
}

// ---- API ----

export async function reportContent(params: {
  contentType: ReportContentType;
  contentId?: string;
  targetUserId?: string;
  reason: ReportReason;
  details?: string;
  contentPreview?: string;
}): Promise<void> {
  await api("/moderation/reports", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function blockUser(userId: string): Promise<void> {
  await api(`/moderation/block/${userId}`, { method: "POST" });
}

export async function unblockUser(userId: string): Promise<void> {
  await api(`/moderation/block/${userId}`, { method: "DELETE" });
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  return api("/moderation/blocked");
}

// ---- Helpers UI (Alert natif, pas de dépendance) ----

const REASON_LABELS: [ReportReason, string][] = [
  ["spam", "Spam"],
  ["harassment", "Harcèlement"],
  ["inappropriate", "Contenu inapproprié"],
  ["scam", "Arnaque / fraude"],
  ["other", "Autre"],
];

/** Ouvre le choix du motif puis envoie le signalement. */
export function promptReport(
  params: {
    contentType: ReportContentType;
    contentId?: string;
    targetUserId?: string;
    contentPreview?: string;
  },
  onDone?: () => void,
): void {
  Alert.alert("Signaler", "Pourquoi signales-tu ce contenu ?", [
    ...REASON_LABELS.map(([reason, label]) => ({
      text: label,
      onPress: async () => {
        try {
          await reportContent({ ...params, reason });
          Alert.alert(
            "Merci",
            "Ton signalement a bien été envoyé. Notre équipe le traite sous 24 h.",
          );
          onDone?.();
        } catch (e: any) {
          Alert.alert("Erreur", e?.message ?? "Signalement impossible.");
        }
      },
    })),
    { text: "Annuler", style: "cancel" as const },
  ]);
}

/** Confirme puis bloque un utilisateur. */
export function promptBlock(
  userId: string,
  userName: string,
  onBlocked?: () => void,
): void {
  Alert.alert(
    `Bloquer ${userName} ?`,
    "Ses messages et son contenu ne te seront plus visibles. Tu peux débloquer à tout moment depuis Profil → Utilisateurs bloqués.",
    [
      { text: "Annuler", style: "cancel" },
      {
        text: "Bloquer",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(userId);
            Alert.alert("Utilisateur bloqué", `${userName} a été bloqué·e.`);
            onBlocked?.();
          } catch (e: any) {
            Alert.alert("Erreur", e?.message ?? "Blocage impossible.");
          }
        },
      },
    ],
  );
}

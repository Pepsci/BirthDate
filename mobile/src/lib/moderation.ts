/**
 * moderation.ts : Signalement de contenu et blocage d'utilisateurs.
 * Conformité stores : Apple guideline 1.2 / Google Play UGC policy.
 * Backend : server/routes/moderation.js (/api/moderation/*)
 */

import { t } from "@/i18n";
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

const REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "inappropriate",
  "scam",
  "other",
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
  Alert.alert(t("common:actions.report"), t("chat:report.why"), [
    ...REASONS.map((reason) => ({
      text: t(`chat:report.reason.${reason}`),
      onPress: async () => {
        try {
          await reportContent({ ...params, reason });
          Alert.alert(
            t("chat:report.thanks"),
            t("chat:report.sent"),
          );
          onDone?.();
        } catch (e: any) {
          Alert.alert(t("common:errors.title"), e?.message ?? t("chat:report.error"));
        }
      },
    })),
    { text: t("common:actions.cancel"), style: "cancel" as const },
  ]);
}

/** Confirme puis bloque un utilisateur. */
export function promptBlock(
  userId: string,
  userName: string,
  onBlocked?: () => void,
): void {
  Alert.alert(
    t("chat:block.title", { name: userName }),
    t("chat:block.text"),
    [
      { text: t("common:actions.cancel"), style: "cancel" },
      {
        text: t("chat:block.action"),
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(userId);
            Alert.alert(t("chat:block.doneTitle"), t("chat:block.done", { name: userName }));
            onBlocked?.();
          } catch (e: any) {
            Alert.alert(t("common:errors.title"), e?.message ?? t("chat:block.error"));
          }
        },
      },
    ],
  );
}

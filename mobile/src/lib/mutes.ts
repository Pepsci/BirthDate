import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/**
 * Silencieux par conversation — privée ou discussion d'événement.
 *
 * ⚠️ Ne coupe que les notifications PUSH. La conversation continue de remonter
 * dans la liste avec son badge de non-lus : couper les deux ferait disparaître
 * les messages sans laisser de trace.
 */
export type MuteKind = "dm" | "event";
export type MuteDuration = "1h" | "8h" | "1w" | "forever";

export interface ChatMute {
  kind: MuteKind;
  targetId: string;
  /** `null` = « toujours », jusqu'à réactivation explicite. */
  until: string | null;
}

export const MUTE_CHOICES: { value: MuteDuration; label: string }[] = [
  { value: "1h", label: "1 heure" },
  { value: "8h", label: "8 heures" },
  { value: "1w", label: "1 semaine" },
  { value: "forever", label: "Jusqu'à réactivation" },
];

export async function fetchMutes(): Promise<ChatMute[]> {
  return api<ChatMute[]>("/mutes");
}

export async function muteChat(
  kind: MuteKind,
  targetId: string,
  duration: MuteDuration,
): Promise<ChatMute> {
  return api<ChatMute>("/mutes", {
    method: "PUT",
    body: JSON.stringify({ kind, targetId, duration }),
  });
}

export async function unmuteChat(
  kind: MuteKind,
  targetId: string,
): Promise<void> {
  await api(`/mutes/${kind}/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
  });
}

/** « jusqu'à 14 h 30 », « jusqu'au 12 mars », ou « jusqu'à réactivation ». */
export function muteLabel(until: string | null): string {
  if (!until) return "jusqu'à réactivation";
  const d = new Date(until);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `jusqu'à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : `jusqu'au ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

/**
 * État du silencieux d'UNE conversation. `targetId` peut arriver en retard
 * (l'écran de chat privé ne connaît son id de conversation qu'après le
 * premier chargement) : le hook attend qu'il existe.
 */
export function useMute(kind: MuteKind, targetId: string | null) {
  const [mute, setMute] = useState<ChatMute | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetId) return;
    try {
      const all = await fetchMutes();
      setMute(
        all.find((m) => m.kind === kind && m.targetId === targetId) ?? null,
      );
    } catch {
      // Silencieux illisible : on n'affiche pas de cloche barrée à tort.
      setMute(null);
    } finally {
      setLoaded(true);
    }
  }, [kind, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = useCallback(
    async (duration: MuteDuration) => {
      if (!targetId) return;
      setMute(await muteChat(kind, targetId, duration));
    },
    [kind, targetId],
  );

  const clear = useCallback(async () => {
    if (!targetId) return;
    await unmuteChat(kind, targetId);
    setMute(null);
  }, [kind, targetId]);

  return { mute, loaded, set, clear, refresh };
}

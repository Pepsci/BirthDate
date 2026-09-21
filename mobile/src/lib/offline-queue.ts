import { useSyncExternalStore } from "react";
import { api, ApiError, NetworkError } from "./api";
import { readCache, writeCache } from "./offline-cache";
import { isOffline, subscribeOfflineStatus } from "./offline-status";
import type { DateEntry, DatePayload } from "./dates";

/**
 * File d'attente des modifications de dates faites hors ligne.
 *
 * Principe :
 *  1. Sans réseau, createDate / updateDate / deleteDate (lib/dates.ts)
 *     déposent l'opération ici au lieu d'échouer.
 *  2. Les écrans affichent tout de suite le résultat attendu : la file est
 *     « superposée » à la liste (applyQueue), avec `pending: true`.
 *  3. Au retour du réseau (ou au retour de l'app au premier plan), la file est
 *     envoyée dans l'ordre (flushQueue).
 *
 * Simplification clé : les opérations sont FUSIONNÉES à l'ajout.
 *  - modifier une carte créée hors ligne → on modifie la création en attente ;
 *  - supprimer une carte créée hors ligne → la création disparaît, rien à envoyer ;
 *  - plusieurs modifications d'une même carte → une seule, cumulée.
 * Un identifiant provisoire ("tmp-…") n'existe donc que dans une création :
 * aucune opération envoyée au serveur n'y fait référence.
 *
 * Périmètre : cartes manuelles uniquement (nom, prénom, date, fête, famille).
 * Photos, cadeaux, amis, listes communes, événements restent en ligne seulement.
 */

type Op =
  | { kind: "create"; tempId: string; payload: DatePayload; queuedAt: number; attempts: number }
  | { kind: "update"; id: string; payload: Partial<DatePayload>; queuedAt: number; attempts: number }
  | { kind: "delete"; id: string; label: string; queuedAt: number; attempts: number };

const QUEUE_KEY = "queue-dates";
const DATES_CACHE_KEY = "dates"; // même clé que lib/dates.ts
/** Au-delà, une erreur serveur (5xx) répétée fait abandonner l'opération. */
const MAX_ATTEMPTS = 3;

interface QueueState {
  ops: Op[];
  /** Messages des opérations abandonnées, à montrer à l'utilisateur. */
  failures: string[];
  syncing: boolean;
}

let state: QueueState = { ops: [], failures: [], syncing: false };
let loaded = false;
const listeners = new Set<() => void>();
/** Écrans à recharger après un envoi réussi (ids provisoires → vrais ids). */
const flushedListeners = new Set<() => void>();
/** Carte créée hors ligne puis envoyée : id provisoire → vrai id. */
const resolvedIds = new Map<string, string>();

function setState(next: Partial<QueueState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

async function persist() {
  await writeCache(QUEUE_KEY, state.ops);
}

/** Relit la file du compte courant (à appeler une fois le propriétaire connu). */
export async function loadQueue(): Promise<void> {
  const cached = await readCache<Op[]>(QUEUE_KEY);
  loaded = true;
  setState({ ops: cached?.data ?? [], failures: [] });
}

/** Oublie tout (déconnexion). Le fichier est supprimé avec le reste du cache. */
export function resetQueue() {
  loaded = false;
  resolvedIds.clear();
  setState({ ops: [], failures: [], syncing: false });
}

export function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

export function resolveId(id: string): string {
  return resolvedIds.get(id) ?? id;
}

export function pendingCount(): number {
  return state.ops.length;
}

function labelOf(p: Partial<DatePayload>, fallback = "une carte"): string {
  const s = `${p.name ?? ""} ${p.surname ?? ""}`.trim();
  return s || fallback;
}

// ── Ajout dans la file (avec fusion) ─────────────────────────────────────────

export async function queueCreate(payload: DatePayload): Promise<DateEntry> {
  const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setState({
    ops: [...state.ops, { kind: "create", tempId, payload, queuedAt: Date.now(), attempts: 0 }],
  });
  await persist();
  return entryFromCreate(tempId, payload);
}

export async function queueUpdate(
  id: string,
  payload: Partial<DatePayload>,
): Promise<void> {
  const ops = [...state.ops];
  const create = ops.findIndex((o) => o.kind === "create" && o.tempId === id);
  const update = ops.findIndex((o) => o.kind === "update" && o.id === id);
  if (create >= 0) {
    const op = ops[create] as Extract<Op, { kind: "create" }>;
    ops[create] = { ...op, payload: { ...op.payload, ...payload } };
  } else if (update >= 0) {
    const op = ops[update] as Extract<Op, { kind: "update" }>;
    ops[update] = { ...op, payload: { ...op.payload, ...payload } };
  } else {
    ops.push({ kind: "update", id, payload, queuedAt: Date.now(), attempts: 0 });
  }
  setState({ ops });
  await persist();
}

export async function queueDelete(id: string, label: string): Promise<void> {
  let ops: Op[];
  if (isTempId(id)) {
    // Jamais envoyée : il suffit de l'oublier
    ops = state.ops.filter((o) => !(o.kind === "create" && o.tempId === id));
  } else {
    ops = state.ops.filter((o) => !(o.kind === "update" && o.id === id));
    ops.push({ kind: "delete", id, label, queuedAt: Date.now(), attempts: 0 });
  }
  setState({ ops });
  await persist();
}

// ── Superposition de la file aux données affichées ───────────────────────────

function entryFromCreate(tempId: string, p: DatePayload): DateEntry {
  return {
    _id: tempId,
    date: p.date,
    name: p.name,
    surname: p.surname,
    nameday: p.nameday ?? null,
    family: !!p.family,
    linkedUser: null,
    pending: true,
  };
}

/** Liste telle qu'elle sera une fois la file envoyée. */
export function applyQueue(dates: DateEntry[]): DateEntry[] {
  if (state.ops.length === 0) return dates;
  let list = [...dates];
  for (const op of state.ops) {
    if (op.kind === "create") {
      list.push(entryFromCreate(op.tempId, op.payload));
    } else if (op.kind === "update") {
      list = list.map((d) =>
        d._id === op.id ? { ...d, ...op.payload, pending: true } : d,
      );
    } else {
      list = list.filter((d) => d._id !== op.id);
    }
  }
  return list;
}

/** Une carte, avec ses modifications en attente (null si supprimée ou inconnue). */
export function applyQueueToEntry(
  id: string,
  entry: DateEntry | null,
): DateEntry | null {
  let result = entry;
  for (const op of state.ops) {
    if (op.kind === "create" && op.tempId === id) {
      result = entryFromCreate(op.tempId, op.payload);
    } else if (op.kind === "update" && op.id === id && result) {
      result = { ...result, ...op.payload, pending: true };
    } else if (op.kind === "delete" && op.id === id) {
      result = null;
    }
  }
  return result;
}

// ── Envoi ────────────────────────────────────────────────────────────────────

async function send(op: Op): Promise<void> {
  if (op.kind === "create") {
    const created = await api<DateEntry>("/date", {
      method: "POST",
      body: JSON.stringify(op.payload),
    });
    resolvedIds.set(op.tempId, created._id);
  } else if (op.kind === "update") {
    await api(`/date/${op.id}`, {
      method: "PATCH",
      body: JSON.stringify(op.payload),
    });
  } else {
    await api(`/date/${op.id}`, { method: "DELETE" });
  }
}

function describeFailure(op: Op, e: unknown): string {
  const what =
    op.kind === "create"
      ? `l'ajout de ${labelOf(op.payload)}`
      : op.kind === "update"
        ? `la modification de ${labelOf(op.payload)}`
        : `la suppression de ${op.label}`;
  if (e instanceof ApiError && e.status === 404) {
    return `Impossible d'appliquer ${what} : la carte n'existe plus.`;
  }
  const reason = e instanceof Error ? e.message : "erreur inconnue";
  return `Impossible d'appliquer ${what} (${reason}).`;
}

/**
 * Envoie la file dans l'ordre. S'arrête au premier problème de réseau (on
 * réessaiera plus tard) ; abandonne une opération refusée par le serveur.
 */
export async function flushQueue(): Promise<void> {
  if (!loaded || state.syncing || state.ops.length === 0) return;
  setState({ syncing: true });
  let sentSomething = false;
  try {
    while (state.ops.length > 0) {
      const op = state.ops[0];
      try {
        await send(op);
        sentSomething = true;
        setState({ ops: state.ops.slice(1) });
        await persist();
      } catch (e) {
        if (e instanceof NetworkError) break; // toujours hors ligne
        const retryable =
          e instanceof ApiError && e.status >= 500 && op.attempts + 1 < MAX_ATTEMPTS;
        if (retryable) {
          setState({ ops: [{ ...op, attempts: op.attempts + 1 }, ...state.ops.slice(1)] });
          await persist();
          break; // on retentera au prochain déclencheur
        }
        // Refus définitif (400, 403, 404…) ou trop d'essais : on abandonne
        setState({
          ops: state.ops.slice(1),
          failures: [...state.failures, describeFailure(op, e)],
        });
        await persist();
      }
    }
    if (sentSomething) {
      // Cache rafraîchi avec la version serveur (vrais ids, fête auto-détectée)
      try {
        const fresh = await api<DateEntry[]>("/date");
        await writeCache(DATES_CACHE_KEY, fresh);
      } catch {
        // pas grave : le prochain chargement d'écran s'en chargera
      }
      flushedListeners.forEach((l) => l());
    }
  } finally {
    setState({ syncing: false });
  }
}

/** Appelé après chaque envoi réussi de la file : l'écran doit se recharger. */
export function onQueueFlushed(listener: () => void): () => void {
  flushedListeners.add(listener);
  return () => {
    flushedListeners.delete(listener);
  };
}

export function clearFailures() {
  setState({ failures: [] });
}

/**
 * Déclencheurs d'envoi : retour du réseau et démarrage. Le retour de l'app au
 * premier plan est branché dans auth-context (qui gère déjà AppState).
 * @returns fonction de désabonnement
 */
export function startQueueSync(): () => void {
  flushQueue();
  return subscribeOfflineStatus(() => {
    if (!isOffline()) flushQueue();
  });
}

// ── Hook d'affichage ─────────────────────────────────────────────────────────

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useQueueStatus(): QueueState {
  return useSyncExternalStore(subscribeQueue, () => state);
}

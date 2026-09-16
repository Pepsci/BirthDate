/**
 * Réponse directe depuis une notification de message, comme sur WhatsApp.
 *
 * Parcours :
 *  1. La push porte `categoryId: "chat_message"` (serveur, pushService.js) :
 *     iOS / Android affichent un bouton « Répondre » avec un champ texte.
 *  2. L'utilisateur tape sa réponse → on la met d'abord en FILE (SecureStore),
 *     puis on tente l'envoi par REST (pas de socket : l'app peut être fermée).
 *  3. Envoi réussi → retiré de la file, conversation marquée lue, notif retirée.
 *
 * ⚠️ Pourquoi une file. iOS relance l'app en arrière-plan pour traiter la
 * réponse, mais peut la suspendre au bout de quelques secondes. Le plugin
 * natif `withNotifReplyKeepAlive` demande ~25 s de sursis ; si ça ne suffit
 * pas (réseau lent), la réponse reste en file et part au lancement suivant.
 * Le serveur déduplique grâce à `clientId` = identifiant de la notification :
 * rejouer n'envoie jamais deux fois.
 *
 * ⚠️ Chiffrement : même règle que l'écran de chat — chiffré seulement si ma clé
 * privée, la clé publique de l'ami et la mienne sont toutes disponibles.
 */
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { api, ApiError } from "./api";
import { getPrivateKey, encryptMessage } from "./crypto";
import { fetchUserPublicKey } from "./conversations";

export const CHAT_CATEGORY = "chat_message"; // = pushService.js
export const REPLY_ACTION = "reply";

const QUEUE_KEY = "pendingNotifReplies";

type PendingReply = {
  clientId: string;
  conversationId: string;
  friendId: string | null;
  myUserId: string | null;
  senderPublicKey: string | null;
  senderName: string | null;
  text: string;
  notificationId: string;
};

/** À appeler au démarrage : la catégorie doit exister AVANT l'arrivée d'une push. */
export async function registerChatReplyCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(CHAT_CATEGORY, [
      {
        identifier: REPLY_ACTION,
        buttonTitle: "Répondre",
        textInput: { submitButtonTitle: "Envoyer", placeholder: "Message…" },
        options: {
          opensAppToForeground: false,
          // Téléphone verrouillé : Face ID / code avant l'envoi. Évite qu'un
          // tiers réponde depuis l'écran verrouillé, et garantit l'accès au
          // jeton de connexion (Keychain « quand déverrouillé »).
          isAuthenticationRequired: true,
        },
      },
    ]);
  } catch (e) {
    console.warn("[notif-reply] catégorie non enregistrée", e);
  }
}

async function readQueue(): Promise<PendingReply[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingReply[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingReply[]): Promise<void> {
  if (queue.length === 0) {
    await SecureStore.deleteItemAsync(QUEUE_KEY).catch(() => {});
  } else {
    await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
  }
}

/** Les champs utiles peuvent être à plusieurs profondeurs selon plateforme / version. */
function pick(raw: unknown, key: string): string | null {
  const stack: unknown[] = [raw];
  const seen = new Set<unknown>();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    const val = (node as Record<string, unknown>)[key];
    if (typeof val === "string" && val) return val;
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (typeof v === "string" && v.startsWith("{")) {
        try {
          stack.push(JSON.parse(v));
        } catch {
          /* ignore */
        }
      } else if (v && typeof v === "object") {
        stack.push(v);
      }
    }
  }
  return null;
}

function conversationIdFromUrl(url: string | null): string | null {
  return url?.match(/conversationId=([a-f0-9]+)/i)?.[1] ?? null;
}

/**
 * Traite une réponse de notification. Retourne `true` si c'était une réponse
 * (l'appelant ne doit alors PAS naviguer comme pour un simple tap).
 */
export async function handleReplyResponse(response: unknown): Promise<boolean> {
  const r = response as Partial<Notifications.NotificationResponse> | null;
  if (!r || r.actionIdentifier !== REPLY_ACTION) return false;

  const text = (r.userText ?? "").trim();
  const request = r.notification?.request;
  const notificationId = request?.identifier ?? "";
  const data = request?.content?.data ?? r;
  const conversationId =
    pick(data, "conversationId") ?? conversationIdFromUrl(pick(data, "url"));

  if (!text || !conversationId || !notificationId) return true;

  const queue = await readQueue();
  if (!queue.some((q) => q.clientId === notificationId)) {
    queue.push({
      clientId: notificationId.slice(0, 64),
      conversationId,
      friendId: pick(data, "friendId"),
      myUserId: pick(data, "recipientId"),
      senderPublicKey: pick(data, "senderPublicKey"),
      senderName: pick(data, "senderName"),
      text: text.slice(0, 2000),
      notificationId,
    });
    await writeQueue(queue);
  }

  await flushPendingReplies();
  return true;
}

let flushing: Promise<void> | null = null;

/** Envoie tout ce qui attend. Sans risque de doublon : appelable à volonté. */
export function flushPendingReplies(): Promise<void> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(): Promise<void> {
  const queue = await readQueue();
  if (!queue.length) return;

  const remaining: PendingReply[] = [];
  for (const item of queue) {
    const result = await sendOne(item);
    if (result === "retry") remaining.push(item);
  }

  // Une réponse ajoutée pendant l'envoi ne doit pas être écrasée.
  const latest = await readQueue();
  const doneIds = new Set(
    queue.filter((q) => !remaining.includes(q)).map((q) => q.clientId),
  );
  await writeQueue(latest.filter((q) => !doneIds.has(q.clientId)));
}

async function sendOne(item: PendingReply): Promise<"done" | "retry"> {
  try {
    const [privateKey, friendKey, myKey] = await Promise.all([
      getPrivateKey(),
      item.senderPublicKey
        ? Promise.resolve(item.senderPublicKey)
        : item.friendId
          ? fetchUserPublicKey(item.friendId).catch(() => null)
          : Promise.resolve(null),
      item.myUserId
        ? fetchUserPublicKey(item.myUserId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const canEncrypt = !!(privateKey && friendKey && myKey);
    const body = canEncrypt
      ? (() => {
          const encryptedForRecipient = encryptMessage(
            item.text,
            friendKey!,
            privateKey!,
          );
          const encryptedForSender = encryptMessage(
            item.text,
            myKey!,
            privateKey!,
          );
          return {
            content: encryptedForSender,
            isEncrypted: true,
            encryptedForRecipient,
            encryptedForSender,
          };
        })()
      : { content: item.text };

    await api(`/conversations/${item.conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ ...body, clientId: item.clientId, markRead: true }),
    });

    Notifications.dismissNotificationAsync(item.notificationId).catch(() => {});
    return "done";
  } catch (e) {
    // Refus métier (conversation bloquée, message invalide, session expirée) :
    // réessayer ne changera rien → on prévient et on abandonne.
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Réponse non envoyée",
          body: `Ta réponse${item.senderName ? ` à ${item.senderName}` : ""} n'a pas pu partir : ${e.message}`,
          data: {
            url: `/home?tab=chat&conversationId=${item.conversationId}`,
            type: "chat",
          },
        },
        trigger: null,
      }).catch(() => {});
      return "done";
    }
    // Réseau / serveur indisponible : on garde pour le prochain passage.
    console.warn("[notif-reply] envoi reporté", e);
    return "retry";
  }
}

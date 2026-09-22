/**
 * notif-decrypt.ts — Notifications de message lisibles façon WhatsApp (E2E préservé)
 *
 * Principe (identique à WhatsApp) :
 *   1. Le backend envoie une push **data-only** contenant le chiffré du message
 *      (`cipher` = encryptedForRecipient), la clé publique de l'expéditeur et son nom.
 *      → voir le patch backend dans mobile/docs/NOTIF_LISIBLES.md
 *   2. Sur l'appareil, on déchiffre localement avec la clé privée du Keychain/Keystore
 *      (elle ne quitte JAMAIS l'appareil) puis on affiche une **notification locale**
 *      en clair.
 *
 * Chemins d'exécution :
 *   - App en arrière-plan / tuée (Android) → tâche TaskManager (`registerBackgroundNotifTask`)
 *   - App au premier plan → listener `addNotificationReceivedListener`
 *
 * iOS : ce module gère le cas foreground/background léger, mais l'affichage fiable
 * app tuée nécessite une Notification Service Extension native (phase 2, voir la doc).
 * Tant qu'elle n'existe pas, iOS retombe sur le fallback "🔒 Nouveau message chiffré".
 */

import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";
import { getPrivateKey, decryptMessage } from "./crypto";
import { CHAT_CATEGORY, handleReplyResponse } from "./notif-reply";

export const BACKGROUND_NOTIF_TASK = "birthreminder-background-notif";

/** Forme minimale des données qu'on attend dans la push chiffrée. */
interface EncryptedPushData {
  type?: string;
  encrypted?: boolean | string;
  cipher?: string; // encryptedForRecipient (base64 nonce‖ciphertext)
  senderPublicKey?: string; // clé publique de l'expéditeur (base64)
  senderName?: string;
  conversationId?: string;
  url?: string;
  // Anti-doublon : identifiant stable du message côté serveur
  messageId?: string;
  tag?: string;
  // Réponse depuis la notification (voir notif-reply.ts)
  friendId?: string;
  recipientId?: string;
}

/**
 * Le shape exact de l'objet reçu varie selon la plateforme et la version d'Expo
 * (parfois `data`, parfois `data.notification.data`, parfois `data.body`...).
 * On cherche donc nos clés de façon défensive à plusieurs profondeurs.
 */
function extractEncryptedData(raw: unknown): EncryptedPushData | null {
  if (!raw || typeof raw !== "object") return null;

  const candidates: any[] = [];
  const seen = new Set<any>();
  const stack: any[] = [raw];
  while (stack.length && candidates.length < 20) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    candidates.push(node);
    for (const key of Object.keys(node)) {
      const val = (node as any)[key];
      if (val && typeof val === "object") stack.push(val);
      // Certaines couches sérialisent `data` en string JSON → on tente de parser.
      if (typeof val === "string" && val.startsWith("{")) {
        try {
          stack.push(JSON.parse(val));
        } catch {
          /* ignore */
        }
      }
    }
  }

  for (const c of candidates) {
    if (c.cipher && c.senderPublicKey) {
      return c as EncryptedPushData;
    }
  }
  return null;
}

/**
 * Accusé « distribué » : prévient le serveur que la push d'un message est
 * arrivée sur l'appareil (app fermée, donc sans socket). Même contrat que la
 * NSE iOS — jeton HMAC propre au message, voir server/utils/messageReceipts.js.
 * Silencieux en cas d'échec : ne doit jamais empêcher l'affichage.
 */
export async function reportDeliveryFromPush(raw: unknown): Promise<void> {
  if (!raw || typeof raw !== "object") return;
  const stack: any[] = [raw];
  const seen = new Set<any>();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (node.receiptUrl && node.receiptToken && node.messageId && node.recipientId) {
      try {
        await fetch(node.receiptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: node.messageId,
            recipientId: node.recipientId,
            receiptToken: node.receiptToken,
          }),
        });
      } catch {
        /* réseau indisponible : l'accusé partira à la prochaine connexion */
      }
      return;
    }
    for (const val of Object.values(node)) {
      if (typeof val === "string" && val.startsWith("{")) {
        try {
          stack.push(JSON.parse(val));
        } catch {
          /* ignore */
        }
      } else if (val && typeof val === "object") {
        stack.push(val);
      }
    }
  }
}

let _presentedRecently = new Set<string>();

/**
 * Déchiffre et affiche une notification locale lisible.
 * Retourne true si une notif a été présentée, false si fallback nécessaire.
 */
export async function decryptAndPresent(raw: unknown): Promise<boolean> {
  try {
    const data = extractEncryptedData(raw);
    if (!data?.cipher || !data.senderPublicKey) {
      console.log("[notif-decrypt] pas de données chiffrées exploitables", raw);
      return false;
    }

    // ⚠️ iOS : la Notification Service Extension déchiffre et affiche déjà le
    // message, app ouverte, en arrière-plan ou tuée. Présenter une copie locale
    // ici ne sert qu'en secours, si l'extension a échoué (corps resté sur
    // « 🔒 ») ET que l'app est au premier plan. Dans tous les autres cas, c'est
    // un doublon — c'est ce qui se produisait à l'ouverture depuis une
    // notification, app fermée.
    if (Platform.OS === "ios") {
      const body = (raw as { body?: unknown } | null)?.body;
      const nseAlreadyDecrypted =
        typeof body !== "string" || !body.startsWith("🔒");
      if (nseAlreadyDecrypted || AppState.currentState !== "active") {
        return false;
      }
    }

    // Anti-doublon persistant : une copie locale de CE message est-elle déjà
    // affichée ? Le Set mémoire ci-dessous ne survit pas à un relancement.
    if (data.messageId) {
      const presented = await Notifications.getPresentedNotificationsAsync().catch(
        () => [],
      );
      const alreadyShown = presented.some((n) => {
        const d = n.request.content.data as Record<string, unknown> | undefined;
        return d?.localCopy === true && d?.messageId === data.messageId;
      });
      if (alreadyShown) return true;
    }

    // Anti-doublon (foreground + background peuvent tous deux se déclencher)
    const dedupeKey = data.messageId || data.tag || data.cipher.slice(0, 32);
    if (_presentedRecently.has(dedupeKey)) {
      console.log("[notif-decrypt] doublon ignoré", dedupeKey);
      return true;
    }
    _presentedRecently.add(dedupeKey);
    // On borne la taille du set pour éviter la fuite mémoire.
    if (_presentedRecently.size > 50) {
      _presentedRecently = new Set(Array.from(_presentedRecently).slice(-25));
    }

    const privateKey = await getPrivateKey();
    if (!privateKey) {
      console.log("[notif-decrypt] clé privée absente → fallback");
      return false;
    }

    const plaintext = decryptMessage(
      data.cipher,
      data.senderPublicKey,
      privateKey,
    );
    if (!plaintext) {
      console.log("[notif-decrypt] déchiffrement impossible → fallback");
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 ${data.senderName || "Nouveau message"}`,
        body: plaintext,
        sound: "default",
        // Bouton « Répondre » : la notif locale remplace la push, elle doit
        // donc porter la catégorie et tout ce qu'il faut pour répondre.
        categoryIdentifier: CHAT_CATEGORY,
        data: {
          // Repère des copies locales, pour l'anti-doublon persistant.
          localCopy: true,
          messageId: data.messageId ?? null,
          conversationId: data.conversationId ?? null,
          friendId: data.friendId ?? null,
          recipientId: data.recipientId ?? null,
          senderPublicKey: data.senderPublicKey ?? null,
          senderName: data.senderName ?? null,
          url:
            data.url ||
            (data.conversationId
              ? `/home?tab=chat&conversationId=${data.conversationId}`
              : "/chats"),
          type: "chat",
        },
      },
      trigger: null, // immédiat
    });
    return true;
  } catch (e) {
    console.warn("[notif-decrypt] erreur", e);
    return false;
  }
}

/**
 * Tâche de fond : exécutée quand une push data arrive alors que l'app est
 * en arrière-plan ou tuée (Android). À définir au niveau module (top-level),
 * PAS dans un composant React.
 */
export function defineBackgroundNotifTask() {
  if (TaskManager.isTaskDefined(BACKGROUND_NOTIF_TASK)) return;
  // La tâche DOIT être définie dans la portée globale du module (contrainte Expo),
  // c'est pourquoi on appelle defineBackgroundNotifTask() en bas de fichier à l'import.
  TaskManager.defineTask(
    BACKGROUND_NOTIF_TASK,
    async ({ data, error }: { data: unknown; error: unknown }) => {
      if (error) {
        console.warn("[notif-decrypt] tâche de fond erreur", error);
        return;
      }
      // Android : un appui sur « Répondre » app fermée arrive aussi ici.
      if (data && typeof data === "object" && "actionIdentifier" in data) {
        await handleReplyResponse(data);
        return;
      }
      // ⚠️ iOS : rien à présenter ici. La Notification Service Extension a déjà
      // déchiffré et affiché la notif, et envoyé l'accusé « distribué ».
      // Cette tâche s'exécute pourtant sur iOS : avec le mode d'arrière-plan
      // `remote-notification`, un appui sur une notif app TUÉE lance l'app avec
      // le motif « notification distante », et expo-task-manager rejoue alors
      // la push dans la tâche. Présenter ici créait un doublon du message
      // à chaque ouverture depuis une notification, app fermée uniquement.
      if (Platform.OS === "ios") return;
      await Promise.all([decryptAndPresent(data), reportDeliveryFromPush(data)]);
    },
  );
}

/**
 * Enregistre la tâche de fond auprès d'expo-notifications.
 * À appeler une fois au démarrage (après l'auth idéalement).
 */
export async function registerBackgroundNotifTask() {
  try {
    defineBackgroundNotifTask();
    await Notifications.registerTaskAsync(BACKGROUND_NOTIF_TASK);
    console.log("[notif-decrypt] tâche de fond enregistrée");
  } catch (e) {
    console.warn("[notif-decrypt] registerTaskAsync échoué", e);
  }
}

/**
 * Écoute les pushes reçues quand l'app est au premier plan et déchiffre à la volée.
 * Retourne une fonction de désabonnement.
 */
export function subscribeForegroundDecrypt(): () => void {
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    const content = notification.request.content;
    // Rappel du mode local (lib/local-reminders.ts) : rien à déchiffrer
    if (content.data?.localReminder) return;
    // On ne traite que les messages chiffrés ; le reste suit le flux normal.
    const raw = {
      ...(content.data ?? {}),
      body: content.body,
      title: content.title,
    };
    decryptAndPresent(raw).then((handled) => {
      if (handled) {
        // Masque la notif "brute" pour éviter le doublon :
        // - Android : fallback éventuel du data-only
        // - iOS : notif alerte "🔒 Nouveau message chiffré" envoyée par le
        //   backend (remplacée ici par la version déchiffrée)
        Notifications.dismissNotificationAsync(
          notification.request.identifier,
        ).catch(() => {});
      }
    });
  });
  return () => sub.remove();
}

// Définition de la tâche à l'import du module (portée globale requise par Expo).
defineBackgroundNotifTask();

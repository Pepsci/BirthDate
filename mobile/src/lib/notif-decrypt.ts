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
import { getPrivateKey, decryptMessage } from "./crypto";

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
        data: {
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
      await decryptAndPresent(data);
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

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

/**
 * Push natif via Expo Push (roadmap priorité n°1).
 * ⚠️ Ne fonctionne PAS dans Expo Go (SDK 53+) — development build requis.
 * Flux : token Expo → POST /push/expo-token → stocké sur User →
 * le backend l'utilise dans sendPushToUser (services/pushService.js).
 */

// Affichage des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

let currentToken: string | null = null;

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/** Demande la permission, récupère le token et l'enregistre sur le backend */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice || isExpoGo()) return null; // simulateur ou Expo Go

    // Canal Android obligatoire (importance des notifs)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notifications BirthReminder",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#3b82f6",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig
        ?.projectId;
    if (!projectId) {
      console.warn("⚠️ Push: pas de projectId EAS — lance `eas init` d'abord");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    currentToken = token;

    await api("/push/expo-token", {
      method: "POST",
      // platform : le backend envoie des notifs alerte aux appareils iOS
      // (les pushes silencieuses y sont throttlées) et data-only à Android.
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    console.log("🔔 Push: token enregistré", token);
    return token;
  } catch (e) {
    console.warn("⚠️ Push: enregistrement échoué", e);
    return null;
  }
}

/** Retire le token du backend (déconnexion) */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await api("/push/expo-token", {
      method: "DELETE",
      body: JSON.stringify({ token: currentToken }),
    });
  } catch {
    // silencieux
  } finally {
    currentToken = null;
  }
}

/**
 * Convertit les liens du backend (pensés pour le web) en routes mobiles.
 * Ex : "/event/aB3xZ" → identique ; "/home?tab=events" → "/events".
 *
 * Accepte aussi bien un chemin ("/home?tab=…") qu'une URL complète
 * ("https://birthreminder.com/home?tab=…") : c'est le cas des Universal
 * Links / App Links ouverts depuis un email. On retire d'abord l'origine.
 */
export function webLinkToMobileRoute(url: string | null | undefined): string {
  if (!url) return "/";

  // Universal/App Link : on ne garde que le chemin + la query.
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      url = u.pathname + u.search;
    } catch {
      // URL malformée → on continue avec la chaîne brute
    }
  }

  if (url.startsWith("/event/")) return url;
  if (url.startsWith("/auth/reset/")) return url; // reset mdp par token
  if (url.includes("/shared-invites")) return "/shared-invites";
  if (url.includes("tab=events")) return "/events";
  if (url.includes("tab=agenda")) return "/agenda";
  if (url.includes("tab=date") && url.includes("dateId=")) {
    const m = url.match(/dateId=([a-f0-9]+)/i);
    if (m) return `/date/${m[1]}`;
  }
  // Notif de message DM → écran relais qui résout la bonne conversation.
  // Le lien peut porter un friendId (id de l'expéditeur) ou un conversationId.
  if (url.includes("tab=chat")) {
    const f = url.match(/friendId=([a-f0-9]+)/i);
    if (f) return `/chat-open?friendId=${f[1]}`;
    const c = url.match(/conversationId=([a-f0-9]+)/i);
    if (c) return `/chat-open?conversationId=${c[1]}`;
    return "/chats";
  }
  if (url.includes("tab=friends")) return "/friends";
  return "/";
}

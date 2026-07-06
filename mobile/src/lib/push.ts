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
      body: JSON.stringify({ token }),
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
 */
export function webLinkToMobileRoute(url: string | null | undefined): string {
  if (!url) return "/";
  if (url.startsWith("/event/")) return url;
  if (url.includes("tab=events")) return "/events";
  if (url.includes("tab=date") && url.includes("dateId=")) {
    const m = url.match(/dateId=([a-f0-9]+)/i);
    if (m) return `/date/${m[1]}`;
  }
  if (url.includes("tab=friends")) return "/friends";
  return "/";
}

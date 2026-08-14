import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "./auth-context";
import { fetchConversations } from "./conversations";
import { fetchNotifications } from "./notifications";
import { getSocket } from "./socket";

interface UnreadContextValue {
  /** friendUserId → nombre de messages non lus */
  byFriend: Record<string, number>;
  total: number;
  /** Notifications in-app non lues (cloche) */
  notifCount: number;
  refresh: () => Promise<void>;
  refreshNotifs: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextValue>({
  byFriend: {},
  total: 0,
  notifCount: 0,
  refresh: async () => {},
  refreshNotifs: async () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [byFriend, setByFriend] = useState<Record<string, number>>({});
  const [notifCount, setNotifCount] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotifs = useCallback(async () => {
    if (!user?._id) {
      setNotifCount(0);
      return;
    }
    try {
      const { unreadCount } = await fetchNotifications();
      setNotifCount(unreadCount);
    } catch {
      // silencieux
    }
  }, [user?._id]);

  const refresh = useCallback(async () => {
    if (!user?._id) {
      setByFriend({});
      return;
    }
    try {
      const convs = await fetchConversations();
      const map: Record<string, number> = {};
      for (const c of convs) {
        const other = c.participants.find((p) => p._id !== user._id);
        if (other) map[other._id] = c.unreadCount ?? 0;
      }
      setByFriend(map);
    } catch {
      // silencieux — les badges ne doivent jamais bloquer l'app
    }
  }, [user?._id]);

  useEffect(() => {
    refresh();
    refreshNotifs();
    if (!user?._id) return;

    let mounted = true;
    let cleanup: (() => void) | null = null;

    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      // Tout nouveau message ou marquage lu → refresh (débouncé)
      const onActivity = () => {
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(refresh, 400);
      };
      const onNotif = () => refreshNotifs();
      socket.on("message:new", onActivity);
      socket.on("messages:read", onActivity);
      socket.on("new_notification", onNotif);
      cleanup = () => {
        socket.off("message:new", onActivity);
        socket.off("messages:read", onActivity);
        socket.off("new_notification", onNotif);
      };
    })();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [user?._id, refresh, refreshNotifs]);

  const total = Object.values(byFriend).reduce((a, b) => a + b, 0);

  // Synchronise le badge de l'icône de l'app (écran d'accueil du téléphone)
  // avec le nombre réel de messages + notifications non lus. Le serveur pose
  // aussi le badge sur chaque push (voir pushService.js) pour que ça marche
  // app fermée ; ceci garde le badge exact pendant que l'app tourne.
  const badgeTotalRef = useRef(0);
  badgeTotalRef.current = total + notifCount;

  useEffect(() => {
    Notifications.setBadgeCountAsync(badgeTotalRef.current).catch(() => {
      // silencieux — le badge n'est pas critique
    });
  }, [total, notifCount]);

  // Filet de sécurité : au premier lancement, la demande de permission
  // (registerForPush, non-awaited dans auth-context) peut encore être en
  // attente de réponse de l'utilisateur au moment où ce total est calculé —
  // le premier appel ci-dessus échoue alors silencieusement faute de
  // permission accordée, et comme total/notifCount ne rechangent pas tout
  // seuls, le badge ne se réapplique jamais. On le réapplique donc aussi à
  // chaque retour au premier plan, ce qui couvre ce cas (et un éventuel
  // reset du badge par iOS en arrière-plan).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        Notifications.setBadgeCountAsync(badgeTotalRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <UnreadContext.Provider
      value={{ byFriend, total, notifCount, refresh, refreshNotifs }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread(): UnreadContextValue {
  return useContext(UnreadContext);
}

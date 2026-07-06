import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

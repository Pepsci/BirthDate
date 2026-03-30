import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import socketService from "../components/services/socket.service";
import { AuthContext } from "./auth.context";
import apiHandler from "../api/apiHandler";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);

  // ── Chat (existant) ─────────────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversationUnreads, setConversationUnreads] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);

  // ── Demandes d'ami (existant) ────────────────────────────────────────────────
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  // ── Notifications applicatives ───────────────────────────────────────────────
  const [appNotifications, setAppNotifications] = useState([]);
  const [appUnreadCount, setAppUnreadCount] = useState(0);
  const [appPage, setAppPage] = useState(1);
  const [appHasMore, setAppHasMore] = useState(true);
  const [appLoading, setAppLoading] = useState(false);

  const loadAppNotifications = useCallback(async (page = 1) => {
    setAppLoading(true);
    try {
      const { data } = await apiHandler.get(
        `/notifications?page=${page}&limit=20`,
      );
      setAppNotifications((prev) =>
        page === 1 ? data.notifications : [...prev, ...data.notifications],
      );
      setAppUnreadCount(data.unreadCount);
      setAppHasMore(data.notifications.length === 20);
      setAppPage(page);
    } catch (err) {
      console.error("Error loading app notifications:", err);
    } finally {
      setAppLoading(false);
    }
  }, []);

  const loadMoreAppNotifications = useCallback(() => {
    if (!appLoading && appHasMore) loadAppNotifications(appPage + 1);
  }, [appLoading, appHasMore, appPage, loadAppNotifications]);

  const markAppRead = useCallback(async (id) => {
    setAppNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    setAppUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiHandler.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error("markAppRead error:", err);
    }
  }, []);

  const markAllAppRead = useCallback(async () => {
    setAppNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setAppUnreadCount(0);
    try {
      await apiHandler.patch("/notifications/read-all");
    } catch (err) {
      console.error("markAllAppRead error:", err);
    }
  }, []);

  const deleteAppNotification = useCallback(async (id) => {
    setAppNotifications((prev) => {
      const notif = prev.find((n) => n._id === id);
      if (notif && !notif.read) setAppUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n._id !== id);
    });
    try {
      await apiHandler.delete(`/notifications/${id}`);
    } catch (err) {
      console.error("deleteAppNotification error:", err);
    }
  }, []);

  const deleteAllAppNotifications = useCallback(async () => {
    setAppNotifications([]);
    setAppUnreadCount(0);
    try {
      await apiHandler.delete("/notifications");
    } catch (err) {
      console.error("deleteAllAppNotifications error:", err);
    }
  }, []);

  // ── Socket principal (chat + amis + reconnect) ───────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    const socket = socketService.connect(token);

    const handleNewMessage = ({ conversationId, message }) => {
      const messageSenderId =
        typeof message.sender === "object"
          ? message.sender._id
          : message.sender;
      const isMyMessage = messageSenderId === currentUser._id;
      const isActiveConversation = conversationId === activeConversationId;
      if (!isMyMessage && !isActiveConversation) {
        setUnreadCount((prev) => prev + 1);
        setConversationUnreads((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || 0) + 1,
        }));
      }
    };

    const handleMessagesRead = ({ conversationId }) =>
      markAsRead(conversationId);

    const handleReconnect = () => {
      loadUnreadCount();
      loadFriendRequestCount();
      loadAppNotifications(1);
    };

    const handleFriendRequest = () => setFriendRequestCount((prev) => prev + 1);
    const handleFriendRequestAccepted = () => loadFriendRequestCount();

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("connect", handleReconnect);
    socket.on("friend:request", handleFriendRequest);
    socket.on("friend:request:accepted", handleFriendRequestAccepted);

    loadUnreadCount();
    loadFriendRequestCount();
    loadAppNotifications(1);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("connect", handleReconnect);
      socket.off("friend:request", handleFriendRequest);
      socket.off("friend:request:accepted", handleFriendRequestAccepted);
    };
  }, [isLoggedIn, currentUser, activeConversationId]);

  // ── Listener new_notification — séparé pour survivre aux reconnexions ────────
  // On s'attache sur l'event "connect" du socket pour être sûr
  // que le listener est toujours actif après une reconnexion.
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    const socket = socketService.connect(token);

    const handleNewAppNotification = (notif) => {
      // On utilise un flag pour savoir si c'est une nouvelle notif ou une mise à jour
      let isNew = true;
      setAppNotifications((prev) => {
        const exists = prev.find((n) => n._id === notif._id);
        if (exists) {
          isNew = false;
          return prev.map((n) =>
            n._id === notif._id ? { ...notif, read: false } : n,
          );
        }
        return [notif, ...prev];
      });
      // Incrément badge uniquement si nouvelle notif
      if (isNew) setAppUnreadCount((c) => c + 1);
    };

    // On enregistre le listener immédiatement
    socket.on("new_notification", handleNewAppNotification);

    // Et on le ré-enregistre à chaque reconnexion pour être sûr
    const handleReconnect = () => {
      socket.off("new_notification", handleNewAppNotification);
      socket.on("new_notification", handleNewAppNotification);
      console.log("🔔 new_notification re-enregistré après reconnexion");
    };

    socket.on("connect", handleReconnect);

    return () => {
      socket.off("new_notification", handleNewAppNotification);
      socket.off("connect", handleReconnect);
    };
  }, [isLoggedIn, currentUser]);

  // ── Fonctions existantes ─────────────────────────────────────────────────────
  const loadUnreadCount = async () => {
    try {
      const response = await apiHandler.get("/conversations");
      const conversations = response.data;
      const total = conversations.reduce(
        (sum, conv) => sum + (conv.unreadCount || 0),
        0,
      );
      setUnreadCount(total);
      const unreads = {};
      conversations.forEach((conv) => {
        if (conv.unreadCount > 0) unreads[conv._id] = conv.unreadCount;
      });
      setConversationUnreads(unreads);
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  const loadFriendRequestCount = async () => {
    try {
      const response = await apiHandler.get(
        `/friends/requests?userId=${currentUser._id}`,
      );
      setFriendRequestCount(response.data?.length || 0);
    } catch (error) {
      console.error("Error loading friend requests:", error);
    }
  };

  const clearFriendRequestCount = () => setFriendRequestCount(0);

  const markAsRead = (conversationId) => {
    setConversationUnreads((prev) => {
      const newUnreads = { ...prev };
      const count = newUnreads[conversationId] || 0;
      delete newUnreads[conversationId];
      setUnreadCount((prevTotal) => Math.max(0, prevTotal - count));
      return newUnreads;
    });
  };

  const setActiveConversation = (conversationId) => {
    setActiveConversationId(conversationId);
    if (conversationId) markAsRead(conversationId);
  };

  const resetUnreadCount = () => {
    setUnreadCount(0);
    setConversationUnreads({});
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        conversationUnreads,
        activeConversationId,
        setActiveConversation,
        loadUnreadCount,
        markAsRead,
        resetUnreadCount,
        friendRequestCount,
        loadFriendRequestCount,
        clearFriendRequestCount,
        appNotifications,
        appUnreadCount,
        appLoading,
        appHasMore,
        markAppRead,
        markAllAppRead,
        deleteAppNotification,
        deleteAllAppNotifications,
        loadMoreAppNotifications,
        loadAppNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

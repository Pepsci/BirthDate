import { createContext, useState, useEffect, useContext } from "react";
import socketService from "../components/services/socket.service";
import { AuthContext } from "./auth.context";
import apiHandler from "../api/apiHandler";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { isLoggedIn, currentUser } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversationUnreads, setConversationUnreads] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);

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

    const handleMessagesRead = ({ conversationId }) => {
      markAsRead(conversationId);
    };

    // ← Reconnexion automatique sur mobile
    const handleReconnect = () => {
      loadUnreadCount();
    };

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("connect", handleReconnect); // ← NOUVEAU

    loadUnreadCount();

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("connect", handleReconnect);
    };
  }, [isLoggedIn, currentUser, activeConversationId]);

  const loadUnreadCount = async () => {
    try {
      // ✅ apiHandler gère l'URL ET le token automatiquement
      const response = await apiHandler.get("/conversations");
      const conversations = response.data;

      const total = conversations.reduce(
        (sum, conv) => sum + (conv.unreadCount || 0),
        0,
      );
      setUnreadCount(total);

      const unreads = {};
      conversations.forEach((conv) => {
        if (conv.unreadCount > 0) {
          unreads[conv._id] = conv.unreadCount;
        }
      });
      setConversationUnreads(unreads);
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  const markAsRead = (conversationId) => {
    console.log("✅ Marking as read (NotificationContext):", conversationId);

    setConversationUnreads((prev) => {
      const newUnreads = { ...prev };
      const count = newUnreads[conversationId] || 0;
      delete newUnreads[conversationId];
      setUnreadCount((prevTotal) => Math.max(0, prevTotal - count));
      return newUnreads;
    });
  };

  const setActiveConversation = (conversationId) => {
    console.log("🎯 Active conversation set:", conversationId);
    setActiveConversationId(conversationId);

    // Marquer comme lu dès qu'on ouvre
    if (conversationId) {
      markAsRead(conversationId);
    }
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
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

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
  const [friendRequestCount, setFriendRequestCount] = useState(0); // ✅ nouveau

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

    const handleReconnect = () => {
      loadUnreadCount();
      loadFriendRequestCount();
    };

    // ✅ Écoute les nouvelles demandes d'ami en temps réel
    const handleFriendRequest = () => {
      setFriendRequestCount((prev) => prev + 1);
    };

    // ✅ Écoute l'acceptation d'une demande (décrémente chez l'expéditeur)
    const handleFriendRequestAccepted = () => {
      loadFriendRequestCount();
    };

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("connect", handleReconnect);
    socket.on("friend:request", handleFriendRequest); // ✅
    socket.on("friend:request:accepted", handleFriendRequestAccepted); // ✅

    loadUnreadCount();
    loadFriendRequestCount(); // ✅

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("connect", handleReconnect);
      socket.off("friend:request", handleFriendRequest);
      socket.off("friend:request:accepted", handleFriendRequestAccepted);
    };
  }, [isLoggedIn, currentUser, activeConversationId]);

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
        if (conv.unreadCount > 0) {
          unreads[conv._id] = conv.unreadCount;
        }
      });
      setConversationUnreads(unreads);
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  // ✅ Charge le nombre de demandes d'ami reçues en attente
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

  // ✅ À appeler quand l'utilisateur consulte l'onglet Amis
  const clearFriendRequestCount = () => {
    setFriendRequestCount(0);
  };

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
        friendRequestCount, // ✅
        loadFriendRequestCount, // ✅
        clearFriendRequestCount, // ✅
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

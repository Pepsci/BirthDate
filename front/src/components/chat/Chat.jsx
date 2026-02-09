// src/components/Chat/Chat.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import "./css/chat.css";

function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { markAsRead, setActiveConversation } = useNotifications();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(
    location.state?.selectedConversation || null,
  );
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const activeConversationRef = useRef(null);

  // Détecter le resize pour mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      navigate("/login");
      return;
    }

    const socket = socketService.connect(token);
    socket.emit("conversations:join");
    loadConversations(token);

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
    };
  }, [navigate]);

  // Mettre à jour la conversation active quand elle change
  useEffect(() => {
    const newConversationId = selectedConversation?._id || null;

    // Ne mettre à jour que si ça a vraiment changé
    if (activeConversationRef.current !== newConversationId) {
      activeConversationRef.current = newConversationId;
      setActiveConversation(newConversationId);
    }
  }, [selectedConversation]);

  const loadConversations = async (token) => {
    try {
      const response = await fetch("http://localhost:4000/api/conversations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = ({ conversationId, message }) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv._id === conversationId) {
          const isSelected = selectedConversation?._id === conversationId;

          // Vérifier si sender est un objet ou un ID
          const senderId =
            typeof message.sender === "object"
              ? message.sender._id
              : message.sender;

          const currentUserId = JSON.parse(
            atob(localStorage.getItem("authToken").split(".")[1]),
          )._id;

          const isOwnMessage = senderId === currentUserId;

          return {
            ...conv,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            unreadCount:
              !isOwnMessage && !isSelected
                ? (conv.unreadCount || 0) + 1
                : conv.unreadCount,
          };
        }
        return conv;
      }),
    );
  };

  const handleMessagesRead = ({ conversationId }) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      ),
    );
  };

  const handleConversationUpdated = ({
    conversationId,
    lastMessage,
    lastMessageAt,
  }) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            lastMessage,
            lastMessageAt,
          };
        }
        return conv;
      }),
    );
  };

  const handleUserOnline = ({ userId }) => {
    console.log("User online:", userId);
  };

  const handleUserOffline = ({ userId }) => {
    console.log("User offline:", userId);
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);

    // Marquer comme lu dans le contexte de notifications
    markAsRead(conversation._id);

    // Marquer comme lu sur le serveur
    if (conversation.unreadCount > 0) {
      try {
        const token = localStorage.getItem("authToken");
        await fetch(
          `http://localhost:4000/api/conversations/${conversation._id}/read`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        socketService.emit("messages:read", {
          conversationId: conversation._id,
        });

        setConversations((prev) =>
          prev.map((conv) =>
            conv._id === conversation._id ? { ...conv, unreadCount: 0 } : conv,
          ),
        );
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* MOBILE: Afficher soit la liste SOIT la conversation */}
      {isMobile ? (
        <>
          {!selectedConversation ? (
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
            />
          ) : (
            <ChatWindow
              conversation={selectedConversation}
              onBack={handleBackToList}
            />
          )}
        </>
      ) : (
        /* DESKTOP: Afficher les deux côte à côte */
        <>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
          />

          {selectedConversation ? (
            <ChatWindow conversation={selectedConversation} />
          ) : (
            <div className="no-conversation-selected">
              <p>Sélectionnez une conversation pour commencer</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Chat;

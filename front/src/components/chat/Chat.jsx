// src/components/Chat/Chat.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import ChatModal from "./ChatModal";
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
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
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
    loadConversations();

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

  useEffect(() => {
    const newConversationId = selectedConversation?._id || null;
    if (activeConversationRef.current !== newConversationId) {
      activeConversationRef.current = newConversationId;
      setActiveConversation(newConversationId);
    }
  }, [selectedConversation, setActiveConversation]);

  const loadConversations = async () => {
    try {
      const response = await apiHandler.get("/conversations");
      setConversations(response.data);
    } catch (error) {
      console.error("❌ Error loading conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = ({ conversationId, message }) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv._id !== conversationId) return conv;

        const senderId =
          typeof message.sender === "object"
            ? message.sender._id
            : message.sender;
        const currentUserId = JSON.parse(
          atob(localStorage.getItem("authToken").split(".")[1]),
        )._id;
        const isOwnMessage = senderId === currentUserId;
        const isSelected = activeConversationRef.current === conversationId;

        return {
          ...conv,
          lastMessage: message,
          lastMessageAt: message.createdAt,
          unreadCount:
            !isOwnMessage && !isSelected
              ? (conv.unreadCount || 0) + 1
              : conv.unreadCount,
        };
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
      prev.map((conv) =>
        conv._id === conversationId
          ? { ...conv, lastMessage, lastMessageAt }
          : conv,
      ),
    );
  };

  const handleUserOnline = ({ userId }) => console.log("User online:", userId);
  const handleUserOffline = ({ userId }) =>
    console.log("User offline:", userId);

  // ← Callback passée à ChatWindow pour réinitialiser le badge localement
  const handleConversationRead = (conversationId) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      ),
    );
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);

    if (isMobile) setIsChatWindowOpen(true);

    markAsRead(conversation._id);

    if (conversation.unreadCount > 0) {
      try {
        await apiHandler.put(`/conversations/${conversation._id}/read`);
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
    setIsChatWindowOpen(false);
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  const getOtherParticipant = (conversation) => {
    const currentUserId = JSON.parse(
      atob(localStorage.getItem("authToken").split(".")[1]),
    )._id;
    return conversation.participants.find((p) => p._id !== currentUserId);
  };

  const otherUser = selectedConversation
    ? getOtherParticipant(selectedConversation)
    : null;

  return (
    <div className="chat-container">
      {isMobile ? (
        <>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
          />
          {selectedConversation && (
            <ChatModal
              isOpen={isChatWindowOpen}
              onClose={handleBackToList}
              title={
                `${otherUser?.name || ""} ${otherUser?.surname || ""}`.trim() ||
                "Chat"
              }
            >
              <ChatWindow
                conversation={selectedConversation}
                onBack={handleBackToList}
                onRead={() => handleConversationRead(selectedConversation._id)} // ← ajouté
              />
            </ChatModal>
          )}
        </>
      ) : (
        <>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
          />
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              onRead={() => handleConversationRead(selectedConversation._id)} // ← ajouté
            />
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

// src/components/Chat/DirectChat.jsx
import { useState, useEffect } from "react";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import ChatWindow from "./ChatWindow";
import "./css/chat.css";

function DirectChat({ friendId }) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { markAsRead } = useNotifications();

  useEffect(() => {
    const token = localStorage.getItem("authToken");

    if (!token || !friendId) {
      setLoading(false);
      return;
    }

    socketService.connect(token);
    loadConversation(token, friendId);

    return () => {
      // Quitter la conversation quand on démonte le composant
      if (conversation) {
        socketService.emit("conversation:leave", {
          conversationId: conversation._id,
        });
      }
    };
  }, [friendId]);

  const loadConversation = async (token, friendId) => {
    try {
      setLoading(true);

      const response = await apiHandler.post("/conversations/start", {
        friendId,
      });
      const conv = response.data;

      setConversation(conv);

      // Marquer comme lu dans le contexte
      markAsRead(conv._id);

      // Rejoindre la conversation via socket
      socketService.emit("conversation:join", {
        conversationId: conv._id,
      });
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="direct-chat-container">
        <div className="loading">Chargement de la conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="direct-chat-container">
        <div className="no-conversation">
          Impossible de charger la conversation
        </div>
      </div>
    );
  }

  return (
    <div className="direct-chat-container">
      <ChatWindow conversation={conversation} />
    </div>
  );
}

export default DirectChat;

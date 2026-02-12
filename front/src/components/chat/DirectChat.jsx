import { useState, useEffect } from "react";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import apiHandler from "../../api/apiHandler"; // 👈 AJOUTÉ
import ChatWindow from "./ChatWindow";
import "./css/chat.css";

function DirectChat({ friendId }) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { markAsRead } = useNotifications();

  useEffect(() => {
    if (!friendId) {
      setLoading(false);
      setError("Aucun ami sélectionné");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Non authentifié");
      setLoading(false);
      return;
    }

    // Connexion socket AVANT de charger la conversation
    socketService.connect(token);
    loadConversation();

    return () => {
      if (conversation) {
        socketService.emit("conversation:leave", {
          conversationId: conversation._id,
        });
      }
    };
  }, [friendId]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        "🔍 DirectChat - Loading conversation for friendId:",
        friendId,
      );

      // 👇 UTILISE apiHandler AU LIEU DE fetch
      const response = await apiHandler.post("/conversations/start", {
        friendId,
      });

      console.log("✅ DirectChat - Conversation loaded:", response.data);

      const conv = response.data;
      setConversation(conv);

      // Marquer comme lu
      markAsRead(conv._id);

      // Rejoindre la room socket
      socketService.emit("conversation:join", {
        conversationId: conv._id,
      });
    } catch (error) {
      console.error("❌ DirectChat - Error loading conversation:", error);
      setError(error.message || "Erreur de chargement");
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

  if (error) {
    return (
      <div className="direct-chat-container">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadConversation} className="btn-retry">
            Réessayer
          </button>
        </div>
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

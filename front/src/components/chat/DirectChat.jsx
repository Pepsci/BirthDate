import { useState, useEffect, useRef } from "react";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import apiHandler from "../../api/apiHandler";
import ChatWindow from "./ChatWindow";
import "./css/chat.css";

function DirectChat({ friendId }) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { markAsRead } = useNotifications();

  // 👇 IMPORTANT: Utilise useRef pour éviter les re-renders
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 👇 Ne charger qu'une seule fois
    if (hasLoadedRef.current) return;

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

    hasLoadedRef.current = true; // 👈 Marquer comme chargé
    socketService.connect(token);
    loadConversation();

    return () => {
      if (conversation) {
        socketService.emit("conversation:leave", {
          conversationId: conversation._id,
        });
      }
    };
  }, [friendId]); // 👈 Seulement friendId en dépendance

  const loadConversation = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        "🔍 DirectChat - Loading conversation for friendId:",
        friendId,
      );

      const response = await apiHandler.post("/conversations/start", {
        friendId,
      });

      console.log("✅ DirectChat - Conversation loaded:", response.data);

      const conv = response.data;
      setConversation(conv);
      markAsRead(conv._id);

      socketService.emit("conversation:join", {
        conversationId: conv._id,
      });
    } catch (error) {
      console.error("❌ DirectChat - Error loading conversation:", error);
      setError(error.response?.data?.message || "Erreur de chargement");
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
          <button
            onClick={() => {
              hasLoadedRef.current = false; // 👈 Reset pour retry
              loadConversation();
            }}
            className="btn-retry"
          >
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

  console.log(
    "🎬 DirectChat - Rendering ChatWindow with conversation:",
    conversation,
  );

  return (
    <div
      className="direct-chat-container"
      style={{
        border: "2px solid red", // 👈 Pour voir si le conteneur s'affiche
        minHeight: "400px",
      }}
    >
      <h2 style={{ color: "white" }}>
        DEBUG: Conversation ID: {conversation._id}
      </h2>
      <ChatWindow conversation={conversation} />
    </div>
  );
}

export default DirectChat;

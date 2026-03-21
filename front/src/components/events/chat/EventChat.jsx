import React, { useState, useEffect, useRef } from "react";
import apiHandler from "../../../api/apiHandler";
import socketService from "../../services/socket.service";
import "../../chat/css/chat.css";

const EventChat = ({ shortId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]); // NOUVEAU

  const messagesContainerRef = useRef(null);
  const shortIdRef = useRef(shortId);
  const hasJoinedRef = useRef(false);
  const typingTimeoutRef = useRef(null); // NOUVEAU

  const authToken = localStorage.getItem("authToken");
  const currentUserId = authToken
    ? JSON.parse(atob(authToken.split(".")[1]))._id
    : null;

  shortIdRef.current = shortId;

  // ── Effect 1 : Charger les messages + rejoindre la room ─────────────
  useEffect(() => {
    hasJoinedRef.current = false;
    loadMessages();
  }, [shortId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2 : Listeners socket ──────────────────────────────────────
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = ({ shortId: msgShortId, message }) => {
      if (msgShortId !== shortIdRef.current) return;
      setMessages((prev) => {
        if (message.tempId) {
          // Remplacer le message optimiste par le vrai message (sans tempId)
          const replaced = prev.map((msg) =>
            msg._id === message.tempId
              ? { ...message, tempId: undefined } // CORRIGÉ : supprimer tempId
              : msg
          );
          return replaced;
        }
        const exists = prev.find((m) => m._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
      setTimeout(scrollToBottom, 50);
    };

    const handleMessageError = ({ tempId, error: errMsg }) => {
      console.error("❌ event:message_error", errMsg);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...msg, failed: true } : msg
        )
      );
    };

    // NOUVEAU : indicateur de frappe
    const handleTypingStart = ({ shortId: tShortId, userId, userName }) => {
      if (tShortId !== shortIdRef.current) return;
      if (userId === currentUserId) return;
      setTypingUsers((prev) => {
        if (prev.find((u) => u.userId === userId)) return prev;
        return [...prev, { userId, userName }];
      });
    };

    const handleTypingStop = ({ shortId: tShortId, userId }) => {
      if (tShortId !== shortIdRef.current) return;
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId));
    };

    socket.on("event:message_new", handleNewMessage);
    socket.on("event:message_error", handleMessageError);
    socket.on("event:typing_start", handleTypingStart); // NOUVEAU
    socket.on("event:typing_stop", handleTypingStop);   // NOUVEAU

    return () => {
      socket.off("event:message_new", handleNewMessage);
      socket.off("event:message_error", handleMessageError);
      socket.off("event:typing_start", handleTypingStart);
      socket.off("event:typing_stop", handleTypingStop);
      socketService.emit("event:leave", { shortId });
    };
  }, [shortId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async () => {
    if (!currentUserId) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await apiHandler.get(`/events/${shortId}/messages`);
      setMessages(response.data);
      if (!hasJoinedRef.current) {
        socketService.emit("event:join", { shortId });
        hasJoinedRef.current = true;
      }
    } catch (err) {
      console.error("❌ Error loading event messages:", err);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  // NOUVEAU : gérer la frappe
const handleInputChange = (e) => {
  const value = e.target.value;
  setNewMessage(value);

  const socket = socketService.getSocket();
  if (!socket?.connected || !currentUserId) return;

  if (!value.trim()) {
    // Input vidé → stop immédiatement
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketService.emit("event:typing_stop", { shortId });
    return;
  }

  // Reset le timeout à chaque frappe — stop après 5s d'inactivité
  socketService.emit("event:typing_start", { shortId });
  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socketService.emit("event:typing_stop", { shortId });
  }, 5000);
};

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    const socket = socketService.getSocket();
    if (!socket?.connected) { console.error("❌ Socket not connected"); return; }

    // Arrêter l'indicateur de frappe
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketService.emit("event:typing_stop", { shortId });

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      content: newMessage.trim(),
      sender: { _id: currentUserId },
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setTimeout(scrollToBottom, 50);

    socketService.emit("event:message_send", {
      shortId,
      content: optimisticMessage.content,
      tempId,
    });
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  if (!currentUserId) {
    return (
      <div style={{ padding: "15px", textAlign: "center", background: "var(--bg-secondary)", borderTop: "1px solid var(--border-color)", color: "var(--text-secondary)", fontSize: "0.9rem", borderRadius: "10px" }}>
        Connectez-vous pour participer à la discussion.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "400px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-primary)", overflow: "hidden" }}>
      <div style={{ padding: "10px 15px", background: "var(--primary)", color: "#fff", fontWeight: "bold", flexShrink: 0 }}>
        Chat de l'événement
      </div>

      <div ref={messagesContainerRef} style={{ flex: 1, padding: "15px", overflowY: "scroll", display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-tertiary)", margin: "auto 0" }}>Chargement des messages...</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--text-tertiary)", margin: "auto 0" }}>Aucun message pour le moment. Soyez le premier !</p>
        ) : (
          messages.map((msg) => {
            // CORRIGÉ : .toString() pour comparer ObjectId et string
            const isMe = msg.sender._id?.toString() === currentUserId?.toString();
            const isPending = !!msg.tempId && !msg.failed;
            return (
              <div key={msg._id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", flexShrink: 0 }}>
                <div style={{
                  maxWidth: "70%",
                  padding: "10px 15px",
                  borderRadius: "15px",
                  // CORRIGÉ : pas d'opacité pour les messages envoyés, rouge pour echec
                  background: msg.failed ? "var(--danger, #e74c3c)" : isMe ? "var(--primary)" : "var(--bg-secondary)",
                  color: isMe || msg.failed ? "#fff" : "var(--text-primary)",
                  borderBottomRightRadius: isMe ? "0" : "15px",
                  borderBottomLeftRadius: isMe ? "15px" : "0",
                  wordBreak: "break-word",
                  // CORRIGÉ : opacité uniquement pendant l'envoi (pending), pas après
                  opacity: isPending ? 0.6 : 1,
                }}>
                  {!isMe && msg.sender.name && (
                    <div style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "3px", color: "var(--primary)" }}>
                      {msg.sender.name}
                    </div>
                  )}
                  <div>{msg.content}</div>
                  <div style={{ fontSize: "0.7rem", textAlign: "right", marginTop: "5px", opacity: 0.7 }}>
                    {msg.failed ? "Échec d'envoi" : isPending ? "Envoi..." : new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* NOUVEAU : indicateur de frappe */}
        {typingUsers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <div style={{ background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: "15px", borderBottomLeftRadius: "0", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: "bold" }}>
                {typingUsers.map((u) => u.userName).join(", ")}
              </span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: "var(--text-tertiary)",
                    animation: "typingBounce 1.2s infinite",
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-5px); opacity: 1; }
          }
          @media (max-width: 600px) {
            .event-send-btn {
              min-width: 44px !important;
              width: 44px !important;
              height: 44px !important;
              padding: 0 !important;
              background: var(--primary) !important;
              color: #fff !important;
              border-radius: 50% !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              opacity: 1 !important;
            }
            .event-send-btn:disabled {
              opacity: 0.4 !important;
            }
          }
        `}</style>
      </div>

      <form onSubmit={handleSendMessage} style={{ display: "flex", borderTop: "1px solid var(--border-color)", padding: "10px", background: "var(--bg-secondary)", flexShrink: 0, gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Écrivez un message..."
          style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", minWidth: 0 }}
        />
        <button type="submit" className="event-send-btn" disabled={!newMessage.trim()} style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "1.2rem", padding: "0 12px", cursor: newMessage.trim() ? "pointer" : "not-allowed", opacity: newMessage.trim() ? 1 : 0.5, flexShrink: 0 }}>
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};

export default EventChat;
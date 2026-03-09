// src/components/Chat/ChatWindow.jsx
import { useState, useEffect, useRef } from "react";
import socketService from "../services/socket.service";
import apiHandler from "../../api/apiHandler";
import { useOnlineStatus } from "../../context/OnlineStatusContext";
import MessageInput from "./MessageInput";
import "./css/chatWindow.css";

function ChatWindow({ conversation, onBack }) {
  const { isUserOnline } = useOnlineStatus();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [longPressMessageId, setLongPressMessageId] = useState(null);

  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [showUnreadSeparator, setShowUnreadSeparator] = useState(false);
  const [hideSeparator, setHideSeparator] = useState(false);

  const [editingMessage, setEditingMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const longPressTimer = useRef(null);

  const currentUserId = JSON.parse(
    atob(localStorage.getItem("authToken").split(".")[1]),
  )._id;

  // ─── Fermer le context menu au clic extérieur ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setLongPressMessageId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // ─── Charger les messages quand la conversation change ──────────────────────
  useEffect(() => {
    if (conversation) {
      hasJoinedRef.current = false;
      loadMessages();
    }
    setFirstUnreadId(null);
    setShowUnreadSeparator(false);
    setHideSeparator(false);
  }, [conversation]);

  // ─── Écoutes socket ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketService.getSocket();

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:edited", handleMessageEdited);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("messages:read", handleMessagesRead);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:edited", handleMessageEdited);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("messages:read", handleMessagesRead);
    };
  }, [conversation]);

  // ─── Auto-scroll sur nouveau message ────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      const container = messagesContainerRef.current;
      if (!container) return;

      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        150;

      if (isNearBottom) scrollToBottom();
    }
  }, [messages, loading]);

  // ─── Marquer comme lu au scroll bas ─────────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50;

      if (isAtBottom && conversation && showUnreadSeparator) {
        markAsRead();
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation, showUnreadSeparator]);

  // ─── Chargement des messages ─────────────────────────────────────────────────
  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await apiHandler.get(
        `/conversations/${conversation._id}/messages`,
      );
      const data = response.data;
      setMessages(data);

      const firstUnread = data.find(
        (msg) =>
          msg.sender._id !== currentUserId &&
          !msg.readBy?.some((r) => r.user === currentUserId),
      );

      if (firstUnread) {
        setFirstUnreadId(firstUnread._id);
        setShowUnreadSeparator(true);
        setTimeout(() => {
          const el = document.getElementById(`msg-${firstUnread._id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      } else {
        setTimeout(scrollToBottom, 100);
      }

      if (!hasJoinedRef.current) {
        socketService.emit("conversation:join", {
          conversationId: conversation._id,
        });
        hasJoinedRef.current = true;
      }
    } catch (error) {
      console.error("❌ Error loading messages:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Marquer comme lu ────────────────────────────────────────────────────────
  const markAsRead = async () => {
    try {
      await apiHandler.put(`/conversations/${conversation._id}/read`);

      socketService.emit("messages:read", {
        conversationId: conversation._id,
      });

      setHideSeparator(true);
      setTimeout(() => {
        setShowUnreadSeparator(false);
        setHideSeparator(false);
        setFirstUnreadId(null);
      }, 400);
    } catch (error) {
      console.error("❌ Error marking as read:", error);
    }
  };

  // ─── Envoi avec Optimistic UI ─────────────────────────────────────────────────
  const handleSendMessage = (content) => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      content,
      sender: { _id: currentUserId },
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: [],
    };

    // Affichage immédiat
    setMessages((prev) => [...prev, tempMessage]);
    setTimeout(scrollToBottom, 50);

    // Vérifier connexion socket
    const socket = socketService.getSocket();
    if (!socket?.connected) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...msg, status: "failed" } : msg,
        ),
      );
      return;
    }

    socketService.emit("message:send", {
      conversationId: conversation._id,
      content,
      tempId,
    });
  };

  // ─── Réessayer un message échoué ─────────────────────────────────────────────
  const handleRetry = (message) => {
    // Remettre en "sending"
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === message._id ? { ...msg, status: "sending" } : msg,
      ),
    );

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === message._id ? { ...msg, status: "failed" } : msg,
        ),
      );
      return;
    }

    socketService.emit("message:send", {
      conversationId: conversation._id,
      content: message.content,
      tempId: message._id,
    });
  };

  // ─── Réception d'un nouveau message ──────────────────────────────────────────
  const handleNewMessage = ({ conversationId, message }) => {
    if (conversationId !== conversation._id) return;

    setMessages((prev) => {
      // Si le serveur renvoie le tempId → remplacer le message optimiste
      if (message.tempId) {
        return prev.map((msg) =>
          msg._id === message.tempId ? { ...message, status: "sent" } : msg,
        );
      }
      // Message d'un autre user → ajouter (éviter doublon)
      const exists = prev.find((m) => m._id === message._id);
      if (exists) return prev;
      return [...prev, message];
    });

    if (message.sender._id === currentUserId) {
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleMessageDeleted = ({ conversationId, messageId }) => {
    if (conversationId === conversation._id) {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    }
  };

  const handleMessageEdited = ({ messageId, content, edited, editedAt }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId ? { ...msg, content, edited, editedAt } : msg,
      ),
    );
  };

  // ─── Messages lus par l'autre user ───────────────────────────────────────────
  const handleMessagesRead = ({ conversationId, userId }) => {
    if (conversationId !== conversation._id) return;
    if (userId === currentUserId) return;

    // Marquer tous les messages envoyés comme "lu"
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.sender._id !== currentUserId) return msg;
        if (msg.status === "failed") return msg;
        return { ...msg, status: "read" };
      }),
    );
  };

  const handleTypingStart = ({ conversationId, userId }) => {
    if (conversationId === conversation._id && userId !== currentUserId) {
      setIsTyping(true);
    }
  };

  const handleTypingStop = ({ conversationId, userId }) => {
    if (conversationId === conversation._id && userId !== currentUserId) {
      setIsTyping(false);
    }
  };

  const handleTyping = (isTyping) => {
    if (isTyping) {
      socketService.emit("typing:start", { conversationId: conversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emit("typing:stop", {
          conversationId: conversation._id,
        });
      }, 3000);
    } else {
      socketService.emit("typing:stop", { conversationId: conversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputFocus = () => {
    if (showUnreadSeparator) markAsRead();
  };

  // ─── Context menu desktop ────────────────────────────────────────────────────
  const handleContextMenu = (e, message) => {
    e.preventDefault();
    if (message.sender._id !== currentUserId) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  // ─── Long press mobile ───────────────────────────────────────────────────────
  const handleTouchStart = (e, message) => {
    if (message.sender._id !== currentUserId) return;
    longPressTimer.current = setTimeout(() => {
      setLongPressMessageId(message._id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // ─── Suppression ─────────────────────────────────────────────────────────────
  const handleDeleteClick = (messageId) => {
    socketService.emit("message:delete", {
      messageId,
      conversationId: conversation._id,
    });
    setLongPressMessageId(null);
    setContextMenu(null);
  };

  const handleDeleteMessage = () => {
    if (!contextMenu) return;
    handleDeleteClick(contextMenu.message._id);
  };

  // ─── Édition ─────────────────────────────────────────────────────────────────
  const canEditMessage = (message) => {
    const EDIT_TIME_LIMIT = 5 * 60 * 1000;
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    return (
      messageAge <= EDIT_TIME_LIMIT && message.sender._id === currentUserId
    );
  };

  const handleStartEdit = (message) => {
    setEditingMessage(message);
    setContextMenu(null);
    setLongPressMessageId(null);
  };

  const handleSaveEdit = (content) => {
    if (!content.trim() || !editingMessage) return;
    socketService.emit("message:edit", {
      messageId: editingMessage._id,
      content: content.trim(),
      conversationId: conversation._id,
    });
    setEditingMessage(null);
  };

  const handleCancelEdit = () => setEditingMessage(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const getOtherParticipant = () =>
    conversation.participants.find((p) => p._id !== currentUserId);

  const formatMessageTime = (date) =>
    new Date(date).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ─── Indicateur de statut du message ─────────────────────────────────────────
  const renderMessageStatus = (message) => {
    if (message.sender._id !== currentUserId) return null;

    const status = message.status;

    if (status === "sending")
      return <span className="msg-status sending">⏳</span>;
    if (status === "failed")
      return (
        <span
          className="msg-status failed"
          onClick={() => handleRetry(message)}
          title="Cliquer pour réessayer"
        >
          ⚠️ Réessayer
        </span>
      );
    if (status === "read") return <span className="msg-status read">✓✓</span>;
    // "sent" ou messages chargés depuis l'API
    return <span className="msg-status sent">✓</span>;
  };

  const otherUser = getOtherParticipant();
  const isOnline = otherUser ? isUserOnline(otherUser._id) : false;

  if (loading) {
    return (
      <div className="chat-window">
        <div className="loading">Chargement des messages...</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* ── Header ── */}
      <div className="chat-header">
        {onBack && (
          <button className="back-button" onClick={onBack}>
            ←
          </button>
        )}
        <div className="chat-header-user">
          <div className="chat-avatar">
            {otherUser?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="chat-user-info">
            <span className="chat-name">
              {otherUser?.name || otherUser?.email || "Utilisateur"}
            </span>
            {isOnline ? (
              <span className="chat-user-status online">En ligne</span>
            ) : (
              <span className="chat-user-status offline">Hors ligne</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="messages-container" ref={messagesContainerRef}>
        {messages.map((message) => {
          const isOwn = message.sender._id === currentUserId;
          const isFirstUnread = message._id === firstUnreadId;

          return (
            <div key={message._id} id={`msg-${message._id}`}>
              {showUnreadSeparator && isFirstUnread && (
                <div
                  className={`unread-separator ${hideSeparator ? "fade-out" : ""}`}
                >
                  Messages non lus
                </div>
              )}

              <div
                className={`message ${isOwn ? "own" : "other"} ${
                  longPressMessageId === message._id ? "show-delete" : ""
                }`}
                onContextMenu={(e) => handleContextMenu(e, message)}
                onTouchStart={(e) => handleTouchStart(e, message)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
              >
                {!isOwn && (
                  <div className="message-avatar">
                    {message.sender.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}

                <div className="message-content">
                  <div
                    className={`message-bubble ${
                      message.status === "sending" ? "sending" : ""
                    } ${message.status === "failed" ? "failed" : ""}`}
                  >
                    {message.content}
                    {message.edited && (
                      <span
                        className="edited-indicator"
                        title={`Modifié le ${new Date(message.editedAt).toLocaleString("fr-FR")}`}
                      >
                        {" "}
                        (modifié)
                      </span>
                    )}
                  </div>

                  <div className="message-meta">
                    <span className="message-time">
                      {formatMessageTime(message.createdAt)}
                    </span>
                    {renderMessageStatus(message)}
                  </div>

                  {isOwn && longPressMessageId === message._id && (
                    <div className="mobile-actions">
                      {canEditMessage(message) && (
                        <button
                          className="edit-button-mobile"
                          onClick={() => handleStartEdit(message)}
                        >
                          ✏️ Modifier
                        </button>
                      )}
                      <button
                        className="delete-button-mobile"
                        onClick={() => handleDeleteClick(message._id)}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-avatar">
              {otherUser?.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Context menu desktop ── */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {canEditMessage(contextMenu.message) && (
            <button
              onClick={() => handleStartEdit(contextMenu.message)}
              className="context-menu-item edit"
            >
              ✏️ Modifier
            </button>
          )}
          <button
            onClick={handleDeleteMessage}
            className="context-menu-item delete"
          >
            🗑️ Supprimer
          </button>
        </div>
      )}

      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onFocus={handleInputFocus}
        editingMessage={editingMessage}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  );
}

export default ChatWindow;

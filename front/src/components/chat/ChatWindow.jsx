// src/components/Chat/ChatWindow.jsx
import { useState, useEffect, useRef, useContext } from "react";
import socketService from "../services/socket.service";
import apiHandler from "../../api/apiHandler";
import { useOnlineStatus } from "../../context/OnlineStatusContext";
import { AuthContext } from "../../context/auth.context";
import {
  getPrivateKey,
  getOldPrivateKey,
  encryptMessage,
  decryptMessage,
} from "../../utils/encryption";
import MessageInput from "./MessageInput";
import "./css/chatWindow.css";

function ChatWindow({ conversation, onBack, onRead }) {
  const { isUserOnline } = useOnlineStatus();
  const { currentUser } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [longPressMessageId, setLongPressMessageId] = useState(null);

  const [firstUnreadId, setFirstUnreadId] = useState(null);
  const [showUnreadSeparator, setShowUnreadSeparator] = useState(false);
  const [hideSeparator, setHideSeparator] = useState(false);

  const [editingMessage, setEditingMessage] = useState(null);

  // ── E2E ────────────────────────────────────────────────────────────────────
  // Clé publique de l'autre participant, chargée à l'ouverture de la conversation
  const [otherUserPublicKey, setOtherUserPublicKey] = useState(null);
  // Ref miroir pour accès synchrone dans les handlers socket (évite stale closure)
  const otherUserPublicKeyRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const longPressTimer = useRef(null);
  const conversationIdRef = useRef(conversation._id);
  // Cache plaintext des messages envoyés, keyed par tempId.
  // Permet d'afficher le texte clair immédiatement après confirmation serveur
  // sans attendre le déchiffrement (qui peut échouer si encryptedFor est absent).
  const plaintextCacheRef = useRef({});

  // CORRIGÉ : safe si authToken est null (Firefox/Opera)
  const authToken = localStorage.getItem("authToken");
  const currentUserId = authToken
    ? JSON.parse(atob(authToken.split(".")[1]))._id
    : null;

  useEffect(() => {
    conversationIdRef.current = conversation._id;
  }, [conversation._id]);

  // ── Fetch la publicKey du destinataire au changement de conversation ──────
  useEffect(() => {
    setOtherUserPublicKey(null);
    otherUserPublicKeyRef.current = null;
    const other = conversation.participants?.find((p) => p?._id && p._id !== currentUserId);
    if (!other?._id) return;
    apiHandler
      .getUserPublicKey(other._id)
      .then(({ publicKey }) => {
        setOtherUserPublicKey(publicKey || null);
        otherUserPublicKeyRef.current = publicKey || null;
      })
      .catch(() => {
        setOtherUserPublicKey(null);
        otherUserPublicKeyRef.current = null;
      });
  }, [conversation._id]);

  // ── Helper : récupère la publicKey fraîche du destinataire ────────────────
  const fetchRecipientPublicKey = async () => {
    const other = conversation.participants?.find((p) => p?._id && p._id !== currentUserId);
    if (!other?._id) return otherUserPublicKeyRef.current;
    try {
      const { publicKey } = await apiHandler.getUserPublicKey(other._id);
      if (publicKey && publicKey !== otherUserPublicKeyRef.current) {
        setOtherUserPublicKey(publicKey);
        otherUserPublicKeyRef.current = publicKey;
      }
      return publicKey || null;
    } catch {
      return otherUserPublicKeyRef.current;
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setLongPressMessageId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (conversation) {
      hasJoinedRef.current = false;
      loadMessages();
    }
    setFirstUnreadId(null);
    setShowUnreadSeparator(false);
    setHideSeparator(false);
  }, [conversation]);

  useEffect(() => {
    const socket = socketService.getSocket();
    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:edited", handleMessageEdited);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("messages:read", handleMessagesRead);
    socket.on("contact:keyUpdated", handleContactKeyUpdated);
    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:edited", handleMessageEdited);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("messages:read", handleMessagesRead);
      socket.off("contact:keyUpdated", handleContactKeyUpdated);
    };
  }, [conversation]);

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

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        50;
      if (isAtBottom && conversation && showUnreadSeparator) markAsRead();
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [conversation, showUnreadSeparator]);

  const loadMessages = async () => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      const response = await apiHandler.get(
        `/conversations/${conversation._id}/messages`,
      );
      const data = response.data;

      const messagesWithStatus = data.map((msg) => {
        if (msg.sender._id !== currentUserId) return msg;
        const readByOther = msg.readBy?.some(
          (r) => r.user !== currentUserId && r.user !== msg.sender._id,
        );
        return { ...msg, status: readByOther ? "read" : "sent" };
      });

      setMessages(messagesWithStatus);

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

  const markAsRead = async () => {
    try {
      await apiHandler.put(`/conversations/${conversation._id}/read`);
      socketService.emit("messages:read", {
        conversationId: conversation._id,
      });
      if (onRead) onRead();
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

  // ── Résolution du contenu à afficher (plaintext ou déchiffré) ─────────────
  // Appelé dans le rendu — le déchiffrement NaCl est synchrone et rapide.
  const resolveDisplayContent = (msg) => {
    // Message non chiffré (historique avant E2E ou temp message en cours d'envoi)
    if (!msg.isEncrypted) return { text: msg.content, encrypted: false };

    // Plaintext mis en cache à la confirmation serveur (keyed par _id réel).
    // Survit aux re-renders et aux setMessages ultérieurs du parent.
    const cached = plaintextCacheRef.current[msg._id];
    if (cached) return { text: cached, encrypted: true };

    // Tableau de clés : active d'abord, ancienne en fallback
    // (permet de lire les messages chiffrés avant un changement de mode E2E)
    const privateKeys = [getPrivateKey(), getOldPrivateKey()].filter(Boolean);
    if (privateKeys.length === 0) {
      return { text: null, encrypted: true, locked: true };
    }

    // Clés publiques de l'expéditeur à essayer dans l'ordre :
    //   - message de moi : ma clé actuelle + ma vieille clé (self-copy)
    //   - message de l'autre : sa clé actuelle (dans le message) + son ancienne clé
    // oldPublicKey est populé par le backend depuis user.model.js
    const isOwnMessage = msg.sender._id === currentUserId;
    const senderPubKeys = isOwnMessage
      ? [currentUser?.publicKey, currentUser?.oldPublicKey].filter(Boolean)
      : [msg.sender?.publicKey, msg.sender?.oldPublicKey].filter(Boolean);

    if (senderPubKeys.length === 0) return { text: null, encrypted: true, error: true };

    // Nouveau format : chaque participant a sa propre copie dans encryptedFor
    const myCopy = msg.encryptedFor?.[currentUserId];
    if (myCopy) {
      for (const senderPubKey of senderPubKeys) {
        const decrypted = decryptMessage(myCopy, senderPubKey, privateKeys);
        if (decrypted) return { text: decrypted, encrypted: true };
      }
      return { text: null, encrypted: true, error: true };
    }

    // Format legacy : content contient le ciphertext directement
    // (messages envoyés avant la migration vers encryptedFor)
    if (msg.content && msg.content.length > 50) {
      for (const senderPubKey of senderPubKeys) {
        const decrypted = decryptMessage(msg.content, senderPubKey, privateKeys);
        if (decrypted) return { text: decrypted, encrypted: true };
      }
      return { text: null, encrypted: true, error: true };
    }

    return { text: null, encrypted: true, error: true };
  };

  // ── Mise à jour de la clé publique d'un contact (activation Full E2E) ──────
  const handleContactKeyUpdated = ({ userId, newPublicKey }) => {
    const other = conversation.participants?.find((p) => p?._id && p._id !== currentUserId);
    if (other?._id !== userId) return; // concerne un autre contact, ignorer
    setOtherUserPublicKey(newPublicKey || null);
    otherUserPublicKeyRef.current = newPublicKey || null;
  };

  // ── Envoi de message avec chiffrement conditionnel ─────────────────────────
  const handleSendMessage = async (content) => {
    const tempId = `temp-${Date.now()}`;

    // Le message temporaire stocke toujours le texte en clair
    // resolveDisplayContent retourne { encrypted: false } pour les temp messages
    const tempMessage = {
      _id: tempId,
      content,
      isEncrypted: false, // Affiché en clair tant que le serveur n'a pas confirmé
      sender: { _id: currentUserId },
      createdAt: new Date().toISOString(),
      status: "sending",
      readBy: [],
    };
    setMessages((prev) => [...prev, tempMessage]);
    setTimeout(scrollToBottom, 50);

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId ? { ...msg, status: "failed" } : msg,
        ),
      );
      return;
    }

    const myPrivateKey = getPrivateKey();
    const myPublicKey = currentUser?.publicKey;

    // Toujours récupérer la clé fraîche avant de chiffrer —
    // évite d'utiliser une clé périmée si le contact a changé de paire (Full E2E)
    const recipientPublicKey = (myPrivateKey && myPublicKey)
      ? await fetchRecipientPublicKey()
      : null;

    const shouldEncrypt = !!recipientPublicKey && !!myPublicKey && !!myPrivateKey;

    // Cache le plaintext pour l'affichage immédiat après confirmation serveur
    if (shouldEncrypt) plaintextCacheRef.current[tempId] = content;

    if (shouldEncrypt) {
      const encryptedContent = encryptMessage(content, recipientPublicKey, myPrivateKey);
      const selfEncrypted = encryptMessage(content, myPublicKey, myPrivateKey);

      socketService.emit("message:send", {
        conversationId: conversation._id,
        content: encryptedContent,
        isEncrypted: true,
        encryptedForRecipient: encryptedContent,
        encryptedForSender: selfEncrypted,
        tempId,
      });
    } else {
      socketService.emit("message:send", {
        conversationId: conversation._id,
        content,
        tempId,
      });
    }
  };

  // ── Retry avec re-chiffrement ──────────────────────────────────────────────
  // Les temp messages échoués ont toujours le texte en clair dans `content`
  const handleRetry = async (message) => {
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

    const myPrivateKey = getPrivateKey();
    const myPublicKey = currentUser?.publicKey;
    const recipientPublicKey = (myPrivateKey && myPublicKey)
      ? await fetchRecipientPublicKey()
      : null;
    const shouldEncrypt = !!recipientPublicKey && !!myPublicKey && !!myPrivateKey;

    if (shouldEncrypt) {
      const encryptedContent = encryptMessage(message.content, recipientPublicKey, myPrivateKey);
      const selfEncrypted = encryptMessage(message.content, myPublicKey, myPrivateKey);
      socketService.emit("message:send", {
        conversationId: conversation._id,
        content: encryptedContent,
        isEncrypted: true,
        encryptedForRecipient: encryptedContent,
        encryptedForSender: selfEncrypted,
        tempId: message._id,
      });
    } else {
      socketService.emit("message:send", {
        conversationId: conversation._id,
        content: message.content,
        tempId: message._id,
      });
    }
  };

  const handleNewMessage = ({ conversationId, message }) => {
    if (conversationId !== conversationIdRef.current) return;
    // Normalisation — le serveur expose sender: { _id } (objet imbriqué), pas senderId
    if (message.tempId) {
      // Remappe le plaintext du cache : tempId → _id réel.
      // La ref survit à tous les setMessages ultérieurs (contrairement à une prop sur l'objet).
      const localPlaintext = plaintextCacheRef.current[message.tempId];
      delete plaintextCacheRef.current[message.tempId];
      if (localPlaintext) plaintextCacheRef.current[message._id] = localPlaintext;
    }

    // Si l'autre utilisateur a changé de clés (ex: activation Full E2E),
    // mettre à jour le cache local pour que les prochains envois utilisent sa nouvelle clé.
    const senderId = message.sender?._id;
    if (senderId !== currentUserId && message.sender?.publicKey && message.sender.publicKey !== otherUserPublicKeyRef.current) {
      setOtherUserPublicKey(message.sender.publicKey);
      otherUserPublicKeyRef.current = message.sender.publicKey;
    }

    setMessages((prev) => {
      if (message.tempId) {
        return prev.map((msg) =>
          msg._id === message.tempId ? { ...message, status: "sent" } : msg,
        );
      }
      const exists = prev.find((m) => m._id === message._id);
      if (exists) return prev;
      return [...prev, message];
    });
    setTimeout(scrollToBottom, 100);
    if (message.sender._id !== currentUserId) markAsRead();
  };

  const handleMessageDeleted = ({ conversationId, messageId }) => {
    if (conversationId !== conversationIdRef.current) return;
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
  };

  const handleMessageEdited = ({ messageId, content, edited, editedAt }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId ? { ...msg, content, edited, editedAt } : msg,
      ),
    );
  };

  const handleMessagesRead = ({ conversationId, userId }) => {
    if (conversationId !== conversationIdRef.current) return;
    if (userId === currentUserId) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.sender._id !== currentUserId) return msg;
        if (msg.status === "failed") return msg;
        return { ...msg, status: "read" };
      }),
    );
  };

  const handleTypingStart = ({ conversationId, userId }) => {
    if (conversationId !== conversationIdRef.current) return;
    if (userId !== currentUserId) setIsTyping(true);
  };

  const handleTypingStop = ({ conversationId, userId }) => {
    if (conversationId !== conversationIdRef.current) return;
    if (userId !== currentUserId) setIsTyping(false);
  };

  const handleTyping = (isTyping) => {
    if (isTyping) {
      socketService.emit("typing:start", { conversationId: conversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emit("typing:stop", { conversationId: conversation._id });
      }, 3000);
    } else {
      socketService.emit("typing:stop", { conversationId: conversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputFocus = () => {
    markAsRead();
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    if (message.sender._id !== currentUserId) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

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

  // Les messages chiffrés ne peuvent pas être édités (intégrité E2E)
  const canEditMessage = (message) => {
    if (message.isEncrypted) return false;
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

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const getOtherParticipant = () =>
    conversation.participants?.find((p) => p?._id && p._id !== currentUserId);

  const formatMessageTime = (date) =>
    new Date(date).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

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
    return <span className="msg-status sent">✓</span>;
  };

  const otherUser = getOtherParticipant();
  const isOnline = otherUser ? isUserOnline(otherUser._id) : false;

  // Badge E2E visible si le destinataire a une clé publique (conversation chiffrable)
  const isE2EConversation = !!otherUserPublicKey;

  // Index du premier message chiffré pour le séparateur visuel
  const firstEncryptedIndex = messages.findIndex((m) => m.isEncrypted);

  if (!currentUserId) {
    return (
      <div className="chat-window">
        <div className="loading">Session expirée, veuillez vous reconnecter.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="chat-window">
        <div className="loading">Chargement des messages...</div>
      </div>
    );
  }

  return (
    <div className="chat-window">
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

        {/* Badge chiffrement E2E */}
        {isE2EConversation && (
          <div className="e2e-badge" title="Cette conversation est chiffrée de bout en bout">
            🔒 Chiffrement E2E
          </div>
        )}
      </div>

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.map((message, index) => {
          const isOwn = message.sender._id === currentUserId;
          const isFirstUnread = message._id === firstUnreadId;
          const isFirstEncrypted = index === firstEncryptedIndex;

          // Résolution du contenu à afficher
          const { text: displayText, locked, error } = resolveDisplayContent(message);

          return (
            <div key={message._id} id={`msg-${message._id}`}>
              {showUnreadSeparator && isFirstUnread && (
                <div
                  className={`unread-separator ${hideSeparator ? "fade-out" : ""}`}
                >
                  Messages non lus
                </div>
              )}

              {/* Séparateur avant le premier message chiffré */}
              {isFirstEncrypted && (
                <div className="e2e-separator">
                  <span>🔒 Messages chiffrés ci-dessous</span>
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
                    className={`message-bubble ${message.status === "sending" ? "sending" : ""} ${message.status === "failed" ? "failed" : ""}`}
                  >
                    {locked ? (
                      <span className="msg-locked">
                        🔒 Reconnectez-vous pour lire ce message
                      </span>
                    ) : error ? (
                      <span className="msg-unreadable">Message non lisible</span>
                    ) : (
                      displayText
                    )}
                    {message.edited && !locked && !error && (
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

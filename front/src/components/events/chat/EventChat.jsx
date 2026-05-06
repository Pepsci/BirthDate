import React, { useState, useEffect, useRef, useContext } from "react";
import apiHandler from "../../../api/apiHandler";
import socketService from "../../services/socket.service";
import { AuthContext } from "../../../context/auth.context";
import {
  getPrivateKey,
  getOldPrivateKey,
  encryptMessage,
  decryptMessage,
} from "../../../utils/encryption";
import "./css/eventchat.css";

const EventChat = ({ shortId, participants = {} }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);

  const { currentUser } = useContext(AuthContext);
  const messagesContainerRef = useRef(null);
  const shortIdRef = useRef(shortId);
  const hasJoinedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const plaintextCacheRef = useRef({});
  const participantKeysRef = useRef(participants);

  const authToken = localStorage.getItem("authToken");
  const currentUserId = authToken
    ? JSON.parse(atob(authToken.split(".")[1]))._id
    : null;

  shortIdRef.current = shortId;

  useEffect(() => {
    participantKeysRef.current = participants;
  }, [participants]);

  useEffect(() => {
    hasJoinedRef.current = false;
    plaintextCacheRef.current = {};
    loadMessages();
  }, [shortId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = ({ shortId: msgShortId, message }) => {
      if (msgShortId !== shortIdRef.current) return;

      if (message.tempId) {
        const cached = plaintextCacheRef.current[message.tempId];
        delete plaintextCacheRef.current[message.tempId];
        if (cached) plaintextCacheRef.current[message._id] = cached;
      }

      setMessages((prev) => {
        if (message.tempId) {
          return prev.map((msg) =>
            msg._id === message.tempId
              ? { ...message, tempId: undefined }
              : msg,
          );
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
          msg._id === tempId ? { ...msg, failed: true } : msg,
        ),
      );
    };

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
    socket.on("event:typing_start", handleTypingStart);
    socket.on("event:typing_stop", handleTypingStop);

    return () => {
      socket.off("event:message_new", handleNewMessage);
      socket.off("event:message_error", handleMessageError);
      socket.off("event:typing_start", handleTypingStart);
      socket.off("event:typing_stop", handleTypingStop);
      socketService.emit("event:leave", { shortId });
    };
  }, [shortId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
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

  const resolveDisplayContent = (msg) => {
    if (!msg.isEncrypted) return { text: msg.content };

    const cached = plaintextCacheRef.current[msg._id];
    if (cached) return { text: cached };

    const privateKeys = [getPrivateKey(), getOldPrivateKey()].filter(Boolean);
    if (privateKeys.length === 0) return { text: null, locked: true };

    const myCopy = msg.encryptedFor?.[currentUserId];
    if (!myCopy) return { text: null, lateJoiner: true };

    const senderId = msg.sender?._id?.toString() ?? msg.sender?.toString();
    const senderPublicKey =
      senderId === currentUserId
        ? currentUser?.publicKey
        : (participantKeysRef.current[senderId] ?? msg.sender?.publicKey);

    if (!senderPublicKey) return { text: null, locked: true };

    const decrypted = decryptMessage(myCopy, senderPublicKey, privateKeys);
    return decrypted ? { text: decrypted } : { text: null, error: true };
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !currentUserId) return;

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      console.error("❌ Socket not connected");
      return;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketService.emit("event:typing_stop", { shortId });

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      content,
      isEncrypted: false,
      sender: { _id: currentUserId },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setTimeout(scrollToBottom, 50);

    const myPrivateKey = getPrivateKey();
    const myPublicKey = currentUser?.publicKey;
    const keys = participantKeysRef.current;
    const hasParticipants = Object.keys(keys).length > 0;
    const shouldEncrypt = !!myPrivateKey && !!myPublicKey && hasParticipants;

    if (shouldEncrypt) {
      const encryptedFor = {};
      for (const [userId, pubKey] of Object.entries(keys)) {
        encryptedFor[userId] = encryptMessage(content, pubKey, myPrivateKey);
      }
      if (!encryptedFor[currentUserId]) {
        encryptedFor[currentUserId] = encryptMessage(
          content,
          myPublicKey,
          myPrivateKey,
        );
      }
      plaintextCacheRef.current[tempId] = content;
      socketService.emit("event:message_send", {
        shortId,
        content: encryptedFor[currentUserId],
        isEncrypted: true,
        encryptedFor,
        tempId,
      });
    } else {
      socketService.emit("event:message_send", {
        shortId,
        content,
        tempId,
      });
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    const socket = socketService.getSocket();
    if (!socket?.connected || !currentUserId) return;

    if (!value.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketService.emit("event:typing_stop", { shortId });
      return;
    }

    socketService.emit("event:typing_start", { shortId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.emit("event:typing_stop", { shortId });
    }, 5000);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  const isE2EActive =
    !!currentUser?.publicKey && Object.keys(participants).length > 0;

  if (!currentUserId) {
    return (
      <div className="event-chat-guest">
        Connectez-vous pour participer à la discussion.
      </div>
    );
  }

  return (
    <div className="event-chat-wrapper">
      <div className="event-chat-header">
        <span>Chat de l'événement</span>
        {isE2EActive && (
          <span className="event-chat-e2e-badge">🔒 Chiffrement E2E</span>
        )}
      </div>

      <div ref={messagesContainerRef} className="event-chat-messages">
        {loading ? (
          <p className="event-chat-loading">Chargement des messages...</p>
        ) : messages.length === 0 ? (
          <p className="event-chat-empty">
            Aucun message pour le moment. Soyez le premier !
          </p>
        ) : (
          messages.map((msg) => {
            const isMe =
              msg.sender?._id?.toString() === currentUserId?.toString();
            const isPending = !!msg.tempId && !msg.failed;
            const { text, locked, lateJoiner, error } =
              resolveDisplayContent(msg);

            let displayText = text;
            let isPlaceholder = false;
            if (!text) {
              isPlaceholder = true;
              if (lateJoiner)
                displayText = "🔒 Vous avez rejoint après cet échange";
              else if (locked)
                displayText = "🔒 Clé absente — reconnectez-vous";
              else if (error) displayText = "🔒 Message non lisible";
              else displayText = "🔒 Message chiffré";
            }

            const bubbleClasses = [
              "event-chat-bubble",
              isPending && !msg.failed ? "pending" : "",
              msg.failed ? "failed" : "",
              isPlaceholder ? "placeholder" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={msg._id}
                className={`event-chat-message-row ${isMe ? "me" : "other"}`}
              >
                <div className={bubbleClasses}>
                  {!isMe && msg.sender?.name && (
                    <div className="event-chat-sender">{msg.sender.name}</div>
                  )}
                  <div>{displayText}</div>
                  <div className="event-chat-time">
                    {msg.failed
                      ? "Échec d'envoi"
                      : isPending
                        ? "Envoi..."
                        : new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 && (
          <div className="event-chat-typing">
            <div className="event-chat-typing-bubble">
              <span className="event-chat-typing-name">
                {typingUsers.map((u) => u.userName).join(", ")}
              </span>
              <div className="event-chat-typing-dots">
                <div className="event-chat-typing-dot" />
                <div className="event-chat-typing-dot" />
                <div className="event-chat-typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="event-chat-form">
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder={
            isE2EActive ? "Message chiffré…" : "Écrivez un message..."
          }
          className="event-chat-input"
        />
        <button
          type="submit"
          className="event-chat-submit"
          disabled={!newMessage.trim()}
        >
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
};

export default EventChat;

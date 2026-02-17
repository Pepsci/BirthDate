import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socketService from "../services/socket.service";
import { useOnlineStatus } from "../../context/OnlineStatusContext"; // ⭐ NOUVEAU
import "./css/ConversationList.css";

function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
}) {
  const { isUserOnline } = useOnlineStatus(); // ⭐ NOUVEAU
  const [friends, setFriends] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [localConversations, setLocalConversations] = useState(conversations);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const navigate = useNavigate();

  const currentUserId = JSON.parse(
    atob(localStorage.getItem("authToken").split(".")[1]),
  )._id;

  useEffect(() => {
    let isMounted = true;

    const fetchFriends = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch("http://localhost:4000/api/friends", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok && isMounted) {
          const data = await response.json();
          setFriends(data);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error loading friends:", error);
        }
      }
    };

    fetchFriends();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLocalConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    const socket = socketService.getSocket();

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("conversation:deleted", handleConversationDeleted);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("conversation:deleted", handleConversationDeleted);
    };
  }, [selectedConversation]);

  const handleNewMessage = ({ conversationId, message }) => {
    setLocalConversations((prev) =>
      prev.map((conv) => {
        if (conv._id === conversationId) {
          const isSelected = selectedConversation?._id === conversationId;

          const senderId =
            typeof message.sender === "object"
              ? message.sender._id
              : message.sender;

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
    setLocalConversations((prev) =>
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
    setLocalConversations((prev) =>
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

  const handleConversationDeleted = ({ conversationId }) => {
    setLocalConversations((prev) =>
      prev.filter((conv) => conv._id !== conversationId),
    );

    if (selectedConversation?._id === conversationId) {
      onSelectConversation(null);
    }
  };

  const handleRequestDelete = (e, conversationId) => {
    e.stopPropagation();
    setDeleteConfirmId(conversationId);
  };

  const handleConfirmDelete = (e, conversationId) => {
    e.stopPropagation();

    try {
      socketService.emit("conversation:delete", { conversationId });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const startNewConversation = async (friendId) => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        "http://localhost:4000/api/conversations/start",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ friendId }),
        },
      );

      if (response.ok) {
        const conversation = await response.json();

        // Ajouter la conversation à la liste locale si elle n'existe pas déjà
        setLocalConversations((prev) => {
          const exists = prev.find((c) => c._id === conversation._id);
          if (exists) return prev;
          return [conversation, ...prev];
        });

        onSelectConversation(conversation);
        setShowNewChat(false);
        // 👆 Plus de window.location.reload() !
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find((p) => p._id !== currentUserId);
  };

  const formatLastMessageTime = (date) => {
    if (!date) return "";

    const messageDate = new Date(date);
    const now = new Date();
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 48) {
      return "Hier";
    } else {
      return messageDate.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      });
    }
  };

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Messages</h2>
        <button
          className="new-chat-button"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          ✉️
        </button>
      </div>

      {showNewChat && (
        <div className="new-chat-modal">
          <h3>Nouvelle conversation</h3>
          <div className="friends-list">
            {friends.length === 0 ? (
              <p className="no-friends">Aucun ami disponible</p>
            ) : (
              friends.map((friend) => {
                const friendUser = friend.friendUser;
                const friendIsOnline = isUserOnline(friendUser._id); // ⭐ NOUVEAU

                return (
                  <div
                    key={friend.friendship._id}
                    className="friend-item"
                    onClick={() => startNewConversation(friendUser._id)}
                  >
                    <div className="friend-avatar">
                      {friendUser.name?.charAt(0).toUpperCase()}
                      {/* ⭐ NOUVEAU - Badge en ligne dans la liste d'amis */}
                      {friendIsOnline && <span className="online-dot"></span>}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">
                        {friendUser.name} {friendUser.surname}
                      </span>
                      {/* ⭐ NOUVEAU - Texte "En ligne" */}
                      {friendIsOnline && (
                        <span className="online-text">En ligne</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button className="close-modal" onClick={() => setShowNewChat(false)}>
            Fermer
          </button>
        </div>
      )}

      <div className="conversations">
        {localConversations.length === 0 ? (
          <div className="no-conversations">
            <p>Aucune conversation</p>
            <p className="hint">
              Cliquez sur ✉️ pour démarrer une conversation
            </p>
          </div>
        ) : (
          localConversations.map((conversation) => {
            const otherUser = getOtherParticipant(conversation);
            const showConfirm = deleteConfirmId === conversation._id;
            const userIsOnline = otherUser
              ? isUserOnline(otherUser._id)
              : false; // ⭐ NOUVEAU

            return (
              <div key={conversation._id}>
                <div
                  className={`conversation-item ${selectedConversation?._id === conversation._id ? "active" : ""} ${showConfirm ? "deleting" : ""}`}
                  onClick={() =>
                    !showConfirm && onSelectConversation(conversation)
                  }
                >
                  <div className="conversation-avatar">
                    {otherUser?.name?.charAt(0).toUpperCase() || "?"}
                    {userIsOnline ? (
                      <span className="online-indicator"></span>
                    ) : (
                      <span className="offline-indicator"></span>
                    )}
                  </div>

                  <div className="conversation-info">
                    <div className="conversation-header">
                      <span className="conversation-name">
                        {`${otherUser?.name || ""} ${otherUser?.surname || ""}`.trim() ||
                          otherUser?.email ||
                          "Utilisateur"}
                      </span>
                      <span className="conversation-time">
                        {formatLastMessageTime(conversation.lastMessageAt)}
                      </span>
                    </div>

                    <div className="conversation-preview">
                      <span className="last-message">
                        {conversation.lastMessage?.content ||
                          "Nouvelle conversation"}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="unread-badge">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {!showConfirm && (
                    <button
                      className="delete-conversation-btn"
                      onClick={(e) => handleRequestDelete(e, conversation._id)}
                      title="Supprimer la conversation"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {showConfirm && (
                  <div className="delete-confirmation">
                    <span className="delete-confirmation-text">
                      Supprimer cette conversation et tous les messages ?
                    </span>
                    <div className="delete-confirmation-actions">
                      <button
                        className="confirm-delete-btn"
                        onClick={(e) =>
                          handleConfirmDelete(e, conversation._id)
                        }
                      >
                        Supprimer
                      </button>
                      <button
                        className="cancel-delete-btn"
                        onClick={handleCancelDelete}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationList;

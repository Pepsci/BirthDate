import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import useNotifications from "../../context/useNotifications";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import ChatModal from "./ChatModal";
import SupportThread from "./SupportThread";
import "./css/chat.css";

function Chat({
  initialConversationId = null,
  initialTab = null,
  initialTicketId = null,
}) {
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

  // ── Onglet Amis / Événements / Support de la liste, et fil de ticket
  // sélectionné — voir ConversationList pour le rendu des trois listes.
  const [tab, setTab] = useState(initialTab || "dm");
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      navigate("/login");
      return;
    }
    const socket = socketService.connect();
    socket.emit("conversations:join");
    loadConversations();
    loadTickets();

    socket.on("message:new", handleNewMessage);
    socket.on("messages:read", handleMessagesRead);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("support:message", handleSupportMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("messages:read", handleMessagesRead);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
      socket.off("support:message", handleSupportMessage);
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
      const convs = response.data;
      setConversations(convs);

      // ── Auto-sélection depuis deep link notif ──
      if (initialConversationId) {
        const target = convs.find((c) => c._id === initialConversationId);
        if (target) {
          handleSelectConversation(target);
        }
      }
    } catch (error) {
      console.error("❌ Error loading conversations:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      const res = await apiHandler.get("/support/mine");
      const list = res.data?.tickets || [];
      setTickets(list);

      // ── Auto-sélection depuis un deep link de réponse support ──
      if (initialTicketId) {
        const target = list.find((t) => t._id === initialTicketId);
        if (target) handleSelectTicket(target);
      }
    } catch (error) {
      console.error("❌ Error loading tickets:", error);
      setTickets([]);
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
        const currentUserId = localStorage.getItem("userId");
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

  // ── Support : réponse admin poussée en direct (même room socket que les
  // notifications in-app — voir routes/admin/support.js côté serveur) ──
  const handleSupportMessage = ({ ticket }) => {
    if (!ticket) return;
    setTickets((prev) => {
      const exists = prev.some((t) => t._id === ticket._id);
      return exists
        ? prev.map((t) => (t._id === ticket._id ? ticket : t))
        : [ticket, ...prev];
    });
    setSelectedTicket((prev) =>
      prev && prev._id === ticket._id ? ticket : prev,
    );
  };

  const handleConversationRead = (conversationId) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      ),
    );
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setSelectedTicket(null);
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

  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setSelectedConversation(null);
    if (isMobile) setIsChatWindowOpen(true);
    if (ticket.unreadUser) {
      try {
        const res = await apiHandler.get(`/support/mine/${ticket._id}`);
        const updated = res.data.ticket;
        setSelectedTicket(updated);
        setTickets((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t)),
        );
      } catch (error) {
        console.error("Error marking ticket as read:", error);
      }
    }
  };

  const handleTicketUpdate = (updatedTicket) => {
    setSelectedTicket(updatedTicket);
    setTickets((prev) =>
      prev.map((t) => (t._id === updatedTicket._id ? updatedTicket : t)),
    );
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSelectedConversation(null);
    setSelectedTicket(null);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setSelectedTicket(null);
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
    const currentUserId = localStorage.getItem("userId");
    return conversation.participants?.find(
      (p) => p?._id && p._id !== currentUserId,
    );
  };

  const otherUser = selectedConversation
    ? getOtherParticipant(selectedConversation)
    : null;

  const modalTitle = selectedTicket
    ? selectedTicket.subject
    : `${otherUser?.name || ""} ${otherUser?.surname || ""}`.trim() || "Chat";

  return (
    <div className="chat-container">
      {isMobile ? (
        <>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            tab={tab}
            onTabChange={handleTabChange}
            tickets={tickets}
            selectedTicket={selectedTicket}
            onSelectTicket={handleSelectTicket}
          />
          {(selectedConversation || selectedTicket) && (
            <ChatModal
              isOpen={isChatWindowOpen}
              onClose={handleBackToList}
              title={modalTitle}
            >
              {selectedTicket ? (
                <SupportThread
                  ticket={selectedTicket}
                  onTicketUpdate={handleTicketUpdate}
                />
              ) : (
                <ChatWindow
                  conversation={selectedConversation}
                  onBack={handleBackToList}
                  onRead={() => handleConversationRead(selectedConversation._id)}
                />
              )}
            </ChatModal>
          )}
        </>
      ) : (
        <>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            tab={tab}
            onTabChange={handleTabChange}
            tickets={tickets}
            selectedTicket={selectedTicket}
            onSelectTicket={handleSelectTicket}
          />
          {selectedTicket ? (
            <SupportThread
              ticket={selectedTicket}
              onTicketUpdate={handleTicketUpdate}
            />
          ) : selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              onRead={() => handleConversationRead(selectedConversation._id)}
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

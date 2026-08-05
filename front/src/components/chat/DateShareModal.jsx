import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import "./css/giftShareModal.css";

/**
 * DateShareModal
 * Partage d'une carte anniversaire (type de message "date_share") : le
 * destinataire pourra l'ajouter à ses propres dates en un clic.
 *
 * Une seule étape (choix de l'ami) — contrairement à GiftShareModal, il n'y a
 * rien à sélectionner : les idées cadeaux ne sont volontairement pas partagées.
 * Le CSS de GiftShareModal est réutilisé pour rester cohérent visuellement.
 */
const DateShareModal = ({ currentDate, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // La personne concernée ne peut pas être destinataire de sa propre carte.
  const excludedUserId =
    currentDate.linkedUser?._id?.toString() ||
    currentDate.linkedUser?.toString() ||
    null;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setFriendsLoading(true);
    apiHandler
      .get("/friends")
      .then((res) => {
        const list = (res.data || []).filter((f) => {
          const fid = f.friendUser?._id?.toString();
          return fid && fid !== excludedUserId;
        });
        setFriends(list);
      })
      .catch((err) => console.error("Erreur chargement amis:", err))
      .finally(() => setFriendsLoading(false));
  }, []);

  const personName = `${currentDate.name}${
    currentDate.surname ? " " + currentDate.surname : ""
  }`.trim();

  const handleSend = async () => {
    if (!selectedFriend || sending) return;
    setSending(true);

    let conversationId;
    try {
      const res = await apiHandler.post("/conversations/start", {
        friendId: selectedFriend.friendUser._id,
      });
      conversationId = res.data._id;
    } catch (err) {
      console.error("Erreur conversation:", err);
      setSending(false);
      alert("Impossible d'ouvrir la conversation avec cet ami.");
      return;
    }

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      setSending(false);
      alert("Connexion perdue, réessaie dans un instant.");
      return;
    }

    socket.emit("message:send", {
      conversationId,
      content: `🎂 Anniversaire de ${personName}`,
      type: "date_share",
      metadata: {
        personName,
        personId: currentDate._id,
        name: currentDate.name,
        surname: currentDate.surname || "",
        birthDate: currentDate.date,
        nameday: currentDate.nameday || currentDate.linkedUser?.nameday || null,
        // Présent seulement si la carte est liée à un inscrit : permet au
        // destinataire de lui envoyer une demande d'ami. On transmet l'_id,
        // jamais l'email — un ObjectId est opaque hors de l'app.
        linkedUserId: excludedUserId,
      },
      tempId: `temp-${Date.now()}`,
    });

    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(onClose, 900);
    }, 600);
  };

  return (
    <div
      className="gsm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gsm-modal">
        <div className="gsm-header">
          <div className="gsm-header-left">
            <span className="gsm-icon">🎂</span>
            <div>
              <h3 className="gsm-title">Partager cette carte</h3>
              <p className="gsm-subtitle">{personName}</p>
            </div>
          </div>
          <button className="gsm-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="gsm-body">
          <p className="gsm-count">
            Votre ami pourra l'ajouter à ses anniversaires. Vos idées cadeaux ne
            sont pas partagées.
          </p>

          {friendsLoading ? (
            <div className="gsm-loading">Chargement de vos amis...</div>
          ) : friends.length === 0 ? (
            <div className="gsm-empty">
              <span className="gsm-empty-icon">👥</span>
              <p>Aucun autre ami disponible pour partager.</p>
            </div>
          ) : (
            <div className="gsm-friend-list">
              {friends.map((f) => {
                const friend = f.friendUser;
                const isSelected =
                  selectedFriend?.friendUser?._id === friend._id;
                return (
                  <div
                    key={friend._id}
                    className={`gsm-friend-item ${
                      isSelected ? "gsm-friend-item--selected" : ""
                    }`}
                    onClick={() => setSelectedFriend(f)}
                  >
                    <div className="gsm-friend-avatar">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt={friend.name} />
                      ) : (
                        <span>{friend.name?.[0]?.toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <div className="gsm-friend-info">
                      <span className="gsm-friend-name">
                        {friend.name}
                        {friend.surname ? ` ${friend.surname}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="gsm-footer">
          <div className="gsm-footer-buttons">
            <button className="gsm-btn gsm-btn--cancel" onClick={onClose}>
              Annuler
            </button>
            <button
              className={`gsm-btn gsm-btn--send ${sent ? "gsm-btn--sent" : ""}`}
              disabled={!selectedFriend || sending || sent}
              onClick={handleSend}
            >
              {sent ? "✅ Envoyée !" : sending ? "Envoi…" : "Envoyer la carte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateShareModal;

import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import "./css/giftShareModal.css";

/**
 * GiftShareModal v2
 * Étape 1 : sélectionner les idées cadeaux
 * Étape 2 : choisir l'ami destinataire (la personne concernée est exclue)
 */
const GiftShareModal = ({ currentDate, onClose }) => {
  const [step, setStep] = useState(1);

  // Étape 1
  const [gifts] = useState(
    (currentDate.gifts || []).filter((g) => g && g.giftName && g._id),
  );
  const [selected, setSelected] = useState(new Set());

  // Étape 2
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  // Envoi
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Exclure la personne concernée des destinataires possibles
  const excludedUserId =
    currentDate.linkedUser?._id?.toString() ||
    currentDate.linkedUser?.toString() ||
    null;

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Charger les amis uniquement quand on passe à l'étape 2
  useEffect(() => {
    if (step !== 2) return;
    setFriendsLoading(true);
    apiHandler
      .get("/friends")
      .then((res) => {
        // Structure retournée : [{ friendship, friendUser, linkedDate }]
        const list = (res.data || []).filter((f) => {
          const fid = f.friendUser?._id?.toString();
          return fid && fid !== excludedUserId;
        });
        setFriends(list);
      })
      .catch((err) => console.error("Erreur chargement amis:", err))
      .finally(() => setFriendsLoading(false));
  }, [step]);

  const toggleGift = (giftId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(giftId) ? next.delete(giftId) : next.add(giftId);
      return next;
    });
  };

  const allSelected = gifts.length > 0 && selected.size === gifts.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(gifts.map((g) => g._id)));

  const handleSend = async () => {
    if (!selectedFriend) return;
    setSending(true);

    // Créer ou récupérer la conversation avec l'ami choisi
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

    const selectedGifts = gifts
      .filter((g) => selected.has(g._id))
      .map((g) => ({
        giftName: g.giftName,
        occasion: g.occasion || "Anniversaire",
        year: g.year,
        purchased: g.purchased,
      }));

    const personName = `${currentDate.name}${currentDate.surname ? " " + currentDate.surname : ""}`;
    const fallbackContent = `🎁 Idées cadeaux pour ${personName} :\n${selectedGifts.map((g) => `• ${g.giftName}`).join("\n")}`;
    const tempId = `temp-${Date.now()}`;

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      setSending(false);
      alert("Connexion perdue, réessaie dans un instant.");
      return;
    }

    socket.emit("message:send", {
      conversationId,
      content: fallbackContent,
      type: "gift_share",
      metadata: {
        personName,
        personId: currentDate._id,
        gifts: selectedGifts,
      },
      tempId,
    });

    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(onClose, 900);
    }, 600);
  };

  const personName = `${currentDate.name}${currentDate.surname ? " " + currentDate.surname : ""}`;

  return (
    <div
      className="gsm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gsm-modal">

        {/* ── Header ── */}
        <div className="gsm-header">
          <div className="gsm-header-left">
            {step === 2 && (
              <button className="gsm-back" onClick={() => setStep(1)} aria-label="Retour">
                ←
              </button>
            )}
            <span className="gsm-icon">🎁</span>
            <div>
              <h3 className="gsm-title">
                {step === 1 ? "Partager des idées" : "Envoyer à..."}
              </h3>
              <p className="gsm-subtitle">
                {step === 1
                  ? `Idées pour ${personName}`
                  : `${selected.size} idée${selected.size > 1 ? "s" : ""} · ${personName}`}
              </p>
            </div>
          </div>
          <button className="gsm-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* ── Corps ── */}
        <div className="gsm-body">

          {/* ÉTAPE 1 — Sélection des idées */}
          {step === 1 && (
            gifts.length === 0 ? (
              <div className="gsm-empty">
                <span className="gsm-empty-icon">💡</span>
                <p>Aucune idée de cadeau enregistrée pour le moment.</p>
              </div>
            ) : (
              <>
                <button className="gsm-select-all" onClick={toggleAll}>
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
                <div className="gsm-gift-list">
                  {gifts.map((gift) => {
                    const isSelected = selected.has(gift._id);
                    return (
                      <div
                        key={gift._id}
                        className={`gsm-gift-item ${isSelected ? "gsm-gift-item--selected" : ""}`}
                        onClick={() => toggleGift(gift._id)}
                      >
                        <div className="gsm-gift-check">{isSelected ? "✓" : ""}</div>
                        <div className="gsm-gift-info">
                          <span className="gsm-gift-name">{gift.giftName}</span>
                          <span className="gsm-gift-meta">
                            {gift.occasion || "Anniversaire"}
                            {gift.year ? ` · ${gift.year}` : ""}
                            {gift.purchased ? " · ✅ Acheté" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* ÉTAPE 2 — Sélection du destinataire */}
          {step === 2 && (
            friendsLoading ? (
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
                  const isSelected = selectedFriend?.friendUser?._id === friend._id;
                  return (
                    <div
                      key={friend._id}
                      className={`gsm-friend-item ${isSelected ? "gsm-friend-item--selected" : ""}`}
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
                          {friend.name}{friend.surname ? ` ${friend.surname}` : ""}
                        </span>
                        <span className="gsm-friend-email">{friend.email}</span>
                      </div>
                      <div className="gsm-friend-check">
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* ── Footer ── */}
        <div className="gsm-footer">
          {step === 1 ? (
            <>
              <p className="gsm-count">
                {selected.size === 0
                  ? "Sélectionne les idées à partager"
                  : `${selected.size} idée${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`}
              </p>
              <div className="gsm-footer-buttons">
                <button className="gsm-btn gsm-btn--cancel" onClick={onClose}>
                  Annuler
                </button>
                <button
                  className="gsm-btn gsm-btn--send"
                  onClick={() => setStep(2)}
                  disabled={selected.size === 0}
                >
                  Suivant →
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="gsm-count">
                {selectedFriend
                  ? `Envoyer à ${selectedFriend.friendUser.name}`
                  : "Choisis un ami destinataire"}
              </p>
              <div className="gsm-footer-buttons">
                <button className="gsm-btn gsm-btn--cancel" onClick={() => setStep(1)}>
                  Retour
                </button>
                <button
                  className={`gsm-btn gsm-btn--send ${sent ? "gsm-btn--sent" : ""}`}
                  onClick={handleSend}
                  disabled={!selectedFriend || sending || sent}
                >
                  {sent ? "✓ Envoyé !" : sending ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default GiftShareModal;
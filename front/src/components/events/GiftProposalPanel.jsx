import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import GiftCardGrid from "../UI/GiftCardGrid";
import ImportGiftModal from "./ImportGiftModal";

const BLOCKED_DOMAINS = [
  { domain: "amazon", name: "Amazon" },
  { domain: "fnac", name: "Fnac" },
  { domain: "micromania", name: "Micromania" },
];

const DEFAULT_FORM = { name: "", url: "", price: "", image: "" };

const GiftProposalPanel = ({ shortId, isOrganizer }) => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingGift, setEditingGift] = useState(null);
  const [newGift, setNewGift] = useState(DEFAULT_FORM);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchMessage, setFetchMessage] = useState(null);

  const authToken = localStorage.getItem("authToken");
  const currentUserId = authToken
    ? JSON.parse(atob(authToken.split(".")[1]))._id
    : null;

  const fetchProposals = async () => {
    try {
      const res = await apiHandler.get(`/events/${shortId}/gifts`);
      setProposals(res.data);
    } catch (err) {
      console.error("Error fetching gift proposals", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
    socketService.on("event:gift_proposal", () => {
      fetchProposals();
    });
    return () => {
      socketService.off("event:gift_proposal");
    };
  }, [shortId]);

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setNewGift((prev) => ({ ...prev, url: value }));
    const matched = BLOCKED_DOMAINS.find((s) =>
      value.toLowerCase().includes(s.domain),
    );
    if (matched) {
      setFetchMessage({
        type: "warning",
        text: `⚠️ ${matched.name} ne supporte pas le remplissage automatique`,
      });
    } else if (!value) {
      setFetchMessage(null);
    } else {
      setFetchMessage((prev) =>
        prev?.text?.includes("ne supporte pas") ? null : prev,
      );
    }
  };

  const handleFetchUrl = async () => {
    if (!newGift.url.trim()) return;
    setIsFetchingUrl(true);
    setFetchMessage(null);
    try {
      const response = await apiHandler.post("/wishlist/fetch-url", {
        url: newGift.url,
      });
      if (!response.data.success) {
        setFetchMessage({
          type: "warning",
          text: `⚠️ ${response.data.message || "Ce site ne permet pas la récupération automatique"}`,
        });
        return;
      }
      const { title, image, price } = response.data.data;
      setNewGift((prev) => ({
        ...prev,
        name: title || prev.name,
        image: image || prev.image,
        price: price || prev.price,
      }));
      const missing = [];
      if (!title) missing.push("titre");
      if (!price) missing.push("prix");
      if (!image) missing.push("image");
      setFetchMessage(
        missing.length === 0
          ? { type: "success", text: "✓ Infos récupérées !" }
          : {
              type: "warning",
              text: `⚠️ Remplissage partiel — ${missing.join(", ")} non trouvé${missing.length > 1 ? "s" : ""}`,
            },
      );
    } catch {
      setFetchMessage({
        type: "warning",
        text: "⚠️ Erreur lors de la récupération",
      });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleAddGift = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.post(`/events/${shortId}/gifts`, {
        name: newGift.name,
        url: newGift.url,
        price: newGift.price,
      });
      setNewGift(DEFAULT_FORM);
      setFetchMessage(null);
      setShowAddForm(false);
      fetchProposals();
      socketService.emit("event:gift_proposed", { shortId });
    } catch (err) {
      console.error("Error proposing gift", err);
    }
  };

  const handleEditGift = async (e) => {
    e.preventDefault();
    if (!editingGift?.name?.trim()) return;
    try {
      await apiHandler.put(`/events/${shortId}/gifts/${editingGift._id}`, {
        name: editingGift.name,
        url: editingGift.url,
        price: editingGift.price,
      });
      setEditingGift(null);
      fetchProposals();
    } catch (err) {
      console.error("Error updating gift proposal", err);
    }
  };

  const handleVote = async (giftId) => {
    try {
      await apiHandler.post(`/events/${shortId}/gifts/${giftId}/vote`);
      fetchProposals();
      socketService.emit("event:gift_proposed", { shortId });
    } catch (err) {
      console.error("Error voting", err);
    }
  };

  const inputStyle = {
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid var(--border-color)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    width: "100%",
  };

  if (loading)
    return (
      <div
        style={{
          color: "var(--text-tertiary)",
          textAlign: "center",
          padding: "20px",
        }}
      >
        Chargement des cadeaux...
      </div>
    );

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        padding: "20px",
        borderRadius: "15px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>🎁 Idées de cadeaux</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => {
              setShowImportModal(true);
              setShowAddForm(false);
            }}
            style={{
              background: "transparent",
              color: "var(--primary)",
              border: "1px solid var(--primary)",
              padding: "5px 12px",
              borderRadius: "15px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: "600",
            }}
          >
            📋 Depuis une liste
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowImportModal(false);
              setFetchMessage(null);
            }}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              padding: "5px 12px",
              borderRadius: "15px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {showAddForm ? "Annuler" : "+ Proposer"}
          </button>
        </div>
      </div>

      {/* Formulaire édition */}
      {editingGift && (
        <form
          onSubmit={handleEditGift}
          style={{
            marginBottom: "20px",
            padding: "15px",
            background: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <input
            type="text"
            placeholder="Nom du cadeau *"
            value={editingGift.name}
            onChange={(e) =>
              setEditingGift((p) => ({ ...p, name: e.target.value }))
            }
            required
            style={inputStyle}
          />
          <input
            type="url"
            placeholder="Lien (URL)"
            value={editingGift.url}
            onChange={(e) =>
              setEditingGift((p) => ({ ...p, url: e.target.value }))
            }
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="Prix approx. (€)"
            value={editingGift.price}
            onChange={(e) =>
              setEditingGift((p) => ({ ...p, price: e.target.value }))
            }
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "7px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditingGift(null)}
              style={{
                padding: "7px 12px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "5px",
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Formulaire ajout avec fetch auto */}
      {showAddForm && (
        <div className="gift-form-card" style={{ marginBottom: "20px" }}>
          <h3
            style={{
              textAlign: "center",
              marginBottom: "16px",
              fontSize: "16px",
              color: "var(--text-primary)",
            }}
          >
            Nouvelle idée
          </h3>
          <form onSubmit={handleAddGift}>
            <div className="gift-form-input">
              {/* URL + fetch */}
              <div className="gift-url-row">
                <input
                  type="url"
                  className="form-input"
                  placeholder="Lien du produit (URL)"
                  value={newGift.url}
                  onChange={handleUrlChange}
                />
                <button
                  type="button"
                  className="btn-profil btn-fetch-url"
                  onClick={handleFetchUrl}
                  disabled={!newGift.url.trim() || isFetchingUrl}
                >
                  {isFetchingUrl ? "⏳" : "🔍 Récupérer les infos avec le lien"}
                </button>
              </div>

              {fetchMessage && (
                <p
                  className={`fetch-message fetch-message--${fetchMessage.type}`}
                >
                  {fetchMessage.text}
                </p>
              )}

              {newGift.image && (
                <div className="gift-image-preview">
                  <img
                    src={newGift.image}
                    alt="Preview"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}

              <input
                type="text"
                className="form-input"
                placeholder="Nom du cadeau *"
                value={newGift.name}
                onChange={(e) =>
                  setNewGift((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
              <input
                type="number"
                className="form-input"
                placeholder="Prix approx. (€)"
                value={newGift.price}
                onChange={(e) =>
                  setNewGift((p) => ({ ...p, price: e.target.value }))
                }
                step="0.01"
                min="0"
              />
            </div>

            <div className="gift-form-buttons">
              <button type="submit" className="btn-profil btn-profilGreen">
                Ajouter l'idée
              </button>
              <button
                type="button"
                className="btn-profil btn-profilGrey"
                onClick={() => {
                  setShowAddForm(false);
                  setNewGift(DEFAULT_FORM);
                  setFetchMessage(null);
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grille */}
      {proposals.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            fontStyle: "italic",
            color: "var(--text-tertiary)",
            margin: "20px 0",
          }}
        >
          Aucune idée pour le moment. Proposez-en une !
        </p>
      ) : (
        <GiftCardGrid
          items={proposals}
          type="event"
          currentUserId={currentUserId}
          onEdit={(gift) =>
            setEditingGift({
              _id: gift._id,
              name: gift.name,
              url: gift.url || "",
              price: gift.price || "",
            })
          }
          onVote={handleVote}
        />
      )}

      {showImportModal && (
        <ImportGiftModal
          shortId={shortId}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            fetchProposals();
            socketService.emit("event:gift_proposed", { shortId });
          }}
        />
      )}
    </div>
  );
};

export default GiftProposalPanel;

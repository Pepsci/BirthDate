import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import ImportGiftModal from "./ImportGiftModal";

const GiftProposalPanel = ({ shortId, isOrganizer }) => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newGift, setNewGift] = useState({ name: "", url: "", price: "" });
  const [editingGift, setEditingGift] = useState(null);

  const authToken = localStorage.getItem("authToken");
  const currentUserId = authToken ? JSON.parse(atob(authToken.split(".")[1]))._id : null;

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
    socketService.on("event:gift_proposal", () => { fetchProposals(); });
    return () => { socketService.off("event:gift_proposal"); };
  }, [shortId]);

  const handleAddGift = async (e) => {
    e.preventDefault();
    try {
      await apiHandler.post(`/events/${shortId}/gifts`, newGift);
      setNewGift({ name: "", url: "", price: "" });
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
      console.error("Error voting for gift", err);
    }
  };

  if (loading) return (
    <div style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "20px" }}>
      Chargement des cadeaux...
    </div>
  );

  return (
    <div className="gift-proposal-panel" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "15px" }}>

      {/* ── Header avec les deux boutons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "8px", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🎁 Idées de cadeaux</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          {/* Bouton importer depuis une liste */}
          <button
            onClick={() => { setShowImportModal(true); setShowAddForm(false); }}
            style={{
              background: "transparent",
              color: "var(--primary)",
              border: "1px solid var(--primary)",
              padding: "5px 12px",
              borderRadius: "15px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            📋 Depuis une liste
          </button>
          {/* Bouton proposer manuellement */}
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowImportModal(false); }}
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

      {/* ── Formulaire ajout manuel ── */}
      {showAddForm && (
        <form onSubmit={handleAddGift} style={{ marginBottom: "20px", padding: "15px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <input type="text" placeholder="Nom du cadeau *" value={newGift.name} onChange={(e) => setNewGift({...newGift, name: e.target.value})} required style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <input type="text" placeholder="Lien (URL)" value={newGift.url} onChange={(e) => setNewGift({...newGift, url: e.target.value})} style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <input type="number" placeholder="Prix approx. (€)" value={newGift.price} onChange={(e) => setNewGift({...newGift, price: e.target.value})} style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <button type="submit" style={{ padding: "10px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Ajouter l'idée</button>
        </form>
      )}

      {/* ── Liste des propositions ── */}
      <div className="gifts-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {proposals.length === 0 ? (
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--text-tertiary)", margin: "20px 0" }}>
            Aucune idée pour le moment. Proposez-en une !
          </p>
        ) : (
          proposals.map((gift) => {
            const isOwner = gift.proposedBy._id?.toString() === currentUserId;
            const isEditing = editingGift?._id === gift._id;
            const hasVoted = gift.votes.map(v => v.toString()).includes(currentUserId);
            return (
              <div key={gift._id} style={{ padding: "15px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                {isEditing ? (
                  <form onSubmit={handleEditGift} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input type="text" value={editingGift.name} onChange={(e) => setEditingGift(prev => ({ ...prev, name: e.target.value }))} required style={{ padding: "7px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
                    <input type="text" placeholder="Lien (URL)" value={editingGift.url} onChange={(e) => setEditingGift(prev => ({ ...prev, url: e.target.value }))} style={{ padding: "7px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
                    <input type="number" placeholder="Prix approx. (€)" value={editingGift.price} onChange={(e) => setEditingGift(prev => ({ ...prev, price: e.target.value }))} style={{ padding: "7px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="submit" style={{ flex: 1, padding: "7px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Enregistrer</button>
                      <button type="button" onClick={() => setEditingGift(null)} style={{ padding: "7px 12px", background: "transparent", border: "1px solid var(--border-color)", borderRadius: "5px", cursor: "pointer", color: "var(--text-secondary)" }}>Annuler</button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
                        {gift.name}
                        {gift.url && (
                          <a href={gift.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>
                            <i className="fa-solid fa-link"></i>
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {gift.price ? `${gift.price}€` : "Prix non précisé"} • Proposé par {gift.proposedBy.name}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {isOwner && (
                        <button
                          onClick={() => setEditingGift({ _id: gift._id, name: gift.name, url: gift.url || "", price: gift.price || "" })}
                          style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "8px", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        onClick={() => handleVote(gift._id)}
                        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "10px", border: "1px solid var(--primary)", background: hasVoted ? "var(--primary)" : "transparent", color: hasVoted ? "#fff" : "var(--primary)", cursor: "pointer" }}
                      >
                        <i className="fa-solid fa-heart"></i>
                        <span style={{ fontWeight: "bold" }}>{gift.votes.length}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal import depuis liste ── */}
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
import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";

const GiftProposalPanel = ({ shortId, isOrganizer }) => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGift, setNewGift] = useState({ name: "", url: "", price: "" });

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
    
    // Listen for socket updates
    socketService.on("event:gift_proposal", () => {
      fetchProposals();
    });

    return () => {
      socketService.off("event:gift_proposal");
    };
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

  const handleVote = async (giftId) => {
    try {
      await apiHandler.post(`/events/${shortId}/gifts/${giftId}/vote`);
      fetchProposals();
      socketService.emit("event:gift_proposed", { shortId });
    } catch (err) {
      console.error("Error voting for gift", err);
    }
  };

  if (loading) return <div style={{ color: "var(--text-tertiary)", textAlign: "center", padding: "20px" }}>Chargement des cadeaux...</div>;

  return (
    <div className="gift-proposal-panel" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ margin: 0 }}>🎁 Idées de cadeaux</h3>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "5px 12px", borderRadius: "15px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          {showAddForm ? "Annuler" : "+ Proposer"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddGift} style={{ marginBottom: "20px", padding: "15px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
          <input type="text" placeholder="Nom du cadeau *" value={newGift.name} onChange={(e) => setNewGift({...newGift, name: e.target.value})} required style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <input type="text" placeholder="Lien (URL)" value={newGift.url} onChange={(e) => setNewGift({...newGift, url: e.target.value})} style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <input type="number" placeholder="Prix approx. (€)" value={newGift.price} onChange={(e) => setNewGift({...newGift, price: e.target.value})} style={{ padding: "8px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
          <button type="submit" style={{ padding: "10px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Ajouter l'idée</button>
        </form>
      )}

      <div className="gifts-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {proposals.length === 0 ? (
          <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--text-tertiary)", margin: "20px 0" }}>Aucune idée pour le moment. Proposez-en une !</p>
        ) : (
          proposals.map((gift) => (
            <div key={gift._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: "var(--bg-primary)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
                  {gift.name}
                  {gift.url && <a href={gift.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: "0.8rem" }}><i className="fa-solid fa-link"></i></a>}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {gift.price ? `${gift.price}€` : "Prix non précisé"} • Proposé par {gift.proposedBy.name}
                </div>
              </div>
              <button 
                onClick={() => handleVote(gift._id)}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "10px", border: "1px solid var(--primary)", background: gift.votes.includes(socketService.getSocket()?.userId) ? "var(--primary)" : "transparent", color: gift.votes.includes(socketService.getSocket()?.userId) ? "#fff" : "var(--primary)", cursor: "pointer" }}
              >
                <i className="fa-solid fa-heart"></i>
                <span style={{ fontWeight: "bold" }}>{gift.votes.length}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GiftProposalPanel;

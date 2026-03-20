import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";

const JoinEventModal = ({ shortId, onClose }) => {
  const { currentUser } = useAuth();
  const [code, setCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { code: code.toUpperCase() };
      if (!currentUser) payload.guestName = guestName;

      const res = await apiHandler.post(`/events/${shortId}/join`, payload);
      
      // Store code for session access if external or to enable full view
      sessionStorage.setItem(`event_code_${shortId}`, code.toUpperCase());
      
      onClose(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Code invalide");
      setLoading(false);
    }
  };

  return (
    <div className="event-modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="event-modal" style={{ background: "var(--bg-primary)", padding: "30px", borderRadius: "15px", width: "90%", maxWidth: "400px", boxShadow: "var(--shadow-lg)" }}>
        <h2 className="titleFont" style={{ margin: "0 0 10px 0" }}>Rejoindre l'événement</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "20px" }}>Entrez le code d'accès à 6 caractères pour participer.</p>
        
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {!currentUser && (
            <div className="form-group">
              <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem" }}>Votre nom *</label>
              <input 
                type="text" 
                value={guestName} 
                onChange={(e) => setGuestName(e.target.value)} 
                required 
                placeholder="Ex: Jean"
                style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
              />
            </div>
          )}
          
          <div className="form-group">
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem" }}>Code d'accès *</label>
            <input 
              type="text" 
              value={code} 
              onChange={(e) => setCode(e.target.value.toUpperCase())} 
              required 
              maxLength={6}
              placeholder="A1B2C3"
              style={{ width: "100%", padding: "15px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", textAlign: "center", fontSize: "1.5rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "5px" }}
            />
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0, textAlign: "center" }}>{error}</p>}

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => onClose(false)} className="btn-cancel" style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", cursor: "pointer", background: "var(--bg-tertiary)" }}>Annuler</button>
            <button type="submit" disabled={loading} className="btn-submit" style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", cursor: "pointer", background: "var(--primary)", color: "#fff", fontWeight: "bold" }}>
              {loading ? "Vérification..." : "Rejoindre 🎉"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinEventModal;

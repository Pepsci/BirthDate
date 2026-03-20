import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";

const InviteModal = ({ shortId, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [externalEmails, setExternalEmails] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiHandler.get("/friends")
      .then(res => setFriends(res.data))
      .catch(err => console.error("Error fetching friends", err));
  }, []);

  const handleInvite = async () => {
    setLoading(true);
    try {
      const emails = externalEmails.split(",").map(e => e.trim()).filter(e => e !== "");
      await apiHandler.post(`/events/${shortId}/invite`, { 
        userIds: selectedFriends,
        externalEmails: emails
      });
      onClose(true);
    } catch (err) {
      console.error("Error sending invites", err);
      setLoading(false);
    }
  };

  return (
    <div className="event-modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="event-modal" style={{ background: "var(--bg-primary)", padding: "30px", borderRadius: "15px", width: "90%", maxWidth: "500px", boxShadow: "var(--shadow-lg)" }}>
        <h2 className="titleFont" style={{ margin: "0 0 20px 0" }}>Inviter des proches</h2>
        
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "10px" }}>Vos amis BirthReminder</label>
            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "10px", background: "var(--bg-secondary)" }}>
              {friends.filter(f => f.friendUser).map(f => (
                <label key={f.friendUser._id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedFriends.includes(f.friendUser._id)} 
                    onChange={(e) => {
                      if (e.target.checked) setSelectedFriends([...selectedFriends, f.friendUser._id]);
                      else setSelectedFriends(selectedFriends.filter(id => id !== f.friendUser._id));
                    }} 
                  />
                  <span>{f.friendUser.name} {f.friendUser.surname}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "10px" }}>Email d'invités externes (séparés par une virgule)</label>
            <textarea 
              placeholder="exemple@email.com, ami@email.com" 
              value={externalEmails} 
              onChange={(e) => setExternalEmails(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", minHeight: "80px" }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: "10px", marginTop: "30px", justifyContent: "flex-end" }}>
          <button onClick={() => onClose(false)} className="btn-cancel" style={{ padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", background: "var(--bg-tertiary)" }}>Annuler</button>
          <button onClick={handleInvite} disabled={loading || (selectedFriends.length === 0 && !externalEmails.trim())} className="btn-submit" style={{ padding: "10px 20px", borderRadius: "10px", border: "none", cursor: "pointer", background: "var(--primary)", color: "#fff", fontWeight: "bold" }}>
            {loading ? "Envoi..." : "Envoyer les invitations 📨"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;

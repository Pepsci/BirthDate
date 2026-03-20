import React from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";

const DateVotePanel = ({ shortId, options, myVotes = [], isOrganizer, invitations = [], onVoteChange }) => {
  const handleVote = async (date) => {
    let newVotes = [...myVotes];
    if (newVotes.includes(date)) {
      newVotes = newVotes.filter(d => d !== date);
    } else {
      newVotes.push(date);
    }

    try {
      await apiHandler.post(`/events/${shortId}/vote/date`, { dates: newVotes });
      if (onVoteChange) onVoteChange(newVotes);
      
      // Notify via socket
      socketService.emit("event:vote_updated", { shortId });
    } catch (err) {
      console.error("Error voting for date", err);
    }
  };

  return (
    <div className="date-vote-panel" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "15px" }}>
      <h3 style={{ margin: "0 0 15px 0" }}>📅 Vote pour la date</h3>
      <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
        Choisissez toutes les dates qui vous conviennent.
      </p>
      
      <div className="date-options" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {options.map((opt, i) => {
          const isSelected = myVotes.includes(opt);
          return (
            <div 
              key={i} 
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <div 
                onClick={() => !isOrganizer && handleVote(opt)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "15px", borderRadius: "10px", border: `1px solid ${isSelected ? "var(--primary)" : "var(--border-color)"}`,
                  background: isSelected ? "var(--bg-tertiary)" : "var(--bg-primary)",
                  cursor: isOrganizer ? "default" : "pointer"
                }}
              >
                <span>{new Date(opt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* Nombre de votants */}
                  <span style={{ fontSize: "0.85rem", fontWeight: "bold", opacity: 0.7 }}>
                    {invitations.filter(inv => inv.dateVote?.includes(opt)).length} votant(s)
                  </span>
                  {!isOrganizer && (
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%", border: "2px solid var(--primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSelected ? "var(--primary)" : "transparent"
                    }}>
                      {isSelected && <i className="fa-solid fa-check" style={{ color: "#fff", fontSize: "0.8rem" }}></i>}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Liste des prénoms des votants */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", paddingLeft: "5px" }}>
                {invitations
                  .filter(inv => inv.dateVote?.includes(opt))
                  .map(inv => (
                    <span key={inv._id} style={{ fontSize: "0.75rem", background: "var(--bg-tertiary)", padding: "2px 8px", borderRadius: "10px", opacity: 0.8 }}>
                      {inv.user?.name || "Invité"}
                    </span>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DateVotePanel;

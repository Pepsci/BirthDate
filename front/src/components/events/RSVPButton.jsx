import React from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";

const RSVPButton = ({ shortId, currentStatus, onStatusChange }) => {
  const handleRSVP = async (newStatus) => {
    try {
      await apiHandler.put(`/events/${shortId}/rsvp`, { status: newStatus });
      if (onStatusChange) onStatusChange(newStatus);
      
      // Notify via socket
      socketService.emit("event:rsvp_updated", { shortId });
    } catch (err) {
      console.error("Error setting RSVP", err);
    }
  };

  const getButtonClass = (status) => {
    return `rsvp-btn ${currentStatus === status ? "active" : ""}`;
  };

  return (
    <div className="rsvp-container" style={{ display: "flex", gap: "10px", margin: "20px 0" }}>
      <button 
        className={getButtonClass("accepted")} 
        onClick={() => handleRSVP("accepted")}
        style={{
          flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer", border: "none",
          background: currentStatus === "accepted" ? "var(--success)" : "var(--bg-secondary)",
          color: currentStatus === "accepted" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold"
        }}
      >
        Oui, je viens ! 🎉
      </button>
      <button 
        className={getButtonClass("maybe")} 
        onClick={() => handleRSVP("maybe")}
        style={{
          flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer", border: "none",
          background: currentStatus === "maybe" ? "var(--warning)" : "var(--bg-secondary)",
          color: currentStatus === "maybe" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold"
        }}
      >
        Peut-être 🤔
      </button>
      <button 
        className={getButtonClass("declined")} 
        onClick={() => handleRSVP("declined")}
        style={{
          flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer", border: "none",
          background: currentStatus === "declined" ? "var(--danger)" : "var(--bg-secondary)",
          color: currentStatus === "declined" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold"
        }}
      >
        Non, sans moi 😢
      </button>
    </div>
  );
};

export default RSVPButton;

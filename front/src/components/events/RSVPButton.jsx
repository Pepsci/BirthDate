import React from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import useGuestHeaders from "../../hooks/useGuestHeaders";

const RSVPButton = ({ shortId, currentStatus, onStatusChange }) => {
  const guestHeaders = useGuestHeaders(shortId);

  const handleRSVP = async (newStatus) => {
    try {
      await apiHandler.put(
        `/events/${shortId}/rsvp`,
        { status: newStatus },
        guestHeaders,
      );
      if (onStatusChange) onStatusChange(newStatus);
      socketService.emit("event:rsvp_updated", { shortId });
    } catch (err) {
      console.error("Error setting RSVP", err);
    }
  };

  return (
    <div
      className="rsvp-container"
      style={{ display: "flex", gap: "10px", margin: "20px 0" }}
    >
      <button
        className={`rsvp-btn ${currentStatus === "accepted" ? "active" : ""}`}
        onClick={() => handleRSVP("accepted")}
        style={{
          flex: 1,
          padding: "12px",
          borderRadius: "10px",
          cursor: "pointer",
          border: "none",
          background:
            currentStatus === "accepted"
              ? "var(--success)"
              : "var(--bg-secondary)",
          color: currentStatus === "accepted" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold",
        }}
      >
        Oui, je viens ! 🎉
      </button>
      <button
        className={`rsvp-btn ${currentStatus === "maybe" ? "active" : ""}`}
        onClick={() => handleRSVP("maybe")}
        style={{
          flex: 1,
          padding: "12px",
          borderRadius: "10px",
          cursor: "pointer",
          border: "none",
          background:
            currentStatus === "maybe"
              ? "var(--warning)"
              : "var(--bg-secondary)",
          color: currentStatus === "maybe" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold",
        }}
      >
        Peut-être 🤔
      </button>
      <button
        className={`rsvp-btn ${currentStatus === "declined" ? "active" : ""}`}
        onClick={() => handleRSVP("declined")}
        style={{
          flex: 1,
          padding: "12px",
          borderRadius: "10px",
          cursor: "pointer",
          border: "none",
          background:
            currentStatus === "declined"
              ? "var(--danger)"
              : "var(--bg-secondary)",
          color: currentStatus === "declined" ? "#fff" : "var(--text-primary)",
          fontWeight: "bold",
        }}
      >
        Non, sans moi 😢
      </button>
    </div>
  );
};

export default RSVPButton;

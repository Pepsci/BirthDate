import React from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import useGuestHeaders from "../../hooks/useGuestHeaders";

const LocationVotePanel = ({
  shortId,
  options,
  myVote = null,
  isOrganizer,
  invitations = [],
  onVoteChange,
}) => {
  const guestHeaders = useGuestHeaders(shortId);

  const handleVote = async (locationId) => {
    try {
      await apiHandler.post(
        `/events/${shortId}/vote/location`,
        { locationId },
        guestHeaders,
      );
      if (onVoteChange) onVoteChange(locationId);
      socketService.emit("event:vote_updated", { shortId });
    } catch (err) {
      console.error("Error voting for location", err);
    }
  };

  return (
    <div
      className="location-vote-panel"
      style={{
        background: "var(--bg-secondary)",
        padding: "20px",
        borderRadius: "15px",
      }}
    >
      <h3 style={{ margin: "0 0 15px 0" }}>📍 Vote pour le lieu</h3>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
          marginBottom: "20px",
        }}
      >
        Choisissez le lieu qui vous convient le mieux.
      </p>

      <div
        className="location-options"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {options.map((opt) => {
          const isSelected = myVote === opt._id;
          return (
            <div
              key={opt._id}
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <div
                onClick={() => !isOrganizer && handleVote(opt._id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "15px",
                  borderRadius: "10px",
                  border: `1px solid ${isSelected ? "var(--primary)" : "var(--border-color)"}`,
                  background: isSelected
                    ? "var(--bg-tertiary)"
                    : "var(--bg-primary)",
                  cursor: isOrganizer ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: "bold" }}>{opt.name}</span>
                  <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                    {opt.address}
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      opacity: 0.7,
                    }}
                  >
                    {
                      invitations.filter((inv) => inv.locationVote === opt._id)
                        .length
                    }{" "}
                    votant(s)
                  </span>
                  {!isOrganizer && (
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        border: "2px solid var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected
                          ? "var(--primary)"
                          : "transparent",
                      }}
                    >
                      {isSelected && (
                        <i
                          className="fa-solid fa-check"
                          style={{ color: "#fff", fontSize: "0.8rem" }}
                        ></i>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "5px",
                  paddingLeft: "5px",
                }}
              >
                {invitations
                  .filter((inv) => inv.locationVote === opt._id)
                  .map((inv) => (
                    <span
                      key={inv._id}
                      style={{
                        fontSize: "0.75rem",
                        background: "var(--bg-tertiary)",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        opacity: 0.8,
                      }}
                    >
                      {inv.user?.name || inv.guestName || "Invité"}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationVotePanel;

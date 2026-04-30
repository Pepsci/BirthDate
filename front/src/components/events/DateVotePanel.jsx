import React from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import useGuestHeaders from "../../hooks/useGuestHeaders";

const DateVotePanel = ({
  shortId,
  options,
  myVotes = [],
  isOrganizer,
  invitations = [],
  onVoteChange,
  onRefresh,
  onConfirmDate,
}) => {
  const guestHeaders = useGuestHeaders(shortId);

  const handleVote = async (date) => {
    let newVotes = [...myVotes];
    if (newVotes.includes(date)) {
      newVotes = newVotes.filter((d) => d !== date);
    } else {
      newVotes.push(date);
    }
    try {
      await apiHandler.post(
        `/events/${shortId}/vote/date`,
        { dates: newVotes },
        guestHeaders,
      );
      if (onVoteChange) onVoteChange(newVotes);
      if (onRefresh) onRefresh();
      socketService.emit("event:vote_updated", { shortId });
    } catch (err) {
      console.error("Error voting for date", err);
    }
  };

  return (
    <div
      className="date-vote-panel"
      style={{
        background: "var(--bg-secondary)",
        padding: "20px",
        borderRadius: "15px",
      }}
    >
      <h3 style={{ margin: "0 0 15px 0" }}>📅 Vote pour la date</h3>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
          marginBottom: "20px",
        }}
      >
        {isOrganizer
          ? "Consultez les votes et confirmez la date retenue."
          : "Choisissez toutes les dates qui vous conviennent."}
      </p>

      <div
        className="date-options"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {options.map((opt, i) => {
          const isSelected = myVotes.some(
            (v) => new Date(v).getTime() === new Date(opt).getTime(),
          );
          const voteCount = invitations.filter((inv) =>
            inv.dateVote?.some(
              (v) => new Date(v).getTime() === new Date(opt).getTime(),
            ),
          ).length;

          return (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: "5px" }}
            >
              <div
                onClick={() => !isOrganizer && handleVote(opt)}
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
                <span>
                  {new Date(opt).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

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
                    {voteCount} votant(s)
                  </span>

                  {/* Bouton confirmer — organisateur uniquement */}
                  {isOrganizer && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfirmDate?.(opt);
                      }}
                      style={{
                        padding: "4px 10px",
                        background: "var(--success, #10b981)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✓ Confirmer
                    </button>
                  )}

                  {/* Checkbox vote — invités uniquement */}
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

              {/* Liste des votants */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "5px",
                  paddingLeft: "5px",
                }}
              >
                {invitations
                  .filter((inv) =>
                    inv.dateVote?.some(
                      (v) => new Date(v).getTime() === new Date(opt).getTime(),
                    ),
                  )
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

export default DateVotePanel;

import React, { useState } from "react";
import "./css/eventCard.css";

const EventCard = ({ event, navigate, onEdit, onDelete }) => {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isPast = new Date(event.fixedDate || event.selectedDate || event.createdAt) < new Date();
  const url = `/event/${event.shortId}`;

  const getBadgeClass = () => {
    if (event.status === "draft") return "draft";
    if (event.status === "cancelled") return "cancelled";
    if (isPast) return "past";
    if (!event.isOrganizer && event.myRsvpStatus === "pending") return "pending";
    return "confirmed";
  };

  const getBadgeLabel = () => {
    if (event.status === "draft") return "Brouillon";
    if (event.status === "cancelled") return "Annulé";
    if (isPast) return "Terminé";
    if (!event.isOrganizer && event.myRsvpStatus === "pending") return "Action requise";
    return "Confirmé";
  };

  const getEventTypeIcon = () => {
    switch (event.type) {
      case "birthday": return "🎂";
      case "party": return "🎊";
      case "dinner": return "🍽️";
      default: return "📅";
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    onDelete(event.shortId);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirm(false);
  };

  return (
    <div className="event-card" onClick={() => navigate(url)}>
      <span className={`event-card-badge ${getBadgeClass()}`}>
        {getBadgeLabel()}
      </span>

      <div className="event-card-icon">{getEventTypeIcon()}</div>

      <h3 className="event-card-title titleFont">{event.title}</h3>

      <div className="event-card-details">
        <span>
          <i className="fa-regular fa-calendar"></i>
          {event.dateMode === "fixed" && event.fixedDate
            ? new Date(event.fixedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
            : (event.selectedDate ? new Date(event.selectedDate).toLocaleDateString("fr-FR") : "Date à définir")}
        </span>
        <span>
          <i className="fa-solid fa-location-dot"></i>
          {event.locationMode === "fixed" && event.fixedLocation?.name
            ? event.fixedLocation.name
            : (event.selectedLocation?.name || "Lieu à définir")}
        </span>
        {!event.isOrganizer && event.organizer && (
          <span>
            <i className="fa-solid fa-user"></i>
            Organisé par {event.organizer.name}
          </span>
        )}
      </div>

      <div className="event-card-footer">
        <span className="event-card-role">
          {event.isOrganizer ? "Vous êtes l'organisateur" : "Vous êtes invité"}
        </span>

        <div className="event-card-actions" onClick={e => e.stopPropagation()}>
          {event.isOrganizer && onEdit && (
            <button
              className="event-card-action"
              onClick={e => { e.stopPropagation(); onEdit(event); }}
            >
              ✏️ Modifier
            </button>
          )}

          {event.isOrganizer && onDelete && (
            <>
              <button
                className={`event-card-action ${deleteConfirm ? "danger-confirm" : "danger"}`}
                onClick={handleDelete}
              >
                {deleteConfirm ? "⚠️ Confirmer" : "🗑️"}
              </button>
              {deleteConfirm && (
                <button className="event-card-action" onClick={handleCancelDelete}>✕</button>
              )}
            </>
          )}

          {!event.isOrganizer && (
            <button className="event-card-action">Voir</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import EventCountdown from "./EventCountdown";
import "./css/eventCard.css";

const EventCard = ({ event, navigate, onEdit, onDelete, index = 0 }) => {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const eventDate = event.fixedDate || event.selectedDate || null;
  const isPast = eventDate
    ? new Date(eventDate) < new Date()
    : new Date(event.createdAt) < new Date();
  const url = `/event/${event.shortId}`;

  const getBadgeClass = () => {
    if (event.status === "draft") return "draft";
    if (event.status === "cancelled") return "cancelled";
    if (isPast) return "past";
    if (!event.isOrganizer && event.myRsvpStatus === "pending")
      return "pending";
    return "confirmed";
  };

  const getBadgeLabel = () => {
    if (event.status === "draft") return "Brouillon";
    if (event.status === "cancelled") return "Annulé";
    if (isPast) return "Terminé";
    if (!event.isOrganizer && event.myRsvpStatus === "pending")
      return "Action requise";
    return "Confirmé";
  };

  const getEventTypeIcon = () => {
    switch (event.type) {
      case "birthday":
        return "🎂";
      case "party":
        return "🎊";
      case "dinner":
        return "🍽️";
      default:
        return "📅";
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    onDelete(event.shortId);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirm(false);
  };

  return (
    <motion.div
      className="event-card"
      onClick={() => navigate(url)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{
        y: -5,
        boxShadow: "var(--card-shadow-hover, 0 10px 28px rgba(0,0,0,0.28))",
      }}
      whileTap={{ scale: 0.98 }}
    >
      <span className={`event-card-badge ${getBadgeClass()}`}>
        {getBadgeLabel()}
      </span>

      <div className="event-card-icon">{getEventTypeIcon()}</div>

      <h3 className="event-card-title titleFont">{event.title}</h3>

      <div className="event-card-details">
        <span>
          <i className="fa-regular fa-calendar"></i>
          {event.dateMode === "fixed" && event.fixedDate
            ? new Date(event.fixedDate).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : event.selectedDate
              ? new Date(event.selectedDate).toLocaleDateString("fr-FR")
              : "Date à définir"}
        </span>
        <span>
          <i className="fa-solid fa-location-dot"></i>
          {event.locationMode === "fixed" && event.fixedLocation?.name
            ? event.fixedLocation.name
            : event.selectedLocation?.name || "Lieu à définir"}
        </span>
        {!event.isOrganizer && event.organizer && (
          <span>
            <i className="fa-solid fa-user"></i>
            Organisé par {event.organizer.name}
          </span>
        )}
      </div>

      {/* ── Countdown : toujours affiché, 0 si date passée ou non définie ── */}
      <EventCountdown targetDate={eventDate} />

      <div className="event-card-footer">
        <span className="event-card-role">
          {event.isOrganizer ? "Vous êtes l'organisateur" : "Vous êtes invité"}
        </span>

        <div
          className="event-card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {event.isOrganizer && onEdit && (
            <motion.button
              className="event-card-action"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(event);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✏️ Modifier
            </motion.button>
          )}

          {event.isOrganizer && onDelete && (
            <>
              <motion.button
                className={`event-card-action ${deleteConfirm ? "danger-confirm" : "danger"}`}
                onClick={handleDelete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={deleteConfirm ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                {deleteConfirm ? "⚠️ Confirmer" : "🗑️"}
              </motion.button>
              <AnimatePresence>
                {deleteConfirm && (
                  <motion.button
                    className="event-card-action"
                    onClick={handleCancelDelete}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ✕
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}

          {!event.isOrganizer && (
            <motion.button
              className="event-card-action"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Voir
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard;

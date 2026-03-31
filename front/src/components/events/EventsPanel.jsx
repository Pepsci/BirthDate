import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import EventCard from "./EventCard";
import EventForm from "./EventForm";
import "./css/eventsPanel.css";

const DESKTOP_PER_PAGE = 10;
const MOBILE_PER_PAGE = 8;
const PAGINATION_THRESHOLD = 6;

const isMobile = () => window.innerWidth <= 600;

// ─── Pagination ──────────────────────────────────────────
const SectionPagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const maxVisible = isMobile() ? 3 : 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

  return (
    <motion.div
      className="events-pagination"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        className="events-pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Précédent
      </button>

      {start > 1 && (
        <>
          <button
            className={`events-pagination-btn ${currentPage === 1 ? "active" : ""}`}
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          {start > 2 && <span className="events-pagination-ellipsis">…</span>}
        </>
      )}

      {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
        <motion.button
          key={p}
          className={`events-pagination-btn ${currentPage === p ? "active" : ""}`}
          onClick={() => onPageChange(p)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
        >
          {p}
        </motion.button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="events-pagination-ellipsis">…</span>
          )}
          <button
            className={`events-pagination-btn ${currentPage === totalPages ? "active" : ""}`}
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        className="events-pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Suivant
      </button>
    </motion.div>
  );
};

// ─── Section paginée animée ──────────────────────────────
const PaginatedSection = ({
  title,
  events,
  navigate,
  onEdit,
  onDelete,
  onLeave,
}) => {
  const [page, setPage] = useState(1);
  const perPage = isMobile() ? MOBILE_PER_PAGE : DESKTOP_PER_PAGE;
  const totalPages = Math.ceil(events.length / perPage);
  const showPagination = events.length > PAGINATION_THRESHOLD;
  const visible = showPagination
    ? events.slice((page - 1) * perPage, page * perPage)
    : events;

  if (events.length === 0) return null;

  return (
    <motion.div
      className="events-section"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <h3>{title}</h3>
      <motion.div
        className="events-grid"
        key={page}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {visible.map((evt, i) => (
          <EventCard
            key={evt._id}
            event={evt}
            navigate={navigate}
            onEdit={onEdit}
            onDelete={onDelete}
            onLeave={onLeave}
            index={i}
          />
        ))}
      </motion.div>
      {showPagination && (
        <SectionPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </motion.div>
  );
};

// ─── Panel principal ─────────────────────────────────────
const EventsPanel = ({ allDates }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadEvents = async () => {
    try {
      const response = await apiHandler.get("/events/mine");
      const organized = response.data.organized || [];
      const invited = response.data.invited || [];
      const allEvtsMap = new Map();
      organized.forEach((e) =>
        allEvtsMap.set(e._id, { ...e, isOrganizer: true }),
      );
      invited.forEach((e) => {
        if (!allEvtsMap.has(e._id))
          allEvtsMap.set(e._id, { ...e, isOrganizer: false });
      });
      const sorted = Array.from(allEvtsMap.values()).sort((a, b) => {
        const dateA = a.fixedDate || a.selectedDate || a.createdAt;
        const dateB = b.fixedDate || b.selectedDate || b.createdAt;
        return new Date(dateA) - new Date(dateB);
      });
      setEvents(sorted);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleDeleteEvent = async (shortId) => {
    try {
      await apiHandler.delete(`/events/${shortId}`);
      setEvents((prev) => prev.filter((e) => e.shortId !== shortId));
    } catch (err) {
      console.error("Error deleting event", err);
    }
  };

  const handleLeaveEvent = async (shortId) => {
    try {
      await apiHandler.delete(`/events/${shortId}/leave`);
      setEvents((prev) => prev.filter((e) => e.shortId !== shortId));
    } catch (err) {
      console.error("Error leaving event", err);
    }
  };

  const getFilteredEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter((e) => {
      const eDate = e.dateMode === "fixed" ? e.fixedDate : e.selectedDate;
      const isPast = eDate && new Date(eDate) < today;
      if (filter === "mine") return e.isOrganizer;
      if (filter === "invited") return !e.isOrganizer;
      if (filter === "upcoming") return !isPast;
      if (filter === "past") return isPast;
      if (filter === "pending")
        return !e.isOrganizer && e.myRsvpStatus === "pending";
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();
  const organized = filteredEvents.filter((e) => e.isOrganizer);
  const invited = filteredEvents.filter((e) => !e.isOrganizer);
  const flatMode = filter === "mine" || filter === "invited";

  const filters = [
    { key: "all", label: "Tous" },
    { key: "mine", label: "Mes événements" },
    { key: "invited", label: "Invitations" },
    { key: "upcoming", label: "À venir" },
    { key: "pending", label: "En attente", className: "pending" },
    { key: "past", label: "Passés" },
  ];

  return (
    <motion.div
      className="events-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="events-header">
        <h2 className="titleFont">Mes Événements</h2>
        <motion.button
          className="btn-create-event"
          onClick={() => setShowEventForm(true)}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.97 }}
        >
          + Créer un événement
        </motion.button>
      </div>

      {/* Filtres */}
      <div className="events-filters">
        {filters.map((f) => (
          <motion.button
            key={f.key}
            className={`${filter === f.key ? `active ${f.className || ""}` : ""}`}
            onClick={() => setFilter(f.key)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* Contenu */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.p
            key="loading"
            className="events-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Chargement des événements…
          </motion.p>
        ) : filteredEvents.length === 0 ? (
          <motion.div
            key="empty"
            className="no-events"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
          >
            <p>Aucun événement trouvé.</p>
            <motion.button
              className="btn-create-event btn-create-event--ghost"
              onClick={() => setShowEventForm(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              J'organise mon premier événement
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key={filter}
            className="events-lists"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {flatMode ? (
              <PaginatedSection
                title={
                  filter === "mine"
                    ? "Mes événements organisés"
                    : "Invitations reçues"
                }
                events={filteredEvents}
                navigate={navigate}
                onEdit={filter === "mine" ? setEditingEvent : undefined}
                onDelete={filter === "mine" ? handleDeleteEvent : undefined}
                onLeave={filter === "invited" ? handleLeaveEvent : undefined}
              />
            ) : (
              <>
                <PaginatedSection
                  title="Mes événements organisés"
                  events={organized}
                  navigate={navigate}
                  onEdit={setEditingEvent}
                  onDelete={handleDeleteEvent}
                />
                <PaginatedSection
                  title="Invitations reçues"
                  events={invited}
                  navigate={navigate}
                  onLeave={handleLeaveEvent}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showEventForm && (
          <EventForm
            onClose={(shortId) => {
              setShowEventForm(false);
              if (shortId) navigate(`/event/${shortId}?created=true`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEvent && (
          <EventForm
            editMode={true}
            existingEvent={editingEvent}
            onClose={(result) => {
              setEditingEvent(null);
              if (result) loadEvents();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EventsPanel;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import EventCard from "./EventCard";
import EventForm from "./EventForm";
import "./css/eventsPanel.css";

const DESKTOP_PER_PAGE = 10; // 2 lignes × 5 colonnes
const MOBILE_PER_PAGE = 8;
const PAGINATION_THRESHOLD = 6; // pagination apparaît au-delà

const isMobile = () => window.innerWidth <= 600;

// ─── Composant pagination réutilisable ──────────────────
const SectionPagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = isMobile() ? 3 : 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

  return (
    <div className="events-pagination">
      <button
        className="events-pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Précédent
      </button>

      {start > 1 && (
        <>
          <button className={`events-pagination-btn ${currentPage === 1 ? "active" : ""}`} onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className="events-pagination-ellipsis">…</span>}
        </>
      )}

      {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
        <button
          key={p}
          className={`events-pagination-btn ${currentPage === p ? "active" : ""}`}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="events-pagination-ellipsis">…</span>}
          <button className={`events-pagination-btn ${currentPage === totalPages ? "active" : ""}`} onClick={() => onPageChange(totalPages)}>{totalPages}</button>
        </>
      )}

      <button
        className="events-pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Suivant
      </button>
    </div>
  );
};

// ─── Composant section paginée ───────────────────────────
const PaginatedSection = ({ title, events, navigate, onEdit, onDelete }) => {
  const [page, setPage] = useState(1);
  const perPage = isMobile() ? MOBILE_PER_PAGE : DESKTOP_PER_PAGE;
  const totalPages = Math.ceil(events.length / perPage);
  const showPagination = events.length > PAGINATION_THRESHOLD;
  const visible = showPagination ? events.slice((page - 1) * perPage, page * perPage) : events;

  if (events.length === 0) return null;

  return (
    <div className="events-section">
      <h3>{title}</h3>
      <div className="events-grid">
        {visible.map(evt => (
          <EventCard
            key={evt._id}
            event={evt}
            navigate={navigate}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      {showPagination && (
        <SectionPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      )}
    </div>
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
      organized.forEach(e => allEvtsMap.set(e._id, { ...e, isOrganizer: true }));
      invited.forEach(e => { if (!allEvtsMap.has(e._id)) allEvtsMap.set(e._id, { ...e, isOrganizer: false }); });
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

  useEffect(() => { loadEvents(); }, []);

  const handleDeleteEvent = async (shortId) => {
    try {
      await apiHandler.delete(`/events/${shortId}`);
      setEvents(prev => prev.filter(e => e.shortId !== shortId));
    } catch (err) {
      console.error("Error deleting event", err);
    }
  };

  const getFilteredEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events.filter(e => {
      const eDate = e.dateMode === "fixed" ? e.fixedDate : e.selectedDate;
      const isPast = eDate && new Date(eDate) < today;
      if (filter === "mine") return e.isOrganizer;
      if (filter === "invited") return !e.isOrganizer;
      if (filter === "upcoming") return !isPast;
      if (filter === "past") return isPast;
      if (filter === "pending") return !e.isOrganizer && e.myRsvpStatus === "pending";
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();
  const organized = filteredEvents.filter(e => e.isOrganizer);
  const invited = filteredEvents.filter(e => !e.isOrganizer);

  // En mode filtre "mine" ou "invited", on affiche tout à plat sans section
  const flatMode = filter === "mine" || filter === "invited";

  return (
    <div className="events-panel">
      {/* Header */}
      <div className="events-header">
        <h2 className="titleFont">Mes Événements</h2>
        <button className="btn-create-event" onClick={() => setShowEventForm(true)}>
          + Créer un événement
        </button>
      </div>

      {/* Filtres */}
      <div className="events-filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tous</button>
        <button className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>Mes événements</button>
        <button className={filter === "invited" ? "active" : ""} onClick={() => setFilter("invited")}>Invitations</button>
        <button className={filter === "upcoming" ? "active" : ""} onClick={() => setFilter("upcoming")}>À venir</button>
        <button className={`${filter === "pending" ? "active pending" : ""}`} onClick={() => setFilter("pending")}>En attente</button>
        <button className={filter === "past" ? "active" : ""} onClick={() => setFilter("past")}>Passés</button>
      </div>

      {/* Contenu */}
      {loading ? (
        <p className="events-loading">Chargement des événements…</p>
      ) : filteredEvents.length === 0 ? (
        <div className="no-events">
          <p>Aucun événement trouvé.</p>
          <button className="btn-create-event btn-create-event--ghost" onClick={() => setShowEventForm(true)}>
            J'organise mon premier événement
          </button>
        </div>
      ) : flatMode ? (
        <div className="events-lists">
          <PaginatedSection
            title={filter === "mine" ? "Mes événements organisés" : "Invitations reçues"}
            events={filteredEvents}
            navigate={navigate}
            onEdit={filter === "mine" ? setEditingEvent : undefined}
            onDelete={filter === "mine" ? handleDeleteEvent : undefined}
          />
        </div>
      ) : (
        <div className="events-lists">
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
          />
        </div>
      )}

      {/* Modals */}
      {showEventForm && (
        <EventForm
          onClose={(shortId) => {
            setShowEventForm(false);
            if (shortId) navigate(`/event/${shortId}?created=true`);
          }}
        />
      )}

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
    </div>
  );
};

export default EventsPanel;
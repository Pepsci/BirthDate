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
/**
 * Date effective d'un événement : celle issue du vote si le vote est tranché,
 * sinon la date fixe. Null quand aucune n'est arrêtée (vote en cours).
 */
const effectiveDate = (e) => {
  const iso = e.selectedDate ?? e.fixedDate;
  return iso ? new Date(iso) : null;
};

/**
 * Un événement est « passé » quand plus aucune de ses dates n'est à venir.
 *
 * ⚠️ Toujours RECALCULÉ, jamais stocké. C'est ce qui permet à un événement
 * archivé de redevenir « à venir » tout seul dès qu'une date future
 * réapparaît : l'organisateur repousse un dîner qui n'a pas eu lieu, ou ajoute
 * une option à un vote périmé. Le jour où l'on stockerait un booléen
 * « archivé » en base, ce retour en arrière cesserait de fonctionner.
 *
 * Trois cas :
 *  - annulé → passé immédiatement, quelle que soit sa date : il n'aura pas lieu ;
 *  - une date arrêtée → elle décide seule ;
 *  - pas de date arrêtée mais des options au vote → passé seulement si TOUTES
 *    sont écoulées. Une seule option future suffit à le ramener à venir.
 *
 * La comparaison se fait au DÉBUT de la journée, pas à l'instant présent : un
 * dîner prévu ce soir à 19 h reste « à venir » toute la journée plutôt que de
 * basculer aux archives à 19 h 01 alors qu'il est encore en cours.
 */
const isPastEvent = (e) => {
  if (e.status === "cancelled") return true;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const d = effectiveDate(e);
  if (d) return d < startOfToday;

  const options = (e.dateOptions ?? [])
    .map((iso) => new Date(iso))
    .filter((x) => !Number.isNaN(x.getTime()));
  if (options.length === 0) return false;
  return options.every((x) => x < startOfToday);
};

const EventsPanel = ({ allDates }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  // Repliée par défaut : les événements passés s'accumulent sans fin et
  // n'appellent aucune action.
  const [showPast, setShowPast] = useState(false);
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
      // ⚠️ selectedDate PRIME sur fixedDate : c'est la date issue d'un vote
      // tranché, donc la date réelle de l'événement. L'ordre inverse triait un
      // événement déplacé sur son ancienne date.
      const sorted = Array.from(allEvtsMap.values()).sort((a, b) => {
        const dateA = effectiveDate(a) ?? new Date(a.createdAt);
        const dateB = effectiveDate(b) ?? new Date(b.createdAt);
        return dateA - dateB;
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
    return events.filter((e) => {
      const past = isPastEvent(e);
      if (filter === "mine") return e.isOrganizer;
      if (filter === "invited") return !e.isOrganizer;
      if (filter === "upcoming") return !past;
      if (filter === "past") return past;
      if (filter === "pending")
        return !e.isOrganizer && e.myRsvpStatus === "pending";
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();
  const flatMode = filter === "mine" || filter === "invited";

  // En vue « Tous », les passés sortent des deux sections et se regroupent dans
  // une troisième, repliée. Sur les autres filtres, l'utilisateur a déjà choisi
  // ce qu'il veut voir : on ne recoupe pas sa sélection.
  const splitPast = filter === "all";
  const upcoming = splitPast
    ? filteredEvents.filter((e) => !isPastEvent(e))
    : filteredEvents;
  const organized = upcoming.filter((e) => e.isOrganizer);
  const invited = upcoming.filter((e) => !e.isOrganizer);
  // Le plus récent d'abord : dans une pile d'archives, on cherche celui de la
  // semaine dernière, pas celui d'il y a deux ans.
  const pastEvents = splitPast
    ? filteredEvents
        .filter(isPastEvent)
        .sort(
          (a, b) =>
            (effectiveDate(b)?.getTime() ?? 0) -
            (effectiveDate(a)?.getTime() ?? 0),
        )
    : [];

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
                {pastEvents.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="events-past-toggle"
                      onClick={() => setShowPast((v) => !v)}
                      aria-expanded={showPast}
                    >
                      <span>🗄️ Événements passés ({pastEvents.length})</span>
                      <span>{showPast ? "▾" : "▸"}</span>
                    </button>
                    {showPast && (
                      <PaginatedSection
                        title=""
                        events={pastEvents}
                        navigate={navigate}
                        onEdit={setEditingEvent}
                        onDelete={handleDeleteEvent}
                        onLeave={handleLeaveEvent}
                      />
                    )}
                  </>
                )}
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

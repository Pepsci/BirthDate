import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import EventCard from "./EventCard";
import EventForm from "./EventForm";
import "./css/eventsPanel.css";

const EventsPanel = ({ allDates }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all', 'upcoming', 'past', 'pending'
  const [showEventForm, setShowEventForm] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await apiHandler.get("/events/mine");
        const organized = response.data.organized || [];
        const invited = response.data.invited || [];

        // Combiner et dédupliquer (si je m'invite moi-même)
        const allEvtsMap = new Map();
        organized.forEach((e) => {
          allEvtsMap.set(e._id, { ...e, isOrganizer: true });
        });
        invited.forEach((e) => {
          if (!allEvtsMap.has(e._id)) {
            allEvtsMap.set(e._id, { ...e, isOrganizer: false });
          }
        });

        // Tri par date de création ou date de l'événement si fixée
        const sorted = Array.from(allEvtsMap.values()).sort((a, b) => {
          const dateA = a.fixedDate || a.selectedDate || a.createdAt;
          const dateB = b.fixedDate || b.selectedDate || b.createdAt;
          return new Date(dateA) - new Date(dateB);
        });

        setEvents(sorted);
      } catch (error) {
        console.error("Failed to load events", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleCreateNew = () => {
    setShowEventForm(true);
  };

  const getFilteredEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter((e) => {
      const eDate = e.dateMode === "fixed" ? e.fixedDate : e.selectedDate;
      const isPast = eDate && new Date(eDate) < today;
      
      if (filter === "upcoming") return !isPast;
      if (filter === "past") return isPast;
      if (filter === "pending") return !e.isOrganizer && e.myRsvpStatus === "pending";
      
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();

  return (
    <div className="events-panel">
      <div className="events-header">
        <h2 className="titleFont">Mes Événements</h2>
        <button className="btn-create-event" onClick={handleCreateNew}>
          + Créer un événement
        </button>
      </div>

      <div className="events-filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          Tous
        </button>
        <button className={filter === "upcoming" ? "active" : ""} onClick={() => setFilter("upcoming")}>
          À venir
        </button>
        <button className={filter === "pending" ? "active pending" : ""} onClick={() => setFilter("pending")}>
          En attente de réponse
        </button>
        <button className={filter === "past" ? "active" : ""} onClick={() => setFilter("past")}>
          Passés
        </button>
      </div>

      {loading ? (
        <p>Chargement des événements...</p>
      ) : filteredEvents.length === 0 ? (
        <div className="no-events">
          <p>Aucun événement trouvé.</p>
          <button className="btn-create-event" style={{background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)'}} onClick={handleCreateNew}>
            J'organise mon premier événement
          </button>
        </div>
      ) : (
        <div className="events-lists">
          {filteredEvents.filter(e => e.isOrganizer).length > 0 && (
            <div className="events-section" style={{ marginBottom: "40px" }}>
              <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "20px", color: "var(--text-primary)" }}>Mes événements organisés</h3>
              <div className="events-grid">
                {filteredEvents.filter(e => e.isOrganizer).map((evt) => (
                  <EventCard key={evt._id} event={evt} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {filteredEvents.filter(e => !e.isOrganizer).length > 0 && (
            <div className="events-section">
              <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "20px", color: "var(--text-primary)" }}>Invitations reçues</h3>
              <div className="events-grid">
                {filteredEvents.filter(e => !e.isOrganizer).map((evt) => (
                  <EventCard key={evt._id} event={evt} navigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showEventForm && (
        <EventForm 
          onClose={(shortId) => {
            setShowEventForm(false);
            if (shortId) navigate(`/event/${shortId}?created=true`);
          }} 
        />
      )}
    </div>
  );
};

export default EventsPanel;

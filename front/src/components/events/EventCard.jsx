import React from "react";

const EventCard = ({ event, navigate }) => {
  const isPast = new Date(event.fixedDate || event.selectedDate || event.createdAt) < new Date();
  const url = `/event/${event.shortId}`;

  const getStatusBadge = () => {
    if (event.status === "draft") return <span style={{ background: "grey", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem" }}>Brouillon</span>;
    if (event.status === "cancelled") return <span style={{ background: "red", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem" }}>Annulé</span>;
    if (isPast) return <span style={{ background: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem" }}>Terminé</span>;
    if (!event.isOrganizer && event.myRsvpStatus === "pending") return <span style={{ background: "var(--danger)", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem" }}>Action requise</span>;
    return <span style={{ background: "var(--success)", color: "white", padding: "2px 6px", borderRadius: "10px", fontSize: "0.8rem" }}>Confirmé</span>;
  };

  const getEventTypeIcon = () => {
    switch(event.type) {
      case "birthday": return "🎂";
      case "party": return "🎊";
      case "dinner": return "🍽️";
      default: return "📅";
    }
  };

  return (
    <div 
      className="event-card" 
      onClick={() => navigate(url)}
      style={{ 
        background: "var(--bg-primary)", 
        border: "1px solid var(--border-color)", 
        borderRadius: "15px", 
        padding: "20px",
        cursor: "pointer",
        position: "relative",
        transition: "transform 0.2s, box-shadow 0.2s"
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ position: "absolute", top: "15px", right: "15px" }}>
        {getStatusBadge()}
      </div>

      <div style={{ fontSize: "2rem", marginBottom: "10px" }}>
        {getEventTypeIcon()}
      </div>
      
      <h3 className="titleFont" style={{ margin: "0 0 10px 0", fontSize: "1.3rem" }}>
        {event.title}
      </h3>
      
      <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "15px", display: "flex", flexDirection: "column", gap: "5px" }}>
        <span>
          <i className="fa-regular fa-calendar" style={{ marginRight: "8px" }}></i>
          {event.dateMode === "fixed" && event.fixedDate ? new Date(event.fixedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : (event.selectedDate ? new Date(event.selectedDate).toLocaleDateString("fr-FR") : "Date à définir")}
        </span>
        
        <span>
          <i className="fa-solid fa-location-dot" style={{ marginRight: "8px" }}></i>
          {event.locationMode === "fixed" && event.fixedLocation?.name ? event.fixedLocation.name : (event.selectedLocation?.name || "Lieu à définir")}
        </span>

        {!event.isOrganizer && event.organizer && (
          <span>
            <i className="fa-solid fa-user" style={{ marginRight: "8px" }}></i>
            Organisé par {event.organizer.name}
          </span>
        )}
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "15px", marginTop: "auto" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-tertiary)" }}>
          {event.isOrganizer ? "Vous êtes l'organisateur" : "Vous êtes invité"}
        </span>
        <button 
          style={{ background: "transparent", color: "var(--primary)", border: "1px solid var(--primary)", padding: "5px 12px", borderRadius: "15px", fontSize: "0.85rem", cursor: "pointer" }}
        >
          Voir
        </button>
      </div>
    </div>
  );
};

export default EventCard;

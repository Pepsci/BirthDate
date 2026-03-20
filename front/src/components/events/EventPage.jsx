import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import EventChat from "./chat/EventChat";
import RSVPButton from "./RSVPButton";
import DateVotePanel from "./DateVotePanel";
import LocationVotePanel from "./LocationVotePanel";
import GiftProposalPanel from "./GiftProposalPanel";
import InviteModal from "./InviteModal";

const EventPage = () => {
  const { shortId } = useParams();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [guestNameInput, setGuestNameInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const guestCode = sessionStorage.getItem(`event_code_${shortId}`);
        const config = guestCode ? { headers: { "X-Event-Code": guestCode } } : {};
        const res = await apiHandler.get(`/events/${shortId}`, config);
        setEvent(res.data);
      } catch (err) {
        console.error("Error fetching event", err);
        setError("Événement introuvable ou vous n'avez pas accès.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [shortId, refreshKey]);

  const handleJoinCode = async (e) => {
    e.preventDefault();
    setJoinError("");
    try {
      if (currentUser) {
         // Utilisateur connecté rejoint via code
         await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput });
         setLoading(true);
         setRefreshKey(k => k + 1);
      } else {
         // Utilisateur non connecté invité via code
         if (!guestNameInput.trim()) {
           setJoinError("Veuillez indiquer votre nom pour rejoindre l'événement.");
           return;
         }
         const res = await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput, guestName: guestNameInput });
         if (res.data && (res.data.unlockSession || res.data.invitation)) {
           // Toujours stocker le code en session pour que le GET suivant donne l'accès complet
           sessionStorage.setItem(`event_code_${shortId}`, accessCodeInput);
           setLoading(true);
           setRefreshKey(k => k + 1);
         }
      }
    } catch (err) {
      // Axios errors have err.response.data.message, raw throws have err.message
      const msg = err?.response?.data?.message || err?.message || "Code invalide";
      setJoinError(msg);
    }
  };

  if (loading) return <div className="contentCenter"><p>Chargement de l'événement...</p></div>;
  if (error || !event) return <div className="contentCenter"><p>{error}</p></div>;

  return (
    <div className="event-page" style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", background: "var(--bg-primary)", borderRadius: "10px", boxShadow: "var(--shadow-md)" }}>
      {/* Affichage d'un bandeau de succès si on vient de le créer */}
      {location.search.includes("created=true") && (
        <div style={{ padding: "15px", background: "var(--success)", color: "#fff", borderRadius: "5px", marginBottom: "20px", textAlign: "center" }}>
          ✅ Événement créé avec succès ! Partagez le code ou le lien ci-dessous.
        </div>
      )}

      <button 
        onClick={() => window.location.href = "/home"}
        style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.9rem" }}
      >
        <i className="fa-solid fa-arrow-left"></i> Retour à l'accueil
      </button>

      <header style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 className="titleFont" style={{ margin: "0 0 10px 0" }}>
          {event.title}
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Organisé par <strong>{event.organizer.name} {event.organizer.surname}</strong>
        </p>
        {event.organizer._id === currentUser?._id && (
          <button 
            onClick={() => setShowInviteModal(true)}
            style={{ marginTop: "15px", padding: "8px 15px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
          >
            + Inviter des amis
          </button>
        )}
      </header>

      <div className="event-details" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="detail-section">
          <h3><i className="fa-regular fa-calendar"></i> Date</h3>
          {event.dateMode === "fixed" && event.fixedDate ? (
            <p>{new Date(event.fixedDate).toLocaleString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          ) : (
             <p><em>En cours de décision (Vote)</em></p>
          )}
        </div>

        <div className="detail-section">
          <h3><i className="fa-solid fa-location-dot"></i> Lieu</h3>
          {!event.hasFullAccess ? (
            <p style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>📍 Masqué tant que vous n'avez pas rejoint l'événement</p>
          ) : event.locationMode === "fixed" && event.fixedLocation?.name ? (
            <p><strong>{event.fixedLocation.name}</strong><br/>{event.fixedLocation.address}</p>
          ) : (
            <p><em>En cours de décision (Vote)</em></p>
          )}
        </div>

        {event.description && (
          <div className="detail-section">
            <h3><i className="fa-solid fa-circle-info"></i> Informations</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p>
          </div>
        )}

        {event.hasFullAccess && event.organizer._id !== currentUser?._id && (
          <RSVPButton 
            shortId={shortId} 
            currentStatus={event.myRsvpStatus} 
            onStatusChange={(status) => setEvent({...event, myRsvpStatus: status})} 
          />
        )}

        {event.hasFullAccess ? (
          <>
            <div className="detail-section" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "10px" }}>
              <h3><i className="fa-solid fa-share-nodes"></i> Partager l'événement</h3>
              <p>Envoyez ce lien à vos invités :</p>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "10px" }}>
                <input type="text" readOnly value={`${window.location.origin}/event/${event.shortId}`} style={{ flex: 1, padding: "10px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }} />
                <button style={{ padding: "10px 20px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }} onClick={() => navigator.clipboard.writeText(`${window.location.origin}/event/${event.shortId}`)}>
                  Copier
                </button>
              </div>
              <p style={{ marginTop: "10px", fontSize: "0.9rem" }}>Ou utilisez le code d'accès : <strong>{event.accessCode}</strong></p>
            </div>

            <div className="chat-section" style={{ marginTop: "20px" }}>
              <h3><i className="fa-regular fa-comments"></i> Discussion de l'événement</h3>
              <EventChat shortId={event.shortId} />
            </div>

            <div className="interactive-sections" style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "30px" }}>
              {event.dateMode === "vote" && (
                <DateVotePanel 
                  shortId={shortId} 
                  options={event.dateOptions} 
                  myVotes={event.myRsvpStatus === "pending" ? [] : (event.dateVote || [])} 
                  isOrganizer={event.organizer._id === currentUser?._id}
                  invitations={event.invitations || []}
                  onVoteChange={() => setRefreshKey(k => k + 1)}
                />
              )}

              {event.locationMode === "vote" && (
                <LocationVotePanel 
                  shortId={shortId} 
                  options={event.locationOptions} 
                  myVote={event.locationVote} 
                  isOrganizer={event.organizer._id === currentUser?._id}
                  invitations={event.invitations || []}
                  onVoteChange={() => setRefreshKey(k => k + 1)}
                />
              )}

              {event.giftMode === "proposals" && (
                <GiftProposalPanel 
                  shortId={shortId} 
                  isOrganizer={event.organizer._id === currentUser?._id}
                />
              )}
            </div>
          </>
        ) : (
          <div className="restricted-access-banner" style={{ background: "var(--primary)", color: "#fff", padding: "20px", borderRadius: "10px", textAlign: "center", marginTop: "20px" }}>
            <i className="fa-solid fa-lock" style={{ fontSize: "2rem", marginBottom: "10px" }}></i>
            <h3 style={{ margin: "0 0 10px 0" }}>Événement Privé</h3>
            <p style={{ margin: "0 0 20px 0" }}>Connectez-vous ou rejoignez l'événement avec le code d'accès pour participer au chat, voter et proposer des cadeaux !</p>
            
            <form onSubmit={handleJoinCode} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px", margin: "0 auto" }}>
              {!currentUser && event.allowExternalGuests && (
                <input 
                  type="text" 
                  placeholder="Votre Nom" 
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  style={{ padding: "10px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                  required={!currentUser}
                />
              )}
              {!currentUser && !event.allowExternalGuests && (
                <p style={{ fontSize: "0.8rem", margin: 0, color: "rgba(255,255,255,0.8)" }}>Connectez-vous pour rejoindre. Les invités externes ne sont pas autorisés.</p>
              )}
              {currentUser || event.allowExternalGuests ? (
                <>
                  <input 
                    type="text" 
                    placeholder="Code d'accès" 
                    value={accessCodeInput}
                    onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                    style={{ padding: "10px", borderRadius: "5px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", textTransform: "uppercase" }}
                    required
                  />
                  {joinError && <p style={{ color: "#ffb3b3", fontSize: "0.9rem", margin: 0 }}>{joinError}</p>}
                  <button type="submit" style={{ padding: "10px", background: "var(--bg-primary)", color: "var(--primary)", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>
                    Rejoindre l'événement
                  </button>
                </>
              ) : null}
            </form>
          </div>
        )}
      </div>
      {showInviteModal && (
        <InviteModal shortId={shortId} onClose={(refresh) => {
          setShowInviteModal(false);
          if (refresh) setRefreshKey(k => k + 1);
        }} />
      )}
    </div>
  );
};

export default EventPage;

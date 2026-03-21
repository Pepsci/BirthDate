import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import socketService from "../services/socket.service";
import EventChat from "./chat/EventChat";
import EventForm from "./EventForm";
import RSVPButton from "./RSVPButton";
import DateVotePanel from "./DateVotePanel";
import LocationVotePanel from "./LocationVotePanel";
import GiftProposalPanel from "./GiftProposalPanel";
import InviteModal from "./InviteModal";

const EventPage = () => {
  const { shortId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [guestNameInput, setGuestNameInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    apiHandler.get(`/events/${shortId}/invitations`)
      .then(res => setInvitations(res.data))
      .catch(err => console.error("Error fetching invitations", err));
  }, [shortId, event?.hasFullAccess, refreshKey]);

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleRsvpUpdate = ({ shortId: sId }) => {
      if (sId !== shortId) return;
      apiHandler.get(`/events/${shortId}/invitations`)
        .then(res => setInvitations(res.data))
        .catch(console.error);
    };
    socket.on("event:rsvp_update", handleRsvpUpdate);
    return () => socket.off("event:rsvp_update", handleRsvpUpdate);
  }, [shortId, event?.hasFullAccess]);

  const handleDeleteEvent = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    try {
      await apiHandler.delete(`/events/${shortId}`);
      navigate("/home?tab=events"); // ← modifié
    } catch (err) {
      console.error("Error deleting event", err);
      setDeleteConfirm(false);
    }
  };

  const handleJoinCode = async (e) => {
    e.preventDefault();
    setJoinError("");
    try {
      if (currentUser) {
        await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput });
        setLoading(true);
        setRefreshKey(k => k + 1);
      } else {
        if (!guestNameInput.trim()) {
          setJoinError("Veuillez indiquer votre nom pour rejoindre l'événement.");
          return;
        }
        const res = await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput, guestName: guestNameInput });
        if (res.data && (res.data.unlockSession || res.data.invitation)) {
          sessionStorage.setItem(`event_code_${shortId}`, accessCodeInput);
          setLoading(true);
          setRefreshKey(k => k + 1);
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Code invalide";
      setJoinError(msg);
    }
  };

  if (loading) return <div className="contentCenter"><p>Chargement de l'événement...</p></div>;
  if (error || !event) return <div className="contentCenter"><p>{error}</p></div>;

  return (
    <div className="event-page" style={{ maxWidth: "800px", margin: "40px auto", padding: "20px", background: "var(--bg-primary)", borderRadius: "10px", boxShadow: "var(--shadow-md)" }}>
      {location.search.includes("created=true") && (
        <div style={{ padding: "15px", background: "var(--success)", color: "#fff", borderRadius: "5px", marginBottom: "20px", textAlign: "center" }}>
          ✅ Événement créé avec succès ! Partagez le code ou le lien ci-dessous.
        </div>
      )}

      <button
        onClick={() => navigate("/home?tab=events")} // ← modifié
        style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.9rem" }}
      >
        <i className="fa-solid fa-arrow-left"></i> Retour aux événements
      </button>

      <header style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "20px", marginBottom: "20px" }}>
        <h1 className="titleFont" style={{ margin: "0 0 10px 0" }}>
          {event.title}
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Organisé par <strong>{event.organizer.name} {event.organizer.surname}</strong>
        </p>
        {event.organizer._id === currentUser?._id && (
          <div style={{ display: "flex", gap: "10px", marginTop: "15px", flexWrap: "wrap" }}>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{ padding: "8px 15px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
            >
              + Inviter des amis
            </button>
            <button
              onClick={() => setShowEditForm(true)}
              style={{ padding: "8px 15px", background: "transparent", color: "var(--primary)", border: "2px solid var(--primary)", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" }}
            >
              ✏️ Modifier l'événement
            </button>
            <button
              onClick={handleDeleteEvent}
              style={{ padding: "8px 15px", background: deleteConfirm ? "var(--danger, #e74c3c)" : "transparent", color: deleteConfirm ? "#fff" : "var(--danger, #e74c3c)", border: "2px solid var(--danger, #e74c3c)", borderRadius: "15px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem", transition: "all 0.2s" }}
            >
              {deleteConfirm ? "⚠️ Confirmer la suppression" : "🗑️ Supprimer"}
            </button>
            {deleteConfirm && (
              <button
                onClick={() => setDeleteConfirm(false)}
                style={{ padding: "8px 12px", background: "transparent", border: "1px solid var(--border-color)", borderRadius: "15px", cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.85rem" }}
              >
                Annuler
              </button>
            )}
          </div>
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
            <p><strong>{event.fixedLocation.name}</strong><br />{event.fixedLocation.address}</p>
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
            onStatusChange={(status) => setEvent({ ...event, myRsvpStatus: status })}
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

            {invitations.length > 0 && (
              <div className="detail-section" style={{ background: "var(--bg-secondary)", padding: "20px", borderRadius: "10px" }}>
                <h3 style={{ marginTop: 0 }}><i className="fa-solid fa-users"></i> Participants</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 15px 0" }}>
                  <strong style={{ color: "var(--success, #27ae60)" }}>{invitations.filter(i => i.status === "accepted").length} confirmés</strong>
                  {" · "}
                  <strong style={{ color: "var(--warning, #f39c12)" }}>{invitations.filter(i => i.status === "maybe").length} peut-être</strong>
                  {" · "}
                  <strong style={{ color: "var(--text-tertiary)" }}>{invitations.filter(i => i.status === "pending").length} en attente</strong>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {invitations.map(inv => {
                    const name = inv.user
                      ? `${inv.user.name} ${inv.user.surname || ""}`.trim()
                      : inv.guestName || inv.externalEmail || "Invité externe";
                    const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                    const statusConfig = {
                      accepted: { label: "✓ Confirmé", bg: "var(--success, #27ae60)" },
                      declined: { label: "✗ Décliné", bg: "var(--danger, #e74c3c)" },
                      maybe: { label: "~ Peut-être", bg: "var(--warning, #f39c12)" },
                      pending: { label: "⏳ En attente", bg: "var(--text-tertiary, #95a5a6)" },
                    };
                    const s = statusConfig[inv.status] || statusConfig.pending;
                    return (
                      <div key={inv._id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.85rem", flexShrink: 0 }}>
                          {initials || "?"}
                        </div>
                        <span style={{ flex: 1, fontSize: "0.95rem" }}>{name}</span>
                        <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: "bold", background: s.bg, color: "#fff" }}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {showEditForm && (
        <EventForm
          editMode={true}
          existingEvent={event}
          onClose={(result) => {
            setShowEditForm(false);
            if (result) setRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
};

export default EventPage;
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
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
import "./css/eventPage.css";

// ─── Maps helpers ────────────────────────────────────────
const getMapsUrl = (location) => {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const coords = location?.coordinates;
  const hasCoords = coords?.lat && coords?.lng;
  if (hasCoords) {
    const coordStr = `${coords.lat},${coords.lng}`;
    const label = encodeURIComponent(location.name || location.address || "");
    return isIos
      ? `maps://maps.apple.com/?ll=${coordStr}&q=${label}`
      : `https://maps.google.com/?q=${coordStr}`;
  }
  const query = encodeURIComponent([location?.name, location?.address].filter(Boolean).join(", "));
  return isIos ? `maps://maps.apple.com/?q=${query}` : `https://maps.google.com/?q=${query}`;
};

const getStaticMapUrl = (location) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return null;
  const coords = location?.coordinates;
  const center = coords?.lat && coords?.lng
    ? `${coords.lat},${coords.lng}`
    : encodeURIComponent([location?.name, location?.address].filter(Boolean).join(", "));
  const marker = coords?.lat && coords?.lng ? `color:0x6C63FF|${coords.lat},${coords.lng}` : `color:0x6C63FF|${encodeURIComponent(location?.address || "")}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=16&size=640x220&scale=2&style=feature:all|element:geometry|color:0x1a1a2e&style=feature:all|element:labels.text.fill|color:0xffffff&style=feature:road|element:geometry|color:0x2d2d4e&style=feature:water|element:geometry|color:0x0f0f23&markers=size:mid|color:0x6C63FF|${marker}&key=${key}`;
};

// ─── Animations ──────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] },
});

const getEventEmoji = (type) => {
  const map = { birthday: "🎂", party: "🎊", dinner: "🍽️", other: "📅" };
  return map[type] || "📅";
};

const getStatusColor = (status, isPast) => {
  if (status === "cancelled") return "#e74c3c";
  if (isPast || status === "done") return "#636e72";
  if (status === "published") return "#27ae60";
  return "#f39c12";
};

const getStatusLabel = (status, isPast) => {
  if (status === "cancelled") return "Annulé";
  if (isPast || status === "done") return "Terminé";
  if (status === "published") return "Confirmé";
  return "Brouillon";
};

// ─── Composant card glassmorphism ────────────────────────
const GlassCard = ({ children, className = "", style = {}, ...props }) => (
  <motion.div className={`ep-glass-card ${className}`} style={style} {...props}>
    {children}
  </motion.div>
);

// ─── Composant participant ───────────────────────────────
const ParticipantRow = ({ inv }) => {
  const name = inv.user
    ? `${inv.user.name} ${inv.user.surname || ""}`.trim()
    : inv.guestName || inv.externalEmail || "Invité externe";
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const statusConfig = {
    accepted: { label: "Confirmé", color: "#27ae60" },
    declined: { label: "Décliné", color: "#e74c3c" },
    maybe: { label: "Peut-être", color: "#f39c12" },
    pending: { label: "En attente", color: "#95a5a6" },
  };
  const s = statusConfig[inv.status] || statusConfig.pending;
  return (
    <div className="ep-participant-row">
      <div className="ep-participant-avatar">{initials || "?"}</div>
      <span className="ep-participant-name">{name}</span>
      <span className="ep-participant-badge" style={{ background: s.color }}>{s.label}</span>
    </div>
  );
};

// ─── Page principale ─────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState("info");
  const [mapError, setMapError] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Map { userId → publicKey } de tous les participants connus — passé à EventChat
  // pour chiffrer les messages sortants à destination de chacun d'eux.
  const participants = useMemo(() => {
    const map = {};
    if (event?.organizer?._id && event?.organizer?.publicKey) {
      map[event.organizer._id.toString()] = event.organizer.publicKey;
    }
    invitations.forEach((inv) => {
      if (inv.user?._id && inv.user?.publicKey) {
        map[inv.user._id.toString()] = inv.user.publicKey;
      }
    });
    return map;
  }, [event?.organizer, invitations]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const guestCode = sessionStorage.getItem(`event_code_${shortId}`);
        const config = guestCode ? { headers: { "X-Event-Code": guestCode } } : {};
        const res = await apiHandler.get(`/events/${shortId}`, config);
        setEvent(res.data);
      } catch (err) {
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
      .catch(console.error);
  }, [shortId, event?.hasFullAccess, refreshKey]);

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleRsvpUpdate = ({ shortId: sId }) => {
      if (sId !== shortId) return;
      apiHandler.get(`/events/${shortId}/invitations`).then(res => setInvitations(res.data)).catch(console.error);
    };
    socket.on("event:rsvp_update", handleRsvpUpdate);
    return () => socket.off("event:rsvp_update", handleRsvpUpdate);
  }, [shortId, event?.hasFullAccess]);

  const handleDeleteEvent = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    try {
      await apiHandler.delete(`/events/${shortId}`);
      navigate("/home?tab=events");
    } catch (err) {
      setDeleteConfirm(false);
    }
  };

  const handleJoinCode = async (e) => {
    e.preventDefault();
    setJoinError("");
    try {
      if (currentUser) {
        await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput });
        setLoading(true); setRefreshKey(k => k + 1);
      } else {
        if (!guestNameInput.trim()) { setJoinError("Veuillez indiquer votre nom."); return; }
        const res = await apiHandler.post(`/events/${shortId}/join`, { code: accessCodeInput, guestName: guestNameInput });
        if (res.data && (res.data.unlockSession || res.data.invitation)) {
          sessionStorage.setItem(`event_code_${shortId}`, accessCodeInput);
          setLoading(true); setRefreshKey(k => k + 1);
        }
      }
    } catch (err) {
      setJoinError(err?.response?.data?.message || err?.message || "Code invalide");
    }
  };

  if (loading) return (
    <div className="ep-loading">
      <motion.div className="ep-loading-spinner" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
      <p>Chargement…</p>
    </div>
  );

  if (error || !event) return (
    <div className="ep-error">
      <p>{error || "Événement introuvable"}</p>
      <button onClick={() => navigate("/home?tab=events")}>← Retour</button>
    </div>
  );

  const isPast = event.fixedDate && new Date(event.fixedDate) < new Date();
  const statusColor = getStatusColor(event.status, isPast);
  const statusLabel = getStatusLabel(event.status, isPast);
  const isOrganizer = event.organizer._id === currentUser?._id;
  const hasLocation = event.locationMode === "fixed" && event.fixedLocation?.name;
  const staticMapUrl = hasLocation && event.hasFullAccess ? getStaticMapUrl(event.fixedLocation) : null;

  // Tabs disponibles
  const tabs = [
    { id: "info", label: "Infos", icon: "fa-circle-info" },
    ...(event.hasFullAccess ? [
      { id: "participants", label: `Invités${invitations.length ? ` (${invitations.length})` : ""}`, icon: "fa-users" },
      { id: "chat", label: "Discussion", icon: "fa-comments" },
      ...(event.dateMode === "vote" || event.locationMode === "vote" || event.giftMode === "proposals"
        ? [{ id: "vote", label: "Votes", icon: "fa-check-to-slot" }]
        : []),
    ] : []),
  ];

  return (
    <div className="ep-root">
      {/* ── Hero ── */}
    <div className="ep-hero" style={{ "--status-color": statusColor }}>
        {/* Bouton retour */}
        <motion.button
          className="ep-back-btn"
          onClick={() => navigate("/home?tab=events")}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
        >
          <i className="fa-solid fa-arrow-left"></i> Retour
        </motion.button>

        {/* Contenu hero */}
        <div className="ep-hero-content">
          <motion.div className="ep-hero-emoji" {...fadeUp(0.05)}>
            {getEventEmoji(event.type)}
          </motion.div>

          <motion.div className="ep-status-badge" style={{ background: statusColor }} {...fadeUp(0.1)}>
            {statusLabel}
          </motion.div>

          <motion.h1 className="ep-hero-title titleFont" {...fadeUp(0.15)}>
            {event.title}
          </motion.h1>

          <motion.p className="ep-hero-organizer" {...fadeUp(0.2)}>
            par <strong>{event.organizer.name} {event.organizer.surname}</strong>
          </motion.p>

          {/* Date + Lieu en pills */}
          <motion.div className="ep-hero-meta" {...fadeUp(0.25)}>
            <div className="ep-hero-pill">
              <i className="fa-regular fa-calendar"></i>
              <span>
                {event.dateMode === "fixed" && event.fixedDate
                  ? new Date(event.fixedDate).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                  : "Date en cours de décision"}
              </span>
            </div>
            <div className="ep-hero-pill">
              <i className="fa-solid fa-location-dot"></i>
              <span>
                {!event.hasFullAccess
                  ? "Lieu masqué"
                  : hasLocation ? event.fixedLocation.name : "Lieu en cours de décision"}
              </span>
            </div>
          </motion.div>

          {/* Succès création */}
          {location.search.includes("created=true") && (
            <motion.div className="ep-success-banner" {...fadeUp(0.3)}>
              ✅ Événement créé ! Partagez le lien ci-dessous.
            </motion.div>
          )}
        </div>

        {/* Actions organisateur dans le hero */}
        {(isOrganizer || (event.hasFullAccess && event.allowGuestInvites)) && (
          <motion.div className="ep-hero-actions" {...fadeUp(0.3)}>
            <motion.button className="ep-btn ep-btn-primary" onClick={() => setShowInviteModal(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <i className="fa-solid fa-user-plus"></i> Inviter
            </motion.button>
            {isOrganizer && (
              <>
                <motion.button className="ep-btn ep-btn-outline" onClick={() => setShowEditForm(true)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <i className="fa-solid fa-pen"></i> Modifier
                </motion.button>
                <motion.button
                  className={`ep-btn ${deleteConfirm ? "ep-btn-danger-active" : "ep-btn-danger"}`}
                  onClick={handleDeleteEvent}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                >
                  <i className="fa-solid fa-trash"></i>
                  {deleteConfirm ? "Confirmer ?" : ""}
                </motion.button>
                {deleteConfirm && (
                  <motion.button className="ep-btn ep-btn-ghost" onClick={() => setDeleteConfirm(false)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    Annuler
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* RSVP pour les invités */}
        {event.hasFullAccess && !isOrganizer && (
          <motion.div className="ep-hero-rsvp" {...fadeUp(0.35)}>
            <RSVPButton
              shortId={shortId}
              currentStatus={event.myRsvpStatus}
              onStatusChange={(status) => {
                setEvent({ ...event, myRsvpStatus: status });
                // Rafraîchit la liste des participants immédiatement
                apiHandler.get(`/events/${shortId}/invitations`)
                  .then(res => setInvitations(res.data))
                  .catch(console.error);
              }}
            />
          </motion.div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="ep-body">
        {event.hasFullAccess ? (
          <>
            {/* Tabs */}
            <motion.div className="ep-tabs" {...fadeUp(0.35)}>
              {tabs.map(tab => (
                <motion.button
                  key={tab.id}
                  className={`ep-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <i className={`fa-solid ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                </motion.button>
              ))}
            </motion.div>

            {/* Contenu tabs */}
            <AnimatePresence mode="wait">
              {/* ── Tab Infos ── */}
              {activeTab === "info" && (
                <motion.div
                  key="info"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="ep-grid">
                    {/* Card lieu + map */}
                    {hasLocation && (
                      <GlassCard className="ep-card ep-card-location" {...fadeUp(0.1)}>
                        <div className="ep-card-header">
                          <i className="fa-solid fa-location-dot ep-card-icon"></i>
                          <h3>Lieu</h3>
                        </div>
                        <p className="ep-location-name">{event.fixedLocation.name}</p>
                        {event.fixedLocation.address && (
                          <p className="ep-location-address">{event.fixedLocation.address}</p>
                        )}
                        {/* Map sur demande */}
                        {staticMapUrl && !mapError && !showMap && (
                          <motion.button
                            className="ep-map-reveal-btn"
                            onClick={() => setShowMap(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <i className="fa-solid fa-map"></i> Voir la carte
                          </motion.button>
                        )}

                        <AnimatePresence>
                          {staticMapUrl && !mapError && showMap && (
                            <motion.div
                              className="ep-map-container"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <img
                                src={staticMapUrl}
                                alt="Carte du lieu"
                                className="ep-map-img"
                                onError={() => setMapError(true)}
                              />
                              <a
                                href={getMapsUrl(event.fixedLocation)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ep-map-overlay-btn"
                              >
                                <i className="fa-solid fa-diamond-turn-right"></i>
                                {/iPad|iPhone|iPod/.test(navigator.userAgent) ? "Ouvrir dans Plans" : "Ouvrir dans Google Maps"}
                              </a>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {/* Fallback sans map */}
                        {(!staticMapUrl || mapError) && (
                          <a href={getMapsUrl(event.fixedLocation)} target="_blank" rel="noopener noreferrer" className="ep-maps-link">
                            <i className="fa-solid fa-diamond-turn-right"></i>
                            {/iPad|iPhone|iPod/.test(navigator.userAgent) ? "Ouvrir dans Plans" : "Ouvrir dans Google Maps"}
                          </a>
                        )}
                      </GlassCard>
                    )}

                    {/* Card description */}
                    {event.description && (
                      <GlassCard className="ep-card" {...fadeUp(0.15)}>
                        <div className="ep-card-header">
                          <i className="fa-solid fa-circle-info ep-card-icon"></i>
                          <h3>Informations</h3>
                        </div>
                        <p className="ep-description">{event.description}</p>
                      </GlassCard>
                    )}

                    {/* Card partage */}
                    {(isOrganizer || event.allowGuestInvites) && (
                      <GlassCard className="ep-card" {...fadeUp(0.2)}>
                        <div className="ep-card-header">
                          <i className="fa-solid fa-share-nodes ep-card-icon"></i>
                          <h3>Partager</h3>
                        </div>
                        <div className="ep-share-row">
                          <input type="text" readOnly value={`${window.location.origin}/event/${event.shortId}`} className="ep-share-input" />
                          <motion.button
                            className="ep-btn ep-btn-primary ep-btn-sm"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/event/${event.shortId}`)}
                            whileTap={{ scale: 0.95 }}
                          >
                            <i className="fa-solid fa-copy"></i>
                          </motion.button>
                        </div>
                        <p className="ep-access-code">
                          Code d'accès : <strong>{event.accessCode}</strong>
                        </p>
                      </GlassCard>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── Tab Participants ── */}
              {activeTab === "participants" && (
                <motion.div
                  key="participants"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <GlassCard className="ep-card">
                    {/* Stats */}
                    <div className="ep-stats-row">
                      <div className="ep-stat" style={{ "--stat-color": "#27ae60" }}>
                        <span className="ep-stat-num">{invitations.filter(i => i.status === "accepted").length}</span>
                        <span className="ep-stat-label">Confirmés</span>
                      </div>
                      <div className="ep-stat" style={{ "--stat-color": "#f39c12" }}>
                        <span className="ep-stat-num">{invitations.filter(i => i.status === "maybe").length}</span>
                        <span className="ep-stat-label">Peut-être</span>
                      </div>
                      <div className="ep-stat" style={{ "--stat-color": "#95a5a6" }}>
                        <span className="ep-stat-num">{invitations.filter(i => i.status === "pending").length}</span>
                        <span className="ep-stat-label">En attente</span>
                      </div>
                      <div className="ep-stat" style={{ "--stat-color": "#e74c3c" }}>
                        <span className="ep-stat-num">{invitations.filter(i => i.status === "declined").length}</span>
                        <span className="ep-stat-label">Déclinés</span>
                      </div>
                    </div>

                    {/* Liste */}
                    <div className="ep-participants-list">
                      {invitations.length === 0
                        ? <p className="ep-empty">Aucun invité pour l'instant.</p>
                        : invitations.map((inv, i) => (
                          <motion.div key={inv._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                            <ParticipantRow inv={inv} />
                          </motion.div>
                        ))
                      }
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* ── Tab Chat ── */}
              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <GlassCard className="ep-card ep-card-chat">
                    <EventChat shortId={event.shortId} participants={participants} />
                  </GlassCard>
                </motion.div>
              )}

              {/* ── Tab Votes ── */}
              {activeTab === "vote" && (
                <motion.div
                  key="vote"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="ep-grid">
                    {event.dateMode === "vote" && (
                      <GlassCard className="ep-card">
                        <DateVotePanel shortId={shortId} options={event.dateOptions} myVotes={event.myRsvpStatus === "pending" ? [] : (event.dateVote || [])} isOrganizer={isOrganizer} invitations={event.invitations || []} onVoteChange={() => setRefreshKey(k => k + 1)} />
                      </GlassCard>
                    )}
                    {event.locationMode === "vote" && (
                      <GlassCard className="ep-card">
                        <LocationVotePanel shortId={shortId} options={event.locationOptions} myVote={event.locationVote} isOrganizer={isOrganizer} invitations={event.invitations || []} onVoteChange={() => setRefreshKey(k => k + 1)} />
                      </GlassCard>
                    )}
                    {event.giftMode === "proposals" && (
                      <GlassCard className="ep-card">
                        <GiftProposalPanel shortId={shortId} isOrganizer={isOrganizer} />
                      </GlassCard>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          /* ── Accès restreint ── */
          <motion.div className="ep-restricted" {...fadeUp(0.3)}>
            <GlassCard className="ep-card ep-card-restricted">
              <div className="ep-lock-icon">🔒</div>
              <h3>Événement privé</h3>
              <p>Rejoignez l'événement avec le code d'accès pour participer.</p>

              <form onSubmit={handleJoinCode} className="ep-join-form">
                {!currentUser && event.allowExternalGuests && (
                  <input type="text" placeholder="Votre prénom" value={guestNameInput} onChange={e => setGuestNameInput(e.target.value)} className="ep-input" required />
                )}
                {!currentUser && !event.allowExternalGuests && (
                  <p className="ep-join-info">Connectez-vous pour rejoindre cet événement.</p>
                )}
                {(currentUser || event.allowExternalGuests) && (
                  <>
                    <input type="text" placeholder="Code d'accès" value={accessCodeInput} onChange={e => setAccessCodeInput(e.target.value.toUpperCase())} className="ep-input ep-input-code" required />
                    {joinError && <p className="ep-join-error">{joinError}</p>}
                    <motion.button type="submit" className="ep-btn ep-btn-primary ep-btn-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      Rejoindre l'événement
                    </motion.button>
                  </>
                )}
              </form>
            </GlassCard>
          </motion.div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showInviteModal && (
          <InviteModal shortId={shortId} onClose={(refresh) => { setShowInviteModal(false); if (refresh) setRefreshKey(k => k + 1); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditForm && (
          <EventForm editMode={true} existingEvent={event} onClose={(result) => { setShowEditForm(false); if (result) setRefreshKey(k => k + 1); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventPage;
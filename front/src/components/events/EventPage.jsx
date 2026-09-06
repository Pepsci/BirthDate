import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import socketService from "../services/socket.service";
import EventChat from "./chat/EventChat";
import Avatar from "../UI/Avatar";
import EventForm from "./EventForm";
import RSVPButton from "./RSVPButton";
import DateVotePanel from "./DateVotePanel";
import LocationVotePanel from "./LocationVotePanel";
import GiftProposalPanel from "./GiftProposalPanel";
import InviteModal from "./InviteModal";
import EventNotifPrefs from "./EventNotifPrefs";
import ChatModal from "../chat/ChatModal";
import GiftPoolManager from "./stripe/GiftPoolManager";
import GiftPoolWidget from "./stripe/GiftPoolWidget";
import BankInfoManager from "./stripe/BankInfoManager";
import PaypalManager from "./stripe/PaypalManager";
import DirectTransferViewer from "./stripe/DirectTransferViewer";
import "./css/eventPage.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const getMapsUrl = (location) => {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const coords = location?.coordinates;
  const hasCoords = coords?.lat && coords?.lng;
  if (hasCoords) {
    const coordStr = `${coords.lat},${coords.lng}`;
    const label = encodeURIComponent(location.name || location.address || "");
    return isIos
      ? `maps://maps.apple.com/?ll=${coordStr}&q=${label}`
      : `https://maps.google.com/?q=${coordStr}`;
  }
  const query = encodeURIComponent(
    [location?.name, location?.address].filter(Boolean).join(", "),
  );
  return isIos
    ? `maps://maps.apple.com/?q=${query}`
    : `https://maps.google.com/?q=${query}`;
};

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

const GlassCard = ({ children, className = "", style = {}, ...props }) => (
  <motion.div className={`ep-glass-card ${className}`} style={style} {...props}>
    {children}
  </motion.div>
);

const ParticipantRow = ({ inv, isOrganizer, onRemove }) => {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const name = inv.user
    ? `${inv.user.name} ${inv.user.surname || ""}`.trim()
    : inv.guestName || inv.externalEmail || "Invité externe";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const statusConfig = {
    accepted: { label: "Confirmé", color: "#27ae60" },
    declined: { label: "Décliné", color: "#e74c3c" },
    maybe: { label: "Peut-être", color: "#f39c12" },
    pending: { label: "En attente", color: "#95a5a6" },
  };
  const s = statusConfig[inv.status] || statusConfig.pending;

  return (
    <div className="ep-participant-row">
      <Avatar
        src={inv.user?.avatar}
        name={inv.user?.name || name}
        surname={inv.user?.surname || ""}
        size="sm"
      />
      <span className="ep-participant-name">{name}</span>
      <span className="ep-participant-badge" style={{ background: s.color }}>
        {s.label}
      </span>
      {isOrganizer && onRemove && (
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {confirmRemove ? (
            <>
              <button
                onClick={() => onRemove(inv._id)}
                style={{
                  padding: "3px 8px",
                  background: "var(--danger, #e74c3c)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                }}
              >
                Confirmer
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                style={{
                  padding: "3px 8px",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              style={{
                padding: "3px 8px",
                background: "transparent",
                color: "var(--danger, #e74c3c)",
                border: "1px solid var(--danger, #e74c3c)",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              Retirer
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const LeafletMap = ({ coords, locationName }) => (
  <MapContainer
    center={coords}
    zoom={15}
    style={{ height: "220px", width: "100%", borderRadius: "12px" }}
    scrollWheelZoom={false}
  >
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    />
    <Marker position={coords}>
      <Popup>{locationName}</Popup>
    </Marker>
  </MapContainer>
);

const EventPage = () => {
  const { shortId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const guestToken = localStorage.getItem(`guestToken_${shortId}`);

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
  const [myDateVotes, setMyDateVotes] = useState([]);
  const [showChatModal, setShowChatModal] = useState(false);
  // Coordonnées retrouvées par géocodage quand le lieu n'en a pas d'enregistrées
  const [geoCoords, setGeoCoords] = useState(null);
  // Annulation
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  // Transfert d'organisation
  const [showTransferPicker, setShowTransferPicker] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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

  const fetchInvitations = (headers = {}) => {
    return apiHandler
      .get(`/events/${shortId}/invitations`, { headers })
      .then((res) => {
        setInvitations(res.data);
        const guestName = localStorage.getItem(`guestName_${shortId}`);
        const myInvitation = res.data.find((inv) =>
          currentUser
            ? inv.user?._id === currentUser._id
            : inv.guestName === guestName,
        );
        setMyDateVotes(myInvitation?.dateVote || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const headers = {};
        const storedGuestToken = localStorage.getItem(`guestToken_${shortId}`);
        if (storedGuestToken) {
          headers["x-guest-token"] = storedGuestToken;
        } else {
          const guestCode = sessionStorage.getItem(`event_code_${shortId}`);
          if (guestCode) headers["X-Event-Code"] = guestCode;
        }
        const res = await apiHandler.get(`/events/${shortId}`, { headers });
        setEvent(res.data);
      } catch {
        setError("Événement introuvable ou vous n'avez pas accès.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [shortId, refreshKey]);

  // Géocodage de secours : si le lieu fixe n'a pas de coordonnées enregistrées
  // (adresse saisie en texte libre), on les retrouve via Nominatim (OSM, gratuit)
  // pour pouvoir afficher la carte Leaflet.
  useEffect(() => {
    setGeoCoords(null);
    const loc = event?.fixedLocation;
    if (
      !event?.hasFullAccess ||
      event?.locationMode !== "fixed" ||
      !loc?.name
    )
      return;
    if (loc?.coordinates?.lat && loc?.coordinates?.lng) return; // déjà des coords
    const query = [loc.name, loc.address].filter(Boolean).join(", ");
    if (!query) return;

    let active = true;
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        query,
      )}`,
      { headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (active && data?.[0]?.lat && data?.[0]?.lon) {
          setGeoCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [event?.fixedLocation, event?.hasFullAccess, event?.locationMode]);

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const headers = guestToken ? { "x-guest-token": guestToken } : {};
    fetchInvitations(headers);
  }, [shortId, event?.hasFullAccess, refreshKey]);

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleRsvpUpdate = ({ shortId: sId }) => {
      if (sId !== shortId) return;
      const headers = guestToken ? { "x-guest-token": guestToken } : {};
      fetchInvitations(headers);
    };
    socket.on("event:rsvp_update", handleRsvpUpdate);
    return () => socket.off("event:rsvp_update", handleRsvpUpdate);
  }, [shortId, event?.hasFullAccess]);

  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const socket = socketService.getSocket();
    if (!socket) return;
    const handleTransferUpdate = ({ shortId: sId }) => {
      console.log("🔔 transfer_update reçu", sId, shortId);
      if (sId === shortId) setRefreshKey((k) => k + 1);
    };
    socket.on("event:transfer_update", handleTransferUpdate);
    return () => socket.off("event:transfer_update", handleTransferUpdate);
  }, [shortId, event?.hasFullAccess]);

  // Rejoindre la room de l'événement dès qu'on a accès (pour tout le temps réel :
  // cagnotte, virements, etc.) — indépendamment de l'onglet Discussion.
  useEffect(() => {
    if (!event?.hasFullAccess) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    socketService.emit("event:join", { shortId });

    return () => {
      socketService.emit("event:leave", { shortId });
    };
  }, [shortId, event?.hasFullAccess]);

  const handleDeleteEvent = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    try {
      await apiHandler.delete(`/events/${shortId}`);
      navigate("/home?tab=events");
    } catch {
      setDeleteConfirm(false);
    }
  };

  const handleCancelEvent = async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    try {
      const res = await apiHandler.post(`/events/${shortId}/cancel`, {
        reason: cancelReason.trim(),
      });
      setShowCancelForm(false);
      setCancelReason("");
      setRefreshKey((k) => k + 1);
      if (res.data?.poolFrozen) {
        window.alert(
          "Événement annulé. La cagnotte est fermée : plus aucune contribution ne peut arriver. Les sommes déjà versées ne sont pas remboursées automatiquement — tu peux le faire depuis l'onglet Cagnotte.",
        );
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible d'annuler l'événement.",
      );
    } finally {
      setCancelBusy(false);
    }
  };

  const handleUncancelEvent = async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    try {
      await apiHandler.post(`/events/${shortId}/uncancel`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible de rétablir l'événement.",
      );
    } finally {
      setCancelBusy(false);
    }
  };

  const handleOfferTransfer = async (userId, name) => {
    if (transferBusy) return;
    setTransferBusy(true);
    try {
      const res = await apiHandler.post(`/events/${shortId}/transfer-lead`, {
        userId,
      });
      setShowTransferPicker(false);
      setRefreshKey((k) => k + 1);
      const pool = res.data?.pool;
      window.alert(
        pool?.count > 0
          ? `Proposition envoyée à ${name}. Attention : la cagnotte ne suivra pas — les ${(pool.total / 100).toFixed(2)} € déjà versés resteront sur ton compte Stripe, et c'est à toi de les rembourser ou de les reverser.`
          : `Proposition envoyée à ${name}. Tant qu'elle n'a pas accepté, tu restes l'organisateur.`,
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible de proposer le transfert.",
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const handleWithdrawTransfer = async () => {
    if (transferBusy) return;
    setTransferBusy(true);
    try {
      await apiHandler.delete(`/events/${shortId}/transfer-lead`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Erreur.");
    } finally {
      setTransferBusy(false);
    }
  };

  const handleAcceptTransfer = async () => {
    if (transferBusy) return;
    if (
      !window.confirm(
        "Reprendre l'organisation ?\n\nTu deviendras responsable des invitations, des votes et de l'organisation. La cagnotte de l'organisateur actuel sera fermée : les sommes déjà versées restent sur son compte, tu pourras ouvrir la tienne ensuite.",
      )
    )
      return;
    setTransferBusy(true);
    try {
      await apiHandler.post(`/events/${shortId}/transfer-lead/accept`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible d'accepter le transfert.",
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const handleRemoveInvitation = async (invitationId) => {
    try {
      await apiHandler.delete(`/events/${shortId}/invitations/${invitationId}`);
      setInvitations((prev) => prev.filter((inv) => inv._id !== invitationId));
    } catch (err) {
      console.error("Error removing invitation", err);
    }
  };

  const handleJoinCode = async (e) => {
    e.preventDefault();
    setJoinError("");
    try {
      if (currentUser) {
        await apiHandler.post(`/events/${shortId}/join`, {
          code: accessCodeInput,
        });
        setLoading(true);
        setRefreshKey((k) => k + 1);
      } else {
        if (!guestNameInput.trim()) {
          setJoinError("Veuillez indiquer votre nom.");
          return;
        }
        const res = await apiHandler.post(`/events/${shortId}/join`, {
          code: accessCodeInput,
          guestName: guestNameInput,
        });
        if (res.data && (res.data.unlockSession || res.data.invitation)) {
          sessionStorage.setItem(`event_code_${shortId}`, accessCodeInput);
          if (res.data.guestToken) {
            localStorage.setItem(`guestToken_${shortId}`, res.data.guestToken);
            localStorage.setItem(`guestName_${shortId}`, guestNameInput);
          }
          setLoading(true);
          setRefreshKey((k) => k + 1);
        }
      }
    } catch (err) {
      setJoinError(
        err?.response?.data?.message || err?.message || "Code invalide",
      );
    }
  };

  if (loading)
    return (
      <div className="ep-loading">
        <motion.div
          className="ep-loading-spinner"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        <p>Chargement…</p>
      </div>
    );

  if (error || !event)
    return (
      <div className="ep-error">
        <p>{error || "Événement introuvable"}</p>
        <button onClick={() => navigate("/home?tab=events")}>← Retour</button>
      </div>
    );

  const isPast = event.fixedDate && new Date(event.fixedDate) < new Date();
  const statusColor = getStatusColor(event.status, isPast);
  const statusLabel = getStatusLabel(event.status, isPast);
  const isOrganizer = event.organizer._id === currentUser?._id;
  const hasLocation =
    event.locationMode === "fixed" && event.fixedLocation?.name;
  const storedCoords =
    hasLocation &&
    event.hasFullAccess &&
    event.fixedLocation?.coordinates?.lat &&
    event.fixedLocation?.coordinates?.lng
      ? [
          event.fixedLocation.coordinates.lat,
          event.fixedLocation.coordinates.lng,
        ]
      : null;
  // Coords enregistrées, sinon celles retrouvées par géocodage
  const locationCoords =
    storedCoords || (hasLocation && event.hasFullAccess ? geoCoords : null);
  const hasGifts = event.giftMode && event.giftMode !== "none";

  const tabs = [
    { id: "info", label: "Infos", icon: "fa-circle-info" },
    ...(event.hasFullAccess
      ? [
          {
            id: "participants",
            label: `Invités${invitations.length ? ` (${invitations.length})` : ""}`,
            icon: "fa-users",
          },
          { id: "chat", label: "Discussion", icon: "fa-comments" },
          ...(hasGifts
            ? [{ id: "cadeaux", label: "Cadeaux", icon: "fa-gift" }]
            : []),
          ...(isOrganizer || event.giftPool?.active
            ? [{ id: "cagnotte", label: "Cagnotte", icon: "fa-piggy-bank" }]
            : []),
          ...(event.dateMode === "vote" || event.locationMode === "vote"
            ? [{ id: "vote", label: "Votes", icon: "fa-check-to-slot" }]
            : []),
          ...(isOrganizer
            ? [{ id: "notifications", label: "Notifs", icon: "fa-bell" }]
            : []),
        ]
      : []),
  ];

  return (
    <div className="ep-root">
      <div className="ep-hero" style={{ "--status-color": statusColor }}>
        <motion.button
          className="ep-back-btn"
          onClick={() => navigate("/home?tab=events")}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
        >
          <i className="fa-solid fa-arrow-left"></i> Retour
        </motion.button>

        <div className="ep-hero-content">
          <motion.div className="ep-hero-emoji" {...fadeUp(0.05)}>
            {getEventEmoji(event.type)}
          </motion.div>
          <motion.div
            className="ep-status-badge"
            style={{ background: statusColor }}
            {...fadeUp(0.1)}
          >
            {statusLabel}
          </motion.div>
          <motion.h1 className="ep-hero-title titleFont" {...fadeUp(0.15)}>
            {event.title}
          </motion.h1>
          <motion.p className="ep-hero-organizer" {...fadeUp(0.2)}>
            par{" "}
            <strong>
              {event.organizer.name} {event.organizer.surname}
            </strong>
          </motion.p>

          <motion.div className="ep-hero-meta" {...fadeUp(0.25)}>
            <div className="ep-hero-pill">
              <i className="fa-regular fa-calendar"></i>
              <span>
                {event.dateMode === "fixed" && event.fixedDate
                  ? new Date(event.fixedDate).toLocaleString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Date en cours de décision"}
              </span>
            </div>
            <div className="ep-hero-pill">
              <i className="fa-solid fa-location-dot"></i>
              <span>
                {!event.hasFullAccess
                  ? "Lieu masqué"
                  : hasLocation
                    ? event.fixedLocation.name
                    : "Lieu en cours de décision"}
              </span>
            </div>
          </motion.div>

          {location.search.includes("created=true") && (
            <motion.div className="ep-success-banner" {...fadeUp(0.3)}>
              ✅ Événement créé ! Partagez le lien ci-dessous.
            </motion.div>
          )}

          {/* Annulation : l'information qui conditionne la lecture de toute la
              page, donc placée dans le hero et non dans un onglet. L'événement
              n'est pas supprimé — les invités doivent pouvoir comprendre ce
              qui s'est passé. */}
          {event.status === "cancelled" && (
            <motion.div className="ep-cancelled-banner" {...fadeUp(0.3)}>
              <strong>❌ Événement annulé</strong>
              <span>
                {event.cancellationReason
                  ? event.cancellationReason
                  : "L'organisateur n'a pas indiqué de raison."}
              </span>
              <em>
                La page reste consultable, mais l'événement n'aura pas lieu. Si
                vous l'aviez ajouté à votre agenda, pensez à l'y supprimer.
              </em>
            </motion.div>
          )}

          {/* Proposition de transfert adressée à l'utilisateur courant. */}
          {event.pendingTransfer?.toUser?._id === currentUser?._id && (
            <motion.div className="ep-transfer-banner" {...fadeUp(0.3)}>
              <strong>🤝 On vous propose d'organiser</strong>
              <span>
                {event.pendingTransfer?.requestedBy?.name ||
                  "L'organisateur"}{" "}
                vous propose de reprendre l'organisation de « {event.title} ».
                Une éventuelle cagnotte ne suit pas : les sommes déjà versées
                restent sur le compte de l'organisateur actuel.
              </span>
              <div className="ep-transfer-banner-actions">
                <button
                  className="ep-btn ep-btn-primary"
                  disabled={transferBusy}
                  onClick={handleAcceptTransfer}
                >
                  ✅ Accepter
                </button>
                <button
                  className="ep-btn ep-btn-ghost"
                  disabled={transferBusy}
                  onClick={handleWithdrawTransfer}
                >
                  Refuser
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {(isOrganizer || (event.hasFullAccess && event.allowGuestInvites)) && (
          <motion.div className="ep-hero-actions" {...fadeUp(0.3)}>
            <motion.button
              className="ep-btn ep-btn-primary"
              onClick={() => setShowInviteModal(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <i className="fa-solid fa-user-plus"></i> Inviter
            </motion.button>
            {isOrganizer && (
              <>
                <motion.button
                  className="ep-btn ep-btn-outline"
                  onClick={() => setShowEditForm(true)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <i className="fa-solid fa-pen"></i> Modifier
                </motion.button>
                {/* Transfert d'organisation : proposition, jamais imposition.
                    Tant que la personne n'a pas accepté, rien ne change. */}
                {event.status !== "cancelled" &&
                  (event.pendingTransfer?.toUser ? (
                    <motion.button
                      className="ep-btn ep-btn-outline"
                      disabled={transferBusy}
                      onClick={handleWithdrawTransfer}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      ⏳ En attente de {event.pendingTransfer.toUser.name} —
                      retirer
                    </motion.button>
                  ) : (
                    <motion.button
                      className="ep-btn ep-btn-outline"
                      onClick={() => setShowTransferPicker((v) => !v)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      🤝 Transférer
                    </motion.button>
                  ))}

                {/* Annuler puis supprimer. Le serveur refuse désormais de
                    supprimer un événement publié sans passer par l'annulation,
                    pour que les invités soient prévenus au lieu de le voir
                    disparaître : l'ordre des boutons suit ce chemin. */}
                {event.status === "cancelled" ? (
                  <motion.button
                    className="ep-btn ep-btn-outline"
                    disabled={cancelBusy}
                    onClick={handleUncancelEvent}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    ↩️ Rétablir
                  </motion.button>
                ) : (
                  <motion.button
                    className="ep-btn ep-btn-danger"
                    onClick={() => setShowCancelForm((v) => !v)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <i className="fa-solid fa-ban"></i> Annuler
                  </motion.button>
                )}

                {(event.status === "cancelled" ||
                  event.status === "draft") && (
                  <motion.button
                    className={`ep-btn ${deleteConfirm ? "ep-btn-danger-active" : "ep-btn-danger"}`}
                    onClick={handleDeleteEvent}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {deleteConfirm ? (
                      "Confirmer ?"
                    ) : (
                      <>
                        <i className="fa-solid fa-trash"></i> Supprimer
                      </>
                    )}
                  </motion.button>
                )}
                {deleteConfirm && (
                  <motion.button
                    className="ep-btn ep-btn-ghost"
                    onClick={() => setDeleteConfirm(false)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    Annuler
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Formulaire d'annulation. Le motif est FACULTATIF : forcer une
            justification pousse à écrire n'importe quoi, et un motif inventé
            vaut moins qu'une absence assumée — le message dit alors simplement
            que l'organisateur n'en a pas donné. */}
        {isOrganizer && showCancelForm && event.status !== "cancelled" && (
          <motion.div className="ep-cancel-form" {...fadeUp(0.35)}>
            <p className="ep-cancel-form-hint">
              Tous les invités seront prévenus par notification et par email.
              L'événement restera consultable, barré, avec votre motif. Vous
              pourrez le rétablir ou le supprimer ensuite.
              {event.giftPoolEnabled
                ? " La cagnotte sera fermée : plus aucune contribution ne pourra arriver. Les sommes déjà versées ne sont pas remboursées automatiquement."
                : ""}
            </p>
            <textarea
              className="ep-cancel-textarea"
              placeholder="Motif (facultatif) — ex : salle indisponible"
              maxLength={500}
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="ep-cancel-form-actions">
              <button
                className="ep-btn ep-btn-danger"
                disabled={cancelBusy}
                onClick={handleCancelEvent}
              >
                {cancelBusy ? "Annulation…" : "❌ Confirmer l'annulation"}
              </button>
              <button
                className="ep-btn ep-btn-ghost"
                onClick={() => setShowCancelForm(false)}
              >
                Revenir
              </button>
            </div>
          </motion.div>
        )}

        {/* Choix du repreneur : uniquement les participants AYANT CONFIRMÉ.
            Le serveur refuse les autres, et proposer l'organisation à quelqu'un
            qui a décliné — ou à un invité sans compte, qui n'a pas de session
            pour accepter — n'a pas de sens. */}
        {isOrganizer && showTransferPicker && !event.pendingTransfer?.toUser && (
          <motion.div className="ep-cancel-form" {...fadeUp(0.35)}>
            <p className="ep-cancel-form-hint">
              La personne choisie devra accepter. Tant qu'elle n'a pas répondu,
              vous restez l'organisateur. La cagnotte ne suivra pas : les sommes
              déjà versées restent sur votre compte Stripe.
            </p>
            {(() => {
              const eligible = invitations.filter(
                (inv) =>
                  inv.user &&
                  inv.status === "accepted" &&
                  inv.user._id !== currentUser?._id,
              );
              if (eligible.length === 0) {
                return (
                  <p className="ep-cancel-form-hint">
                    Personne n'a encore confirmé sa présence : il n'y a personne
                    à qui transférer pour l'instant.
                  </p>
                );
              }
              return (
                <ul className="ep-transfer-list">
                  {eligible.map((inv) => (
                    <li key={inv._id}>
                      <span>
                        {inv.user.name} {inv.user.surname}
                      </span>
                      <button
                        className="ep-btn ep-btn-outline"
                        disabled={transferBusy}
                        onClick={() =>
                          handleOfferTransfer(inv.user._id, inv.user.name)
                        }
                      >
                        Proposer →
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </motion.div>
        )}

        {event.hasFullAccess && !isOrganizer && (
          <motion.div className="ep-hero-rsvp" {...fadeUp(0.35)}>
            <RSVPButton
              shortId={shortId}
              currentStatus={event.myRsvpStatus}
              onStatusChange={(status) => {
                setEvent({ ...event, myRsvpStatus: status });
                const headers = guestToken
                  ? { "x-guest-token": guestToken }
                  : {};
                fetchInvitations(headers);
              }}
            />
          </motion.div>
        )}
      </div>

      <div className="ep-body">
        {event.hasFullAccess ? (
          <>
            <motion.div className="ep-tabs" {...fadeUp(0.35)}>
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  className={`ep-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => {
                    if (tab.id === "chat" && window.innerWidth <= 768) {
                      setShowChatModal(true);
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <i className={`fa-solid ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                </motion.button>
              ))}
            </motion.div>

            <AnimatePresence mode="wait">
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
                    {hasLocation && (
                      <GlassCard
                        className="ep-card ep-card-location"
                        {...fadeUp(0.1)}
                      >
                        <div className="ep-card-header">
                          <i className="fa-solid fa-location-dot ep-card-icon"></i>
                          <h3>Lieu</h3>
                        </div>
                        <p className="ep-location-name">
                          {event.fixedLocation.name}
                        </p>
                        {event.fixedLocation.address && (
                          <p className="ep-location-address">
                            {event.fixedLocation.address}
                          </p>
                        )}
                        {locationCoords && (
                          <div className="ep-map-container">
                            <LeafletMap
                              coords={locationCoords}
                              locationName={event.fixedLocation.name}
                            />
                          </div>
                        )}

                        {/* Bouton d'itinéraire — sous la carte */}
                        <a
                          href={getMapsUrl(event.fixedLocation)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ep-maps-link"
                        >
                          <i className="fa-solid fa-diamond-turn-right"></i>
                          {/iPad|iPhone|iPod/.test(navigator.userAgent)
                            ? "Ouvrir dans Plans"
                            : "Ouvrir dans Google Maps"}
                        </a>
                      </GlassCard>
                    )}
                    {event.description && (
                      <GlassCard className="ep-card" {...fadeUp(0.15)}>
                        <div className="ep-card-header">
                          <i className="fa-solid fa-circle-info ep-card-icon"></i>
                          <h3>Informations</h3>
                        </div>
                        <p className="ep-description">{event.description}</p>
                      </GlassCard>
                    )}
                    {(isOrganizer || event.allowGuestInvites) && (
                      <GlassCard className="ep-card" {...fadeUp(0.2)}>
                        <div className="ep-card-header">
                          <i className="fa-solid fa-share-nodes ep-card-icon"></i>
                          <h3>Partager</h3>
                        </div>
                        <div className="ep-share-row">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/event/${event.shortId}`}
                            className="ep-share-input"
                          />
                          <motion.button
                            className="ep-btn ep-btn-primary ep-btn-sm"
                            onClick={() =>
                              navigator.clipboard.writeText(
                                `${window.location.origin}/event/${event.shortId}`,
                              )
                            }
                            whileTap={{ scale: 0.95 }}
                          >
                            <i className="fa-solid fa-copy"></i>
                          </motion.button>
                        </div>
                        {/* Copier le code seul : le bouton du dessus copie le
                            lien complet, alors qu'on veut souvent juste coller
                            le code dans une conversation déjà ouverte. */}
                        <p className="ep-access-code">
                          Code d'accès : <strong>{event.accessCode}</strong>
                          <motion.button
                            type="button"
                            className="ep-btn ep-btn-outline ep-btn-sm ep-copy-code"
                            onClick={() => {
                              navigator.clipboard.writeText(event.accessCode);
                              setCodeCopied(true);
                              setTimeout(() => setCodeCopied(false), 2000);
                            }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {codeCopied ? "✓ Copié" : "📋 Copier le code"}
                          </motion.button>
                        </p>
                      </GlassCard>
                    )}
                  </div>
                </motion.div>
              )}
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
                    <div className="ep-stats-row">
                      <div
                        className="ep-stat"
                        style={{ "--stat-color": "#27ae60" }}
                      >
                        <span className="ep-stat-num">
                          {
                            invitations.filter((i) => i.status === "accepted")
                              .length
                          }
                        </span>
                        <span className="ep-stat-label">Confirmés</span>
                      </div>
                      <div
                        className="ep-stat"
                        style={{ "--stat-color": "#f39c12" }}
                      >
                        <span className="ep-stat-num">
                          {
                            invitations.filter((i) => i.status === "maybe")
                              .length
                          }
                        </span>
                        <span className="ep-stat-label">Peut-être</span>
                      </div>
                      <div
                        className="ep-stat"
                        style={{ "--stat-color": "#95a5a6" }}
                      >
                        <span className="ep-stat-num">
                          {
                            invitations.filter((i) => i.status === "pending")
                              .length
                          }
                        </span>
                        <span className="ep-stat-label">En attente</span>
                      </div>
                      <div
                        className="ep-stat"
                        style={{ "--stat-color": "#e74c3c" }}
                      >
                        <span className="ep-stat-num">
                          {
                            invitations.filter((i) => i.status === "declined")
                              .length
                          }
                        </span>
                        <span className="ep-stat-label">Déclinés</span>
                      </div>
                    </div>
                    <div className="ep-participants-list">
                      {invitations.length === 0 ? (
                        <p className="ep-empty">Aucun invité pour l'instant.</p>
                      ) : (
                        invitations.map((inv, i) => (
                          <motion.div
                            key={inv._id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <ParticipantRow
                              inv={inv}
                              isOrganizer={isOrganizer}
                              onRemove={handleRemoveInvitation}
                            />
                          </motion.div>
                        ))
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
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
                    <EventChat
                      shortId={event.shortId}
                      participants={participants}
                    />
                  </GlassCard>
                </motion.div>
              )}
              {activeTab === "cadeaux" && (
                <motion.div
                  key="cadeaux"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  {event.giftMode === "imposed" &&
                    event.imposedGifts?.length > 0 && (
                      <GlassCard className="ep-card">
                        <div className="ep-card-header">
                          <i className="fa-solid fa-gift ep-card-icon"></i>
                          <h3>Idées cadeaux</h3>
                        </div>
                        <ul className="ep-gift-list">
                          {event.imposedGifts.map((gift, i) => (
                            <li key={i} className="ep-gift-item">
                              <span className="ep-gift-name">{gift.name}</span>
                              {gift.price && (
                                <span className="ep-gift-price">
                                  {gift.price} €
                                </span>
                              )}
                              {gift.url && (
                                <a
                                  href={gift.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ep-gift-link"
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </GlassCard>
                    )}
                  {event.giftMode === "proposals" && (
                    <GlassCard className="ep-card">
                      <GiftProposalPanel
                        shortId={shortId}
                        isOrganizer={isOrganizer}
                        maxGiftProposalsPerUser={
                          event.maxGiftProposalsPerUser || null
                        }
                      />
                    </GlassCard>
                  )}
                </motion.div>
              )}

              {activeTab === "cagnotte" && (
                <motion.div
                  key="cagnotte"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  {event.giftPool?.active && (
                    <button
                      className="ep-share-pool-btn"
                      onClick={() => {
                        const url = `${window.location.origin}/pool/${shortId}`;
                        if (navigator.share) {
                          navigator
                            .share({
                              title: `Cagnotte — ${event.title}`,
                              url,
                            })
                            .catch(() => {});
                        } else {
                          navigator.clipboard?.writeText(url);
                          alert("Lien de la cagnotte copié :\n" + url);
                        }
                      }}
                    >
                      <i className="fa-solid fa-share-nodes"></i> Partager la
                      cagnotte
                    </button>
                  )}
                  {isOrganizer ? (
                    <>
                      <GlassCard className="ep-card">
                        <div className="ep-card-header">
                          <i className="fa-solid fa-piggy-bank ep-card-icon"></i>
                          <h3>Gérer la cagnotte</h3>
                        </div>
                        <GiftPoolManager
                          shortId={shortId}
                          pool={event.giftPool}
                          onUpdated={() => setRefreshKey((k) => k + 1)}
                        />
                      </GlassCard>
                      {event.giftPool?.active && (
                        <GlassCard className="ep-card">
                          <GiftPoolWidget
                            shortId={shortId}
                            isOrganizer={true}
                          />
                        </GlassCard>
                      )}
                      <GlassCard className="ep-card">
                        <div className="ep-card-header">
                          <i className="fa-solid fa-building-columns ep-card-icon"></i>
                          <h3>Virement direct (RIB)</h3>
                        </div>
                        <BankInfoManager
                          shortId={shortId}
                          ibanEnabled={event.directTransfer?.ibanEnabled}
                        />
                      </GlassCard>
                      <GlassCard className="ep-card">
                        <div className="ep-card-header">
                          <i className="fa-brands fa-paypal ep-card-icon"></i>
                          <h3>Paiement PayPal</h3>
                        </div>
                        <PaypalManager
                          shortId={shortId}
                          paypalEnabled={event.directTransfer?.paypalEnabled}
                          paypalLink={event.directTransfer?.paypalLink}
                        />
                      </GlassCard>
                    </>
                  ) : (
                    <>
                      <GlassCard className="ep-card">
                        <GiftPoolWidget shortId={shortId} isOrganizer={false} />
                      </GlassCard>
                      {currentUser &&
                        (event.directTransfer?.ibanEnabled ||
                          event.directTransfer?.paypalEnabled) && (
                          <GlassCard className="ep-card">
                            <div className="ep-card-header">
                              <i className="fa-solid fa-money-bill-transfer ep-card-icon"></i>
                              <h3>Autres moyens de participer</h3>
                            </div>
                            <DirectTransferViewer
                              shortId={shortId}
                              directTransfer={event.directTransfer}
                            />
                          </GlassCard>
                        )}
                    </>
                  )}
                </motion.div>
              )}

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
                        <DateVotePanel
                          shortId={shortId}
                          options={event.dateOptions}
                          myVotes={myDateVotes}
                          isOrganizer={isOrganizer}
                          invitations={invitations}
                          onVoteChange={(newVotes) => setMyDateVotes(newVotes)}
                          onRefresh={() => {
                            const headers = guestToken
                              ? { "x-guest-token": guestToken }
                              : {};
                            fetchInvitations(headers);
                          }}
                          onConfirmDate={async (date) => {
                            try {
                              await apiHandler.put(`/events/${shortId}`, {
                                selectedDate: date,
                                dateMode: "fixed",
                                fixedDate: date,
                              });
                              setRefreshKey((k) => k + 1);
                            } catch (err) {
                              console.error("Error confirming date", err);
                            }
                          }}
                        />
                      </GlassCard>
                    )}
                    {event.locationMode === "vote" && (
                      <GlassCard className="ep-card">
                        <LocationVotePanel
                          shortId={shortId}
                          options={event.locationOptions}
                          myVote={event.locationVote}
                          isOrganizer={isOrganizer}
                          invitations={invitations}
                          onVoteChange={() => setRefreshKey((k) => k + 1)}
                        />
                      </GlassCard>
                    )}
                  </div>
                </motion.div>
              )}
              {activeTab === "notifications" && isOrganizer && (
                <motion.div
                  key="notifications"
                  className="ep-tab-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <GlassCard className="ep-card">
                    <div className="ep-card-header">
                      <i className="fa-solid fa-bell ep-card-icon"></i>
                      <h3>Mes notifications</h3>
                    </div>
                    <EventNotifPrefs
                      shortId={shortId}
                      initialPrefs={event.organizerNotificationPrefs || {}}
                    />
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <motion.div className="ep-restricted" {...fadeUp(0.3)}>
            <GlassCard className="ep-card ep-card-restricted">
              <div className="ep-lock-icon">🔒</div>
              <h3>Événement privé</h3>
              <p>Rejoignez l'événement avec le code d'accès pour participer.</p>
              <form onSubmit={handleJoinCode} className="ep-join-form">
                {!currentUser && event.allowExternalGuests && (
                  <input
                    type="text"
                    placeholder="Votre prénom"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    className="ep-input"
                    required
                  />
                )}
                {!currentUser && !event.allowExternalGuests && (
                  <p className="ep-join-info">
                    Connectez-vous pour rejoindre cet événement.
                  </p>
                )}
                {(currentUser || event.allowExternalGuests) && (
                  <>
                    <input
                      type="text"
                      placeholder="Code d'accès"
                      value={accessCodeInput}
                      onChange={(e) =>
                        setAccessCodeInput(e.target.value.toUpperCase())
                      }
                      className="ep-input ep-input-code"
                      required
                    />
                    {joinError && <p className="ep-join-error">{joinError}</p>}
                    <motion.button
                      type="submit"
                      className="ep-btn ep-btn-primary ep-btn-full"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Rejoindre l'événement
                    </motion.button>
                  </>
                )}
              </form>
            </GlassCard>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showInviteModal && (
          <InviteModal
            shortId={shortId}
            onClose={(refresh) => {
              setShowInviteModal(false);
              if (refresh) setRefreshKey((k) => k + 1);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditForm && (
          <EventForm
            editMode={true}
            existingEvent={event}
            onClose={(result) => {
              setShowEditForm(false);
              if (result) setRefreshKey((k) => k + 1);
            }}
          />
        )}
      </AnimatePresence>

      <ChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        title="Discussion"
      >
        <EventChat shortId={event?.shortId} participants={participants} />
      </ChatModal>
    </div>
  );
};

export default EventPage;

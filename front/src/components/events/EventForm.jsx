import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import apiHandler from "../../api/apiHandler";
import { useLocation } from "react-router-dom";
import "./css/eventForm.css";

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.97,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const stepVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: (dir) => ({
    opacity: 0,
    x: dir > 0 ? -40 : 40,
    transition: { duration: 0.2 },
  }),
};

// ─── Hook Google Places Autocomplete ────────────────────
const usePlacesAutocomplete = (inputRef, onPlaceSelected) => {
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["establishment", "geocode"],
        fields: ["name", "formatted_address", "geometry"],
      },
    );

    const listener = autocompleteRef.current.addListener(
      "place_changed",
      () => {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry) return;

        onPlaceSelected({
          name: place.name || "",
          address: place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      },
    );

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [inputRef.current, window.google?.maps?.places]);
};

// ─── Loader script Google Maps ───────────────────────────
const loadGoogleMapsScript = () => {
  return new Promise((resolve) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    if (document.getElementById("google-maps-script")) {
      // Script déjà en cours de chargement, attendre
      const interval = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

// ─── Composant champ lieu avec autocomplete ──────────────
const LocationAutocomplete = ({ value, onChange, onPlaceSelected }) => {
  const inputRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript().then(() => setGoogleReady(true));
  }, []);

  usePlacesAutocomplete(
    googleReady ? inputRef : { current: null },
    onPlaceSelected,
  );

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="Rechercher un lieu, une adresse..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      style={{ width: "100%" }}
    />
  );
};

// ─── Composant principal ─────────────────────────────────
const EventForm = ({
  onClose,
  defaultValues = {},
  editMode = false,
  existingEvent = null,
}) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (editMode && existingEvent) {
      return {
        title: existingEvent.title || "",
        type: existingEvent.type || "party",
        description: existingEvent.description || "",
        forPerson:
          existingEvent.forPerson?._id || existingEvent.forPerson || "",
        forDate: "",
        recurrence: "once",
        dateMode: existingEvent.dateMode || "fixed",
        fixedDate: existingEvent.fixedDate
          ? new Date(existingEvent.fixedDate).toISOString().slice(0, 16)
          : "",
        dateOptions: existingEvent.dateOptions || [],
        locationMode: existingEvent.locationMode || "fixed",
        fixedLocation: existingEvent.fixedLocation || {
          name: "",
          address: "",
          coordinates: { lat: null, lng: null },
        },
        locationOptions: existingEvent.locationOptions || [],
        giftMode: existingEvent.giftMode || "proposals",
        imposedGifts: existingEvent.imposedGifts || [],
        giftPoolEnabled: existingEvent.giftPoolEnabled || false,
        maxGuests: existingEvent.maxGuests || "",
        allowExternalGuests: existingEvent.allowExternalGuests !== false,
        allowGuestInvites: existingEvent.allowGuestInvites || false,
        reminders: existingEvent.reminders || [],
      };
    }
    const initialName = searchParams.get("name") || defaultValues.name;
    const initialPersonId =
      searchParams.get("forPerson") || defaultValues.forPerson || "";
    const initialDateId =
      searchParams.get("forDate") || defaultValues.forDate || "";
    return {
      title: initialName ? `Anniversaire de ${initialName}` : "",
      type: initialName ? "birthday" : "party",
      description: "",
      forPerson: initialPersonId,
      forDate: initialDateId,
      recurrence: "once",
      dateMode: "fixed",
      fixedDate: "",
      dateOptions: [],
      locationMode: "fixed",
      fixedLocation: {
        name: "",
        address: "",
        coordinates: { lat: null, lng: null },
      },
      locationOptions: [],
      giftMode: "proposals",
      imposedGifts: [],
      giftPoolEnabled: false,
      maxGuests: "",
      allowExternalGuests: true,
      allowGuestInvites: false,
      reminders: [
        { type: "event_date", daysBeforeEvent: 7, sent: false },
        { type: "event_date", daysBeforeEvent: 1, sent: false },
      ],
    };
  });

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [newImposedGift, setNewImposedGift] = useState({
    name: "",
    url: "",
    price: "",
  });

  useEffect(() => {
    apiHandler
      .get("/friends")
      .then((res) => setFriends(res.data))
      .catch((err) => console.error("Error fetching friends", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };
  const handlePrev = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  // Callback quand Google Places retourne un lieu
  const handlePlaceSelected = (place) => {
    setFormData((prev) => ({
      ...prev,
      fixedLocation: {
        name: place.name,
        address: place.address,
        coordinates: {
          lat: place.lat,
          lng: place.lng,
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.maxGuests) payload.maxGuests = null;
      if (payload.dateMode === "fixed" && formData.fixedDate) {
        payload.fixedDate = new Date(formData.fixedDate);
      }
      if (editMode && existingEvent) {
        await apiHandler.put(`/events/${existingEvent.shortId}`, payload);
        if (selectedFriends.length > 0)
          await apiHandler.post(`/events/${existingEvent.shortId}/invite`, {
            userIds: selectedFriends,
          });
        onClose(true);
      } else {
        const res = await apiHandler.post("/events", payload);
        const shortId = res.data.shortId;
        if (selectedFriends.length > 0)
          await apiHandler.post(`/events/${shortId}/invite`, {
            userIds: selectedFriends,
          });
        onClose(shortId);
      }
    } catch (err) {
      console.error("Error submitting event", err);
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="event-modal-overlay"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="event-modal"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-modal-header">
          <h2>{editMode ? "Modifier l'événement" : "Créer un événement"}</h2>
          <motion.button
            className="event-close-btn"
            onClick={() => onClose()}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            ✕
          </motion.button>
        </div>

        <div className="event-modal-body">
          {/* Stepper */}
          <div className="event-stepper">
            {[1, 2, 3, 4, 5, 6].map((s) => {
              const clickable = editMode || s <= step;
              return (
                <motion.div
                  key={s}
                  className={`event-step-circle ${step >= s ? "active" : ""}`}
                  animate={{ scale: step === s ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => {
                    if (clickable) {
                      setDirection(s > step ? 1 : -1);
                      setStep(s);
                    }
                  }}
                  style={{ cursor: clickable ? "pointer" : "default" }}
                >
                  {s}
                </motion.div>
              );
            })}
          </div>

          <div style={{ overflow: "hidden", position: "relative" }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                className="event-form-step"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* ── Step 1 : Infos générales ── */}
                {step === 1 && (
                  <>
                    <h3>Étape 1 : Informations générales</h3>
                    <div className="event-form-group">
                      <label>Titre de l'événement *</label>
                      <input
                        type="text"
                        name="title"
                        required
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Que fêtons-nous ?"
                      />
                    </div>
                    <div className="event-form-group">
                      <label>Type *</label>
                      <select
                        name="type"
                        required
                        value={formData.type}
                        onChange={handleChange}
                      >
                        <option value="birthday">Anniversaire 🎂</option>
                        <option value="party">Fête 🎊</option>
                        <option value="dinner">Dîner 🍽️</option>
                        <option value="other">Autre / Événement 📅</option>
                      </select>
                    </div>
                    <div className="event-form-group">
                      <label>Description (optionnel)</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows="3"
                        placeholder="Donnez plus de détails..."
                      ></textarea>
                    </div>
                  </>
                )}

                {/* ── Step 2 : Date ── */}
                {step === 2 && (
                  <>
                    <h3>Étape 2 : Date</h3>
                    <div className="event-form-group">
                      <label>Mode de sélection de date</label>
                      <select
                        name="dateMode"
                        value={formData.dateMode}
                        onChange={handleChange}
                      >
                        <option value="fixed">Date exacte connue</option>
                        <option value="vote">
                          Je propose plusieurs dates et on vote
                        </option>
                      </select>
                    </div>
                    {formData.dateMode === "fixed" ? (
                      <div className="event-form-group">
                        <label>Date *</label>
                        <input
                          type="datetime-local"
                          name="fixedDate"
                          required
                          value={formData.fixedDate}
                          onChange={handleChange}
                        />
                      </div>
                    ) : (
                      <div className="event-form-group">
                        <label>Ajoutez les dates proposées :</label>
                        <input
                          type="datetime-local"
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              dateOptions: [
                                ...formData.dateOptions,
                                e.target.value,
                              ],
                            })
                          }
                        />
                        <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                          {formData.dateOptions.map((opt, i) => (
                            <li key={i}>
                              {new Date(opt).toLocaleDateString("fr-FR")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* ── Step 3 : Lieu avec Google Places ── */}
                {step === 3 && (
                  <>
                    <h3>Étape 3 : Lieu</h3>
                    <div className="event-form-group">
                      <label>Mode</label>
                      <select
                        name="locationMode"
                        value={formData.locationMode}
                        onChange={handleChange}
                      >
                        <option value="fixed">Lieu exact</option>
                        <option value="vote">
                          Je propose plusieurs lieux (Vote)
                        </option>
                      </select>
                    </div>

                    {formData.locationMode === "fixed" && (
                      <div className="event-form-group">
                        <label>Rechercher un lieu</label>
                        <LocationAutocomplete
                          value={formData.fixedLocation.name}
                          onChange={(val) =>
                            setFormData((prev) => ({
                              ...prev,
                              fixedLocation: {
                                ...prev.fixedLocation,
                                name: val,
                                lat: null,
                                lng: null,
                              },
                            }))
                          }
                          onPlaceSelected={handlePlaceSelected}
                        />

                        {/* Adresse complète affichée après sélection */}
                        {formData.fixedLocation.address && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                              marginTop: "10px",
                              padding: "10px 14px",
                              background: "var(--bg-secondary)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-color)",
                              fontSize: "0.88rem",
                              color: "var(--text-secondary)",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                            }}
                          >
                            <i
                              className="fa-solid fa-location-dot"
                              style={{
                                color: "var(--primary)",
                                marginTop: "2px",
                                flexShrink: 0,
                              }}
                            ></i>
                            <span>{formData.fixedLocation.address}</span>
                          </motion.div>
                        )}

                        {/* Champ adresse manuel si pas de sélection Google */}
                        {!formData.fixedLocation.coordinates?.lat && (
                          <input
                            type="text"
                            placeholder="Ou saisissez l'adresse manuellement"
                            value={formData.fixedLocation.address}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                fixedLocation: {
                                  ...prev.fixedLocation,
                                  address: e.target.value,
                                },
                              }))
                            }
                            style={{ marginTop: "10px", width: "100%" }}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── Step 4 : Cadeaux ── */}
                {step === 4 && (
                  <>
                    <h3>Étape 4 : Cadeaux</h3>
                    <div className="event-form-group">
                      <label>Mode cadeaux</label>
                      <select
                        name="giftMode"
                        value={formData.giftMode}
                        onChange={handleChange}
                      >
                        <option value="proposals">
                          Liste d'idées participative (tout le monde
                          propose/vote)
                        </option>
                        <option value="imposed">
                          Cadeau(x) imposé(s) par l'organisateur
                        </option>
                        <option value="none">
                          Pas de cadeau pour cet événement
                        </option>
                      </select>
                    </div>

                    {formData.giftMode === "imposed" && (
                      <div className="event-form-group">
                        <label>Cadeaux imposés</label>
                        {formData.imposedGifts.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              marginBottom: "12px",
                            }}
                          >
                            {formData.imposedGifts.map((g, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  padding: "10px 12px",
                                  background: "var(--bg-secondary)",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border-color)",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontWeight: "bold" }}>
                                    {g.name}
                                  </span>
                                  {g.price && (
                                    <span
                                      style={{
                                        color: "var(--text-tertiary)",
                                        fontSize: "0.85rem",
                                        marginLeft: "8px",
                                      }}
                                    >
                                      {g.price}€
                                    </span>
                                  )}
                                  {g.url && (
                                    <a
                                      href={g.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        marginLeft: "8px",
                                        color: "var(--primary)",
                                        fontSize: "0.8rem",
                                      }}
                                    >
                                      <i className="fa-solid fa-link"></i>
                                    </a>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      imposedGifts: prev.imposedGifts.filter(
                                        (_, idx) => idx !== i,
                                      ),
                                    }))
                                  }
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--danger, #e74c3c)",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            padding: "12px",
                            background: "var(--bg-secondary)",
                            borderRadius: "8px",
                            border: "1px dashed var(--border-color)",
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Nom du cadeau *"
                            value={newImposedGift.name}
                            onChange={(e) =>
                              setNewImposedGift((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                          />
                          <input
                            type="text"
                            placeholder="Lien (URL)"
                            value={newImposedGift.url}
                            onChange={(e) =>
                              setNewImposedGift((prev) => ({
                                ...prev,
                                url: e.target.value,
                              }))
                            }
                          />
                          <input
                            type="number"
                            placeholder="Prix approx. (€)"
                            value={newImposedGift.price}
                            onChange={(e) =>
                              setNewImposedGift((prev) => ({
                                ...prev,
                                price: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={!newImposedGift.name.trim()}
                            onClick={() => {
                              if (!newImposedGift.name.trim()) return;
                              setFormData((prev) => ({
                                ...prev,
                                imposedGifts: [
                                  ...prev.imposedGifts,
                                  { ...newImposedGift },
                                ],
                              }));
                              setNewImposedGift({
                                name: "",
                                url: "",
                                price: "",
                              });
                            }}
                            style={{
                              padding: "8px",
                              background: "var(--primary)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "bold",
                              opacity: newImposedGift.name.trim() ? 1 : 0.5,
                            }}
                          >
                            + Ajouter ce cadeau
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="cagnotte-placeholder">
                      <div className="badge">Bientôt disponible</div>
                      <h4
                        style={{
                          margin: "0 0 10px 0",
                          color: "var(--text-primary)",
                        }}
                      >
                        💳 Cagnotte partagée
                      </h4>
                      <p style={{ margin: 0, fontSize: "0.9rem" }}>
                        Activez cette option pour collecter de l'argent
                        ensemble.
                      </p>
                    </div>
                  </>
                )}

                {/* ── Step 5 : Invitations ── */}
                {step === 5 && (
                  <>
                    <h3>Étape 5 : Invitations & Confidentialité</h3>
                    <div className="event-form-group">
                      <label>Inviter des amis</label>
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-tertiary)",
                          margin: "0 0 10px 0",
                        }}
                      >
                        Sélectionnez les amis que vous souhaitez inviter.
                      </p>
                      <div
                        className="friends-list"
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          border: "1px solid var(--border-color)",
                          borderRadius: "5px",
                          padding: "10px",
                          background: "var(--bg-secondary)",
                        }}
                      >
                        {friends.length === 0 ? (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.9rem",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            Aucun ami trouvé.
                          </p>
                        ) : (
                          friends
                            .filter((f) => f.friendUser)
                            .map((f) => (
                              <label
                                key={f.friendUser._id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  marginBottom: "10px",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFriends.includes(
                                    f.friendUser._id,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setSelectedFriends([
                                        ...selectedFriends,
                                        f.friendUser._id,
                                      ]);
                                    else
                                      setSelectedFriends(
                                        selectedFriends.filter(
                                          (id) => id !== f.friendUser._id,
                                        ),
                                      );
                                  }}
                                />
                                <div
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "50%",
                                    background: "var(--primary)",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {f.friendUser.name[0]}
                                </div>
                                <span>
                                  {f.friendUser.name} {f.friendUser.surname}
                                </span>
                              </label>
                            ))
                        )}
                      </div>
                    </div>
                    <div
                      className="event-form-group"
                      style={{ marginTop: "15px" }}
                    >
                      <label>
                        Nombre max d'invités (laisser vide si illimité)
                      </label>
                      <input
                        type="number"
                        name="maxGuests"
                        value={formData.maxGuests}
                        onChange={handleChange}
                        min="1"
                        placeholder="Ex: 15"
                      />
                    </div>
                    <div className="event-checkbox-group">
                      <input
                        type="checkbox"
                        id="allowExternals"
                        name="allowExternalGuests"
                        checked={formData.allowExternalGuests}
                        onChange={handleChange}
                      />
                      <label htmlFor="allowExternals">
                        Autoriser les invités externes (via lien public avec
                        code)
                      </label>
                    </div>
                    <div className="event-checkbox-group">
                      <input
                        type="checkbox"
                        id="allowGuestInvites"
                        name="allowGuestInvites"
                        checked={formData.allowGuestInvites}
                        onChange={handleChange}
                      />
                      <label htmlFor="allowGuestInvites">
                        Autoriser les invités à inviter d'autres personnes
                      </label>
                    </div>
                  </>
                )}

                {/* ── Step 6 : Rappels ── */}
                {step === 6 && (
                  <>
                    <h3>Étape 6 : Rappels</h3>
                    <p
                      style={{
                        marginBottom: "1.5rem",
                        color: "var(--text-secondary)",
                        fontSize: "0.95rem",
                      }}
                    >
                      Configurez les rappels automatiques envoyés aux invités
                      confirmés.
                    </p>
                    <div className="event-checkbox-group">
                      <input
                        type="checkbox"
                        id="rem7"
                        checked={formData.reminders.some(
                          (r) => r.daysBeforeEvent === 7,
                        )}
                        onChange={(e) => {
                          const current = [...formData.reminders];
                          if (e.target.checked)
                            current.push({
                              type: "event_date",
                              daysBeforeEvent: 7,
                              sent: false,
                            });
                          else {
                            const idx = current.findIndex(
                              (r) => r.daysBeforeEvent === 7,
                            );
                            if (idx !== -1) current.splice(idx, 1);
                          }
                          setFormData({ ...formData, reminders: current });
                        }}
                      />
                      <label htmlFor="rem7">Rappel à J-7</label>
                    </div>
                    <div className="event-checkbox-group">
                      <input
                        type="checkbox"
                        id="rem1"
                        checked={formData.reminders.some(
                          (r) => r.daysBeforeEvent === 1,
                        )}
                        onChange={(e) => {
                          const current = [...formData.reminders];
                          if (e.target.checked)
                            current.push({
                              type: "event_date",
                              daysBeforeEvent: 1,
                              sent: false,
                            });
                          else {
                            const idx = current.findIndex(
                              (r) => r.daysBeforeEvent === 1,
                            );
                            if (idx !== -1) current.splice(idx, 1);
                          }
                          setFormData({ ...formData, reminders: current });
                        }}
                      />
                      <label htmlFor="rem1">Rappel la veille (J-1)</label>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="event-modal-footer">
          {step > 1 && (
            <motion.button
              type="button"
              onClick={handlePrev}
              className="event-btn-cancel"
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Précédent
            </motion.button>
          )}
          {step === 1 && (
            <motion.button
              type="button"
              onClick={() => onClose()}
              className="event-btn-cancel"
              whileTap={{ scale: 0.97 }}
            >
              Annuler
            </motion.button>
          )}
          <motion.button
            type="button"
            onClick={step === 6 ? handleSubmit : handleNext}
            disabled={loading}
            className="event-btn-submit"
            whileHover={{ scale: 1.03, x: step < 6 ? 2 : 0 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading
              ? "Chargement..."
              : step === 6
                ? editMode
                  ? "Enregistrer les modifications ✓"
                  : "Créer l'événement 🎉"
                : "Suivant →"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EventForm;

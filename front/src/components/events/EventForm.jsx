import React, { useState, useEffect } from "react";
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
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: 20, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } },
};

const stepVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40, transition: { duration: 0.2 } }),
};

const EventForm = ({ onClose, defaultValues = {}, editMode = false, existingEvent = null }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (editMode && existingEvent) {
      return {
        title: existingEvent.title || "",
        type: existingEvent.type || "party",
        description: existingEvent.description || "",
        forPerson: existingEvent.forPerson?._id || existingEvent.forPerson || "",
        forDate: "",
        recurrence: "once",
        dateMode: existingEvent.dateMode || "fixed",
        fixedDate: existingEvent.fixedDate ? new Date(existingEvent.fixedDate).toISOString().slice(0, 16) : "",
        dateOptions: existingEvent.dateOptions || [],
        locationMode: existingEvent.locationMode || "fixed",
        fixedLocation: existingEvent.fixedLocation || { name: "", address: "" },
        locationOptions: existingEvent.locationOptions || [],
        giftMode: existingEvent.giftMode || "proposals",
        imposedGift: existingEvent.imposedGift || { name: "", url: "", price: "" },
        giftPoolEnabled: existingEvent.giftPoolEnabled || false,
        maxGuests: existingEvent.maxGuests || "",
        allowExternalGuests: existingEvent.allowExternalGuests !== false,
        reminders: existingEvent.reminders || [],
      };
    }
    const initialName = searchParams.get("name") || defaultValues.name;
    const initialPersonId = searchParams.get("forPerson") || defaultValues.forPerson || "";
    const initialDateId = searchParams.get("forDate") || defaultValues.forDate || "";
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
      fixedLocation: { name: "", address: "" },
      locationOptions: [],
      giftMode: "proposals",
      imposedGift: { name: "", url: "", price: "" },
      giftPoolEnabled: false,
      maxGuests: "",
      allowExternalGuests: true,
      reminders: [
        { type: "event_date", daysBeforeEvent: 7, sent: false },
        { type: "event_date", daysBeforeEvent: 1, sent: false },
      ],
    };
  });

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);

  useEffect(() => {
    apiHandler.get("/friends")
      .then(res => setFriends(res.data))
      .catch(err => console.error("Error fetching friends", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleNext = () => { setDirection(1); setStep(s => s + 1); };
  const handlePrev = () => { setDirection(-1); setStep(s => s - 1); };

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
        if (selectedFriends.length > 0) await apiHandler.post(`/events/${existingEvent.shortId}/invite`, { userIds: selectedFriends });
        onClose(true);
      } else {
        const res = await apiHandler.post("/events", payload);
        const shortId = res.data.shortId;
        if (selectedFriends.length > 0) await apiHandler.post(`/events/${shortId}/invite`, { userIds: selectedFriends });
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
        onClick={e => e.stopPropagation()}
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
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <motion.div
                key={s}
                className={`event-step-circle ${step >= s ? "active" : ""}`}
                animate={{ scale: step === s ? 1.15 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {s}
              </motion.div>
            ))}
          </div>

          {/* Steps animés */}
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
                {step === 1 && (
                  <>
                    <h3>Étape 1 : Informations générales</h3>
                    <div className="event-form-group">
                      <label>Titre de l'événement *</label>
                      <input type="text" name="title" required value={formData.title} onChange={handleChange} placeholder="Que fêtons-nous ?" />
                    </div>
                    <div className="event-form-group">
                      <label>Type *</label>
                      <select name="type" required value={formData.type} onChange={handleChange}>
                        <option value="birthday">Anniversaire 🎂</option>
                        <option value="party">Fête 🎊</option>
                        <option value="dinner">Dîner 🍽️</option>
                        <option value="other">Autre / Événement 📅</option>
                      </select>
                    </div>
                    <div className="event-form-group">
                      <label>Description (optionnel)</label>
                      <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Donnez plus de détails..."></textarea>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h3>Étape 2 : Date</h3>
                    <div className="event-form-group">
                      <label>Mode de sélection de date</label>
                      <select name="dateMode" value={formData.dateMode} onChange={handleChange}>
                        <option value="fixed">Date exacte connue</option>
                        <option value="vote">Je propose plusieurs dates et on vote</option>
                      </select>
                    </div>
                    {formData.dateMode === "fixed" ? (
                      <div className="event-form-group">
                        <label>Date *</label>
                        <input type="datetime-local" name="fixedDate" required value={formData.fixedDate} onChange={handleChange} />
                      </div>
                    ) : (
                      <div className="event-form-group">
                        <label>Ajoutez les dates proposées :</label>
                        <input type="datetime-local" onChange={(e) => setFormData({ ...formData, dateOptions: [...formData.dateOptions, e.target.value] })} />
                        <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                          {formData.dateOptions.map((opt, i) => <li key={i}>{new Date(opt).toLocaleDateString("fr-FR")}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {step === 3 && (
                  <>
                    <h3>Étape 3 : Lieu</h3>
                    <div className="event-form-group">
                      <label>Lieu *</label>
                      <select name="locationMode" value={formData.locationMode} onChange={handleChange}>
                        <option value="fixed">Lieu exact</option>
                        <option value="vote">Je propose plusieurs lieux (Vote)</option>
                      </select>
                    </div>
                    {formData.locationMode === "fixed" && (
                      <div className="event-form-group">
                        <input type="text" placeholder="Nom du lieu (ex: Chez moi)" value={formData.fixedLocation.name} onChange={(e) => setFormData({ ...formData, fixedLocation: { ...formData.fixedLocation, name: e.target.value } })} required />
                        <input type="text" placeholder="Adresse" value={formData.fixedLocation.address} onChange={(e) => setFormData({ ...formData, fixedLocation: { ...formData.fixedLocation, address: e.target.value } })} style={{ marginTop: "10px" }} />
                      </div>
                    )}
                  </>
                )}

                {step === 4 && (
                  <>
                    <h3>Étape 4 : Cadeaux</h3>
                    <div className="event-form-group">
                      <label>Mode cadeaux</label>
                      <select name="giftMode" value={formData.giftMode} onChange={handleChange}>
                        <option value="proposals">Liste d'idées participative</option>
                        <option value="imposed">Cadeau précis imposé / Cagnotte unique</option>
                      </select>
                    </div>
                    <div className="cagnotte-placeholder">
                      <div className="badge">Bientôt disponible</div>
                      <h4 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>💳 Cagnotte partagée</h4>
                      <p style={{ margin: 0, fontSize: "0.9rem" }}>Activez cette option pour collecter de l'argent ensemble.</p>
                    </div>
                  </>
                )}

                {step === 5 && (
                  <>
                    <h3>Étape 5 : Invitations & Confidentialité</h3>
                    <div className="event-form-group">
                      <label>Inviter des amis</label>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0 0 10px 0" }}>Sélectionnez les amis que vous souhaitez inviter.</p>
                      <div className="friends-list" style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "5px", padding: "10px", background: "var(--bg-secondary)" }}>
                        {friends.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-tertiary)" }}>Aucun ami trouvé.</p>
                        ) : (
                          friends.filter(f => f.friendUser).map(f => (
                            <label key={f.friendUser._id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={selectedFriends.includes(f.friendUser._id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedFriends([...selectedFriends, f.friendUser._id]);
                                  else setSelectedFriends(selectedFriends.filter(id => id !== f.friendUser._id));
                                }}
                              />
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: "bold" }}>
                                {f.friendUser.name[0]}
                              </div>
                              <span>{f.friendUser.name} {f.friendUser.surname}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="event-form-group" style={{ marginTop: "15px" }}>
                      <label>Nombre max d'invités (laisser vide si illimité)</label>
                      <input type="number" name="maxGuests" value={formData.maxGuests} onChange={handleChange} min="1" placeholder="Ex: 15" />
                    </div>
                    <div className="event-checkbox-group">
                      <input type="checkbox" id="allowExternals" name="allowExternalGuests" checked={formData.allowExternalGuests} onChange={handleChange} />
                      <label htmlFor="allowExternals">Autoriser les invités externes (via lien public avec code)</label>
                    </div>
                  </>
                )}

                {step === 6 && (
                  <>
                    <h3>Étape 6 : Rappels</h3>
                    <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Configurez les rappels automatiques envoyés aux invités confirmés.</p>
                    <div className="event-checkbox-group">
                      <input type="checkbox" id="rem7" checked={formData.reminders.some(r => r.daysBeforeEvent === 7)} onChange={(e) => {
                        const current = [...formData.reminders];
                        if (e.target.checked) current.push({ type: "event_date", daysBeforeEvent: 7, sent: false });
                        else { const idx = current.findIndex(r => r.daysBeforeEvent === 7); if (idx !== -1) current.splice(idx, 1); }
                        setFormData({ ...formData, reminders: current });
                      }} />
                      <label htmlFor="rem7">Rappel à J-7</label>
                    </div>
                    <div className="event-checkbox-group">
                      <input type="checkbox" id="rem1" checked={formData.reminders.some(r => r.daysBeforeEvent === 1)} onChange={(e) => {
                        const current = [...formData.reminders];
                        if (e.target.checked) current.push({ type: "event_date", daysBeforeEvent: 1, sent: false });
                        else { const idx = current.findIndex(r => r.daysBeforeEvent === 1); if (idx !== -1) current.splice(idx, 1); }
                        setFormData({ ...formData, reminders: current });
                      }} />
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
            <motion.button type="button" onClick={handlePrev} className="event-btn-cancel" whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }}>
              Précédent
            </motion.button>
          )}
          {step === 1 && (
            <motion.button type="button" onClick={() => onClose()} className="event-btn-cancel" whileTap={{ scale: 0.97 }}>
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
            {loading ? "Chargement..." : step === 6 ? (editMode ? "Enregistrer les modifications ✓" : "Créer l'événement 🎉") : "Suivant →"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EventForm;
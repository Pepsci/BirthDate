import React, { useState, useEffect } from "react";
import apiHandler from "../../api/apiHandler";
import { useLocation } from "react-router-dom";
import "./css/eventForm.css";

const EventForm = ({ onClose, defaultValues = {} }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
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
        { type: "event_date", daysBeforeEvent: 1, sent: false }
      ]
    };
  });

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);

  useEffect(() => {
    // Fetch friends on component mount
    apiHandler.get("/friends")
      .then(res => setFriends(res.data))
      .catch(err => console.error("Error fetching friends", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.maxGuests) payload.maxGuests = null;
      if (payload.dateMode === "fixed" && formData.fixedDate) {
        payload.fixedDate = new Date(formData.fixedDate);
      }
      
      const res = await apiHandler.post("/events", payload);
      const shortId = res.data.shortId;

      if (selectedFriends.length > 0) {
        await apiHandler.post(`/events/${shortId}/invite`, { userIds: selectedFriends });
      }

      onClose(shortId); // Renvoie l'ID généré pour rediriger
    } catch (err) {
      console.error("Error creating event", err);
      setLoading(false);
      // Gérer l'erreur
    }
  };

  return (
    <div className="event-modal-overlay">
      <div className="event-modal">
        <div className="event-modal-header">
          <h2>Créer un événement</h2>
          <button className="event-close-btn" onClick={() => onClose()}>✕</button>
        </div>
        
        <div className="event-modal-body">
          <div className="event-stepper">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} className={`event-step-circle ${step >= s ? "active" : ""}`}>
                {s}
              </div>
            ))}
          </div>

          <form onSubmit={step === 6 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {step === 1 && (
              <div className="event-form-step">
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
              </div>
            )}

            {step === 2 && (
              <div className="event-form-step">
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
                    <input type="datetime-local" onChange={(e) => setFormData({...formData, dateOptions: [...formData.dateOptions, e.target.value]})} />
                    <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                      {formData.dateOptions.map((opt, i) => <li key={i}>{new Date(opt).toLocaleDateString("fr-FR")}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="event-form-step">
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
                    <input type="text" placeholder="Nom du lieu (ex: Chez moi)" value={formData.fixedLocation.name} onChange={(e) => setFormData({...formData, fixedLocation: {...formData.fixedLocation, name: e.target.value}})} required />
                    <input type="text" placeholder="Adresse" value={formData.fixedLocation.address} onChange={(e) => setFormData({...formData, fixedLocation: {...formData.fixedLocation, address: e.target.value}})} style={{marginTop: "10px"}} />
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="event-form-step">
                <h3>Étape 4 : Cadeaux</h3>
                <div className="event-form-group">
                  <label>Mode cadeaux</label>
                  <select name="giftMode" value={formData.giftMode} onChange={handleChange}>
                    <option value="proposals">Liste d'idées participative (Tout le monde peut proposer/voter)</option>
                    <option value="imposed">Cadeau précis imposé / Cagnotte unique</option>
                  </select>
                </div>

                <div className="cagnotte-placeholder">
                   <div className="badge">Bientôt disponible</div>
                   <h4 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>💳 Cagnotte partagée</h4>
                   <p style={{ margin: 0, fontSize: "0.9rem" }}>Activez cette option pour collecter de l'argent ensemble.</p>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="event-form-step">
                <h3>Étape 5 : Invitations & Confidentialité</h3>
                
                <div className="event-form-group">
                  <label>Inviter des amis</label>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", margin: "0 0 10px 0" }}>Sélectionnez les amis que vous souhaitez inviter (ils recevront un email).</p>
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
                            {f.friendUser.avatar ? <img src={f.friendUser.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : f.friendUser.name[0]}
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
              </div>
            )}

            {step === 6 && (
              <div className="event-form-step">
                <h3>Étape 6 : Rappels</h3>
                <p style={{ marginBottom: "1.5rem", color: "var(--text-secondary)", fontSize: "0.95rem" }}>Configurez les rappels automatiques qui seront envoyés aux invités confirmés.</p>
                
                <div className="event-checkbox-group">
                  <input type="checkbox" id="rem7" checked={formData.reminders.some(r => r.daysBeforeEvent === 7)} onChange={(e) => {
                     const current = [...formData.reminders];
                     if(e.target.checked) current.push({type: "event_date", daysBeforeEvent: 7, sent: false});
                     else { const idx = current.findIndex(r => r.daysBeforeEvent === 7); if(idx !== -1) current.splice(idx, 1); }
                     setFormData({...formData, reminders: current});
                  }} />
                  <label htmlFor="rem7">Rappel à J-7</label>
                </div>
                <div className="event-checkbox-group">
                  <input type="checkbox" id="rem1" checked={formData.reminders.some(r => r.daysBeforeEvent === 1)} onChange={(e) => {
                     const current = [...formData.reminders];
                     if(e.target.checked) current.push({type: "event_date", daysBeforeEvent: 1, sent: false});
                     else { const idx = current.findIndex(r => r.daysBeforeEvent === 1); if(idx !== -1) current.splice(idx, 1); }
                     setFormData({...formData, reminders: current});
                  }} />
                  <label htmlFor="rem1">Rappel la veille (J-1)</label>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="event-modal-footer">
          {step > 1 && (
            <button type="button" onClick={handlePrev} className="event-btn-cancel">Précédent</button>
          )}
          {step === 1 && (
            <button type="button" onClick={() => onClose()} className="event-btn-cancel">
              Annuler
            </button>
          )}
          
          <button type="button" onClick={step === 6 ? handleSubmit : handleNext} disabled={loading} className="event-btn-submit">
            {loading ? "Chargement..." : step === 6 ? "Créer l'événement 🎉" : "Suivant"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default EventForm;

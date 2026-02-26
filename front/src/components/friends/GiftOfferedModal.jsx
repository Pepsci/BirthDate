import { useState } from "react";
import "../friends/css/giftOfferedModal.css";

const OCCASIONS = [
  { value: "Anniversaire", label: "🎂 Anniversaire" },
  { value: "Noël", label: "🎄 Noël" },
  { value: "Saint-Valentin", label: "💝 Saint-Valentin" },
  { value: "Fête des Mères", label: "💐 Fête des Mères" },
  { value: "Fête des Pères", label: "👔 Fête des Pères" },
  { value: "Mariage", label: "💍 Mariage" },
  { value: "Naissance", label: "👶 Naissance" },
  { value: "Diplôme", label: "🎓 Diplôme" },
  { value: "Crémaillère", label: "🏠 Crémaillère" },
  { value: "Autre", label: "✨ Autre" },
];

const GiftOfferedModal = ({ item, onConfirm, onCancel }) => {
  const currentYear = new Date().getFullYear();
  const [occasion, setOccasion] = useState("Anniversaire");
  const [customOccasion, setCustomOccasion] = useState("");
  const [year, setYear] = useState(currentYear);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalOccasion = occasion === "Autre" ? customOccasion : occasion;
  const isValid = occasion !== "Autre" || customOccasion.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    await onConfirm({ occasion: finalOccasion, year: parseInt(year) });
    setIsSubmitting(false);
  };

  return (
    <div className="gift-modal" onClick={onCancel}>
      <div
        className="gift-modal-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="gift-modal-header">
          <h2>🎁 J'ai offert ce cadeau</h2>
          <button className="close-btn" onClick={onCancel}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="gift-offered-modal-body">
          <p>
            <strong>{item.title}</strong> sera ajouté à la liste des cadeaux
            offerts.
          </p>

          {/* Occasion */}
          <div className="gift-offered-field">
            <label>Occasion</label>
            <select
              className="gift-offered-select"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Champ libre si "Autre" */}
            {occasion === "Autre" && (
              <div className="gift-offered-other">
                <input
                  type="text"
                  className="gift-offered-input"
                  value={customOccasion}
                  onChange={(e) => setCustomOccasion(e.target.value)}
                  placeholder="Précisez l'occasion..."
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Année */}
          <div className="gift-offered-field">
            <label>Année</label>
            <input
              type="number"
              className="gift-offered-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2000}
              max={currentYear + 1}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="gift-offered-footer">
          <button
            className="btn-close"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button
            className="btn-gift-offered-confirm"
            onClick={handleSubmit}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? "Enregistrement..." : "✅ Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiftOfferedModal;

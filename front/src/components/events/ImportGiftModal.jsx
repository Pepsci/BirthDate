import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import apiHandler from "../../api/apiHandler";
import "./css/importGiftModal.css";

/**
 * ImportGiftModal — deux modes :
 *
 * mode="import" (défaut) :
 *   Étape 1 : sélectionner une carte source (filtre par nom)
 *   Étape 2 : sélectionner les idées → POST /events/:shortId/gifts
 *   Props requis : shortId, onClose, onImported
 *
 * mode="save" :
 *   Étape 1 : sélectionner les idées reçues (prop gifts)
 *   Étape 2 : sélectionner la carte destination (filtre par nom)
 *   → PATCH /date/:id/gifts pour chaque idée sélectionnée
 *   Props requis : gifts, onClose, onSaved
 */
const ImportGiftModal = ({
  shortId, // mode import
  onImported, // mode import
  gifts: incomingGifts, // mode save
  onSaved, // mode save
  mode = "import",
  onClose,
}) => {
  const isSaveMode = mode === "save";

  const [step, setStep] = useState(1);
  const [dates, setDates] = useState([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  // Fermeture au clavier
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Blocage du scroll body pendant que le modal est ouvert
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setDatesLoading(true);
    apiHandler
      .get("/date")
      .then((res) => {
        const all = res.data || [];
        setDates(
          isSaveMode ? all : all.filter((d) => d.gifts && d.gifts.length > 0),
        );
      })
      .catch((err) => console.error("Erreur chargement dates:", err))
      .finally(() => setDatesLoading(false));
  }, []);

  // Idées à afficher selon le mode et l'étape
  const gifts = isSaveMode
    ? (incomingGifts || []).filter((g) => g && g.giftName)
    : selectedDate
      ? (selectedDate.gifts || []).filter((g) => g && g.giftName && g._id)
      : [];

  const filteredDates = dates.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) || d.surname?.toLowerCase().includes(q)
    );
  });

  const giftKey = (gift, index) => gift._id || String(index);

  const allSelected = gifts.length > 0 && selected.size === gifts.length;
  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(gifts.map((g, i) => giftKey(g, i))),
    );

  const toggleGift = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const resetToStep1 = () => {
    setStep(1);
    setSelectedDate(null);
    setSelected(new Set());
    setSearch("");
  };

  // Mode import : poster vers l'événement
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    const toImport = gifts.filter((g, i) => selected.has(giftKey(g, i)));
    try {
      await Promise.all(
        toImport.map((gift) =>
          apiHandler.post(`/events/${shortId}/gifts`, {
            name: gift.giftName,
            url: gift.url || "",
            price: gift.price || "",
          }),
        ),
      );
      setImported(true);
      if (onImported) onImported();
      setTimeout(onClose, 900);
    } catch (err) {
      console.error("Erreur import:", err);
      alert("Erreur lors de l'import, réessaie.");
    } finally {
      setImporting(false);
    }
  };

  // Mode save : patcher la carte destination
  const handleSave = async () => {
    if (selected.size === 0 || !selectedDate) return;
    setImporting(true);
    const toSave = gifts.filter((g, i) => selected.has(giftKey(g, i)));
    try {
      await Promise.all(
        toSave.map((gift) =>
          apiHandler.patch(`/date/${selectedDate._id}/gifts`, {
            giftName: gift.giftName,
            occasion: gift.occasion || "Anniversaire",
            year: gift.year || new Date().getFullYear(),
            purchased: false,
          }),
        ),
      );
      setImported(true);
      window.dispatchEvent(new CustomEvent("dates:refresh"));
      if (onSaved) onSaved();
      setTimeout(onClose, 900);
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
      alert("Erreur lors de la sauvegarde, réessaie.");
    } finally {
      setImporting(false);
    }
  };

  const sourceName =
    !isSaveMode && selectedDate
      ? `${selectedDate.name}${selectedDate.surname ? " " + selectedDate.surname : ""}`
      : "";

  const destName =
    isSaveMode && selectedDate
      ? `${selectedDate.name}${selectedDate.surname ? " " + selectedDate.surname : ""}`
      : "";

  // ── Rendu liste d'idées ──────────────────────────────
  const renderGiftList = () =>
    gifts.length === 0 ? (
      <div className="igm-empty">
        <span className="igm-empty-icon">💡</span>
        <p>Aucune idée disponible.</p>
      </div>
    ) : (
      <>
        <button className="igm-select-all" onClick={toggleAll}>
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        <div className="igm-gift-list">
          {gifts.map((gift, i) => {
            const key = giftKey(gift, i);
            const isSelected = selected.has(key);
            return (
              <div
                key={key}
                className={`igm-gift-item ${isSelected ? "igm-gift-item--selected" : ""}`}
                onClick={() => toggleGift(key)}
              >
                <div className="igm-gift-check">{isSelected ? "✓" : ""}</div>
                <div className="igm-gift-info">
                  <span className="igm-gift-name">{gift.giftName}</span>
                  <span className="igm-gift-meta">
                    {gift.occasion || "Anniversaire"}
                    {gift.year ? ` · ${gift.year}` : ""}
                    {gift.purchased ? " · ✅ Acheté" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );

  // ── Rendu liste de cartes ────────────────────────────
  const renderDateList = (onSelect, withCheck = false) => (
    <>
      <input
        className="igm-search"
        type="text"
        placeholder="🔍 Rechercher un prénom..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {datesLoading ? (
        <div className="igm-loading">Chargement des fiches...</div>
      ) : filteredDates.length === 0 ? (
        <div className="igm-empty">
          <span className="igm-empty-icon">📭</span>
          <p>{search ? "Aucune fiche trouvée." : "Aucune fiche disponible."}</p>
        </div>
      ) : (
        <div className="igm-date-list">
          {filteredDates.map((date) => {
            const isSelected = withCheck && selectedDate?._id === date._id;
            return (
              <div
                key={date._id}
                className={`igm-date-item ${isSelected ? "igm-date-item--selected" : ""}`}
                onClick={() => onSelect(date)}
              >
                <div className="igm-date-avatar">
                  {date.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="igm-date-info">
                  <span className="igm-date-name">
                    {date.name}
                    {date.surname ? ` ${date.surname}` : ""}
                    {date.linkedUser && (
                      <span className="igm-date-badge">👥</span>
                    )}
                    {date.family && !date.linkedUser && (
                      <span className="igm-date-badge">👨‍👩‍👧</span>
                    )}
                  </span>
                  <span className="igm-date-meta">
                    {date.gifts?.length > 0
                      ? `${date.gifts.length} idée${date.gifts.length > 1 ? "s" : ""}`
                      : "Aucune idée"}
                  </span>
                </div>
                {withCheck ? (
                  <div className="igm-date-check">{isSelected ? "✓" : ""}</div>
                ) : (
                  <span className="igm-date-arrow">›</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ── Portal : monté sur document.body, hors du flux React ──
  return createPortal(
    <div
      className="igm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="igm-modal">
        {/* ── Header ── */}
        <div className="igm-header">
          <div className="igm-header-left">
            {step === 2 && (
              <button
                className="igm-back"
                onClick={resetToStep1}
                aria-label="Retour"
              >
                ←
              </button>
            )}
            <span className="igm-icon">{isSaveMode ? "💾" : "📋"}</span>
            <div>
              <h3 className="igm-title">
                {isSaveMode
                  ? step === 1
                    ? "Sauvegarder des idées"
                    : "Choisir une fiche"
                  : step === 1
                    ? "Importer depuis une liste"
                    : "Choisir les idées"}
              </h3>
              <p className="igm-subtitle">
                {isSaveMode
                  ? step === 1
                    ? "Sélectionne les idées à garder"
                    : "Sur quelle fiche ?"
                  : step === 1
                    ? "Sélectionne une fiche source"
                    : `Idées de ${sourceName}`}
              </p>
            </div>
          </div>
          <button className="igm-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {/* ── Corps ── */}
        <div className="igm-body">
          {!isSaveMode &&
            step === 1 &&
            renderDateList((date) => {
              setSelectedDate(date);
              setSelected(new Set());
              setStep(2);
            })}
          {!isSaveMode && step === 2 && renderGiftList()}
          {isSaveMode && step === 1 && renderGiftList()}
          {isSaveMode &&
            step === 2 &&
            renderDateList((date) => setSelectedDate(date), true)}
        </div>

        {/* ── Footer ── */}
        <div className="igm-footer">
          <p className="igm-count">
            {isSaveMode
              ? step === 1
                ? selected.size === 0
                  ? "Sélectionne les idées à sauvegarder"
                  : `${selected.size} idée${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`
                : selectedDate
                  ? `Sur la fiche de ${destName}`
                  : "Choisis une fiche destination"
              : step === 2
                ? selected.size === 0
                  ? "Sélectionne les idées à importer"
                  : `${selected.size} idée${selected.size > 1 ? "s" : ""} sélectionnée${selected.size > 1 ? "s" : ""}`
                : null}
          </p>

          <div className="igm-footer-buttons">
            {/* Mode import — étape 2 */}
            {!isSaveMode && step === 2 && (
              <>
                <button
                  className="igm-btn igm-btn--cancel"
                  onClick={resetToStep1}
                >
                  Retour
                </button>
                <button
                  className={`igm-btn igm-btn--import ${imported ? "igm-btn--done" : ""}`}
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing || imported}
                >
                  {imported
                    ? "✓ Importé !"
                    : importing
                      ? "Import..."
                      : `Ajouter ${selected.size > 0 ? `(${selected.size})` : ""}`}
                </button>
              </>
            )}

            {/* Mode save — étape 1 */}
            {isSaveMode && step === 1 && (
              <>
                <button className="igm-btn igm-btn--cancel" onClick={onClose}>
                  Annuler
                </button>
                <button
                  className="igm-btn igm-btn--import"
                  onClick={() => {
                    setStep(2);
                    setSearch("");
                  }}
                  disabled={selected.size === 0}
                >
                  Suivant →
                </button>
              </>
            )}

            {/* Mode save — étape 2 */}
            {isSaveMode && step === 2 && (
              <>
                <button
                  className="igm-btn igm-btn--cancel"
                  onClick={() => {
                    setStep(1);
                    setSelectedDate(null);
                    setSearch("");
                  }}
                >
                  Retour
                </button>
                <button
                  className={`igm-btn igm-btn--import ${imported ? "igm-btn--done" : ""}`}
                  onClick={handleSave}
                  disabled={!selectedDate || importing || imported}
                >
                  {imported
                    ? "✓ Sauvegardé !"
                    : importing
                      ? "Sauvegarde..."
                      : "Sauvegarder"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImportGiftModal;

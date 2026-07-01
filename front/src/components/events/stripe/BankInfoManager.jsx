import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import "./css/bankInfo.css";

const DURATIONS = [
  { days: 7, label: "7 jours" },
  { days: 14, label: "14 jours" },
  { days: 30, label: "30 jours" },
  { days: 60, label: "60 jours" },
  { days: 90, label: "90 jours" },
];

const BankInfoManager = ({ shortId, ibanEnabled }) => {
  const [enabled, setEnabled] = useState(ibanEnabled || false);
  const [togglingOption, setTogglingOption] = useState(false);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [iban, setIban] = useState("");
  const [holderName, setHolderName] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const fetchExisting = async () => {
    try {
      const res = await apiHandler.get(`/events/${shortId}/bank-info`);
      setExisting(res.data?.exists ? res.data : null);
    } catch {
      setExisting(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) fetchExisting();
    else setLoading(false);
  }, [shortId, enabled]);

  const handleToggleOption = async () => {
    const next = !enabled;
    setTogglingOption(true);
    setError("");
    try {
      await apiHandler.put(`/events/${shortId}/direct-transfer/iban-toggle`, {
        enabled: next,
      });
      setEnabled(next);
      if (!next) {
        setExisting(null);
        setShowForm(false);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setTogglingOption(false);
    }
  };

  const handleSave = async () => {
    setError("");
    if (!acknowledged) {
      setError("Veuillez confirmer avoir lu l'avertissement.");
      return;
    }
    if (!iban.replace(/\s+/g, "") || iban.replace(/\s+/g, "").length < 14) {
      setError("IBAN invalide.");
      return;
    }
    setSaving(true);
    try {
      await apiHandler.put(`/events/${shortId}/bank-info`, {
        iban,
        holderName,
        durationDays,
      });
      setIban("");
      setHolderName("");
      setShowForm(false);
      setAcknowledged(false);
      fetchExisting();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Erreur lors de l'enregistrement.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await apiHandler.delete(`/events/${shortId}/bank-info`);
      setExisting(null);
      setConfirmDelete(false);
    } catch (err) {
      console.error("Error deleting bank info", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bi-manager">
      <label className="bi-toggle-row">
        <span>Activer le virement par RIB</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggleOption}
          disabled={togglingOption}
        />
      </label>

      {error && <p className="bi-error">{error}</p>}

      {enabled && (
        <>
          {loading ? (
            <p className="bi-muted">Chargement…</p>
          ) : existing && !showForm ? (
            // RIB enregistré
            <>
              <div className="bi-status">
                <i className="fa-solid fa-shield-halved"></i>
                <div>
                  <p className="bi-status-title">RIB enregistré (chiffré)</p>
                  <p className="bi-status-sub">
                    Visible par les participants ayant un compte. Suppression
                    automatique le{" "}
                    {new Date(existing.expiresAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    .
                  </p>
                </div>
              </div>
              <div className="bi-actions">
                <button
                  className="bi-btn bi-btn-ghost"
                  onClick={() => setShowForm(true)}
                >
                  Modifier
                </button>
                <button
                  className={`bi-btn ${confirmDelete ? "bi-btn-danger-active" : "bi-btn-danger"}`}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting
                    ? "Suppression…"
                    : confirmDelete
                      ? "Confirmer ?"
                      : "Supprimer mon RIB"}
                </button>
                {confirmDelete && (
                  <button
                    className="bi-btn bi-btn-ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </>
          ) : !showForm ? (
            // Activé mais pas encore de RIB
            <>
              <p className="bi-muted">
                L'option est activée. Ajoutez votre RIB pour qu'il soit visible
                par les participants.
              </p>
              <button
                className="bi-btn bi-btn-primary"
                onClick={() => setShowForm(true)}
              >
                <i className="fa-solid fa-building-columns"></i> Ajouter mon RIB
              </button>
            </>
          ) : (
            // Formulaire
            <>
              <div className="bi-warning">
                <p className="bi-warning-title">
                  ⚠️ Avant de partager votre RIB
                </p>
                <p className="bi-warning-text">
                  Partager vos coordonnées bancaires n'est jamais totalement
                  sans risque. Votre IBAN sera visible uniquement par les
                  participants disposant d'un compte BirthReminder, et sera
                  automatiquement supprimé de nos serveurs après la durée que
                  vous choisissez. Ne le partagez que pour un événement et des
                  participants en qui vous avez confiance. BirthReminder ne peut
                  être tenu responsable de l'usage qu'en font les destinataires.
                </p>
              </div>

              <div className="bi-field">
                <label className="bi-label">Titulaire du compte</label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="bi-input"
                  placeholder="Prénom Nom"
                />
              </div>

              <div className="bi-field">
                <label className="bi-label">IBAN</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  className="bi-input"
                  placeholder="FR76 ..."
                  autoComplete="off"
                />
              </div>

              <div className="bi-field">
                <label className="bi-label">
                  Suppression automatique après
                </label>
                <div className="bi-duration-group">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      className={`bi-duration ${durationDays === d.days ? "active" : ""}`}
                      onClick={() => setDurationDays(d.days)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="bi-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>
                  J'ai lu l'avertissement et je souhaite partager mon RIB.
                </span>
              </label>

              <div className="bi-actions">
                <button
                  className="bi-btn bi-btn-ghost"
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                >
                  Annuler
                </button>
                <motion.button
                  className="bi-btn bi-btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  whileTap={{ scale: 0.98 }}
                >
                  {saving ? "Enregistrement…" : "Enregistrer le RIB"}
                </motion.button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BankInfoManager;

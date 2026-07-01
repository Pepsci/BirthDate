import React, { useState } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import "./css/bankInfo.css";

const PaypalManager = ({ shortId, paypalEnabled, paypalLink }) => {
  const [enabled, setEnabled] = useState(paypalEnabled || false);
  const [link, setLink] = useState(paypalLink || "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(!!paypalLink);
  const [error, setError] = useState("");

  const handleToggle = async () => {
    const next = !enabled;
    setToggling(true);
    setError("");
    try {
      await apiHandler.put(`/events/${shortId}/direct-transfer/paypal`, {
        enabled: next,
        paypalLink: next ? link : "",
      });
      setEnabled(next);
      if (!next) {
        setSaved(false);
        setLink("");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await apiHandler.put(
        `/events/${shortId}/direct-transfer/paypal`,
        { enabled: true, paypalLink: link },
      );
      setLink(res.data.paypalLink);
      setEnabled(true);
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Lien PayPal invalide.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bi-manager">
      <label className="bi-toggle-row">
        <span>Activer le paiement par PayPal</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          disabled={toggling}
        />
      </label>

      {error && <p className="bi-error">{error}</p>}

      {enabled && (
        <>
          <div className="bi-field">
            <label className="bi-label">Votre lien PayPal.Me</label>
            <input
              type="text"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setSaved(false);
              }}
              className="bi-input"
              placeholder="https://paypal.me/votrepseudo"
              autoComplete="off"
            />
          </div>

          {saved ? (
            <div className="bi-status">
              <i className="fa-solid fa-circle-check"></i>
              <div>
                <p className="bi-status-title">Lien PayPal enregistré</p>
                <p className="bi-status-sub">
                  Les participants pourront vous envoyer un paiement
                  directement.
                </p>
              </div>
            </div>
          ) : (
            <motion.button
              className="bi-btn bi-btn-primary"
              onClick={handleSave}
              disabled={saving}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer le lien"}
            </motion.button>
          )}

          <p className="bi-muted">
            Le paiement se fait directement sur votre compte PayPal, en dehors
            de BirthReminder.
          </p>
        </>
      )}
    </div>
  );
};

export default PaypalManager;

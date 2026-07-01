import React, { useState } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import "./css/bankInfo.css";

const BankInfoViewer = ({ shortId }) => {
  const [revealed, setRevealed] = useState(false);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleReveal = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiHandler.get(`/events/${shortId}/bank-info`);
      if (res.data?.exists) {
        setInfo(res.data);
        setRevealed(true);
      } else {
        setError("Aucun RIB disponible pour cet événement.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Impossible d'afficher le RIB.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (info?.iban) {
      navigator.clipboard.writeText(info.iban.replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!revealed) {
    return (
      <div className="bi-viewer">
        <p className="bi-viewer-intro">
          <i className="fa-solid fa-building-columns"></i> L'organisateur
          propose un virement direct par RIB.
        </p>
        <button
          className="bi-btn bi-btn-primary"
          onClick={handleReveal}
          disabled={loading}
        >
          {loading ? "Chargement…" : "Afficher le RIB"}
        </button>
        {error && <p className="bi-error">{error}</p>}
      </div>
    );
  }

  return (
    <motion.div
      className="bi-viewer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {info.holderName && (
        <div className="bi-detail-row">
          <span className="bi-detail-label">Titulaire</span>
          <span className="bi-detail-value">{info.holderName}</span>
        </div>
      )}
      <div className="bi-detail-row">
        <span className="bi-detail-label">IBAN</span>
        <span className="bi-detail-value bi-iban">{info.iban}</span>
      </div>
      <button
        className="bi-btn bi-btn-primary bi-btn-full"
        onClick={handleCopy}
      >
        <i className="fa-solid fa-copy"></i>{" "}
        {copied ? "Copié !" : "Copier l'IBAN"}
      </button>
      <p className="bi-viewer-note">
        Ce virement se fait directement vers l'organisateur, en dehors de
        BirthReminder.
      </p>
    </motion.div>
  );
};

export default BankInfoViewer;

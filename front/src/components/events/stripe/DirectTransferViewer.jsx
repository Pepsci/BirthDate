import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import "./css/bankInfo.css";

const DirectTransferViewer = ({ shortId, directTransfer }) => {
  const dt = directTransfer || {};
  const [ibanExists, setIbanExists] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!dt.ibanEnabled) {
      setIbanExists(false);
      return;
    }
    const checkExists = async () => {
      try {
        const res = await apiHandler.get(`/events/${shortId}/bank-info/exists`);
        setIbanExists(!!res.data?.exists);
      } catch {
        setIbanExists(false);
      }
    };
    checkExists();
  }, [shortId, dt.ibanEnabled]);

  const handleReveal = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiHandler.get(`/events/${shortId}/bank-info`);
      if (res.data?.exists) {
        setInfo(res.data);
        setRevealed(true);
      } else {
        setError("Aucun RIB disponible.");
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

  // Aucune option activée → rien
  if (!dt.ibanEnabled && !dt.paypalEnabled) return null;

  return (
    <div className="bi-viewer">
      {/* ---- PayPal ---- */}
      {dt.paypalEnabled && dt.paypalLink && (
        <div className="bi-method">
          <p className="bi-viewer-intro">
            <i className="fa-brands fa-paypal"></i> Paiement par PayPal
          </p>

          <a
            href={dt.paypalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bi-btn bi-btn-primary bi-btn-full"
          >
            <i className="fa-brands fa-paypal"></i> Payer via PayPal
          </a>
        </div>
      )}

      {/* PayPal activé mais lien pas encore renseigné */}
      {dt.paypalEnabled && !dt.paypalLink && (
        <p className="bi-muted">
          <i className="fa-brands fa-paypal"></i> L'organisateur a activé PayPal
          mais n'a pas encore renseigné son lien.
        </p>
      )}

      {/* ---- IBAN ---- */}
      {dt.ibanEnabled && (
        <div className="bi-method">
          {ibanExists === null ? (
            <p className="bi-muted">Vérification…</p>
          ) : ibanExists === false ? (
            <p className="bi-muted">
              <i className="fa-solid fa-building-columns"></i> L'organisateur a
              activé le virement par RIB mais n'a pas encore renseigné ses
              informations.
            </p>
          ) : !revealed ? (
            <>
              <p className="bi-viewer-intro">
                <i className="fa-solid fa-building-columns"></i> Virement direct
                par RIB.
              </p>
              <button
                className="bi-btn bi-btn-primary bi-btn-full"
                onClick={handleReveal}
                disabled={loading}
              >
                {loading ? "Chargement…" : "Afficher le RIB"}
              </button>
              {error && <p className="bi-error">{error}</p>}
            </>
          ) : (
            <motion.div
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
            </motion.div>
          )}
        </div>
      )}

      <p className="bi-viewer-note">
        Ces paiements se font directement vers l'organisateur, en dehors de
        BirthReminder.
      </p>
    </div>
  );
};

export default DirectTransferViewer;

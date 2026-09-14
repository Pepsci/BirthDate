import React, { useState } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import "./css/bankInfo.css";

/*
 * Lien vers une cagnotte tenue sur un AUTRE service.
 *
 * Beaucoup d'organisateurs ont déjà ouvert une cagnotte ailleurs, ou préfèrent
 * un service qu'ils connaissent. Sans cet emplacement, ils collent le lien
 * dans le chat de l'événement — où il descend sous les messages et devient
 * invisible pour les invités arrivés plus tard.
 *
 * ⚠️ Ce qui compte ici, c'est l'honnêteté de l'affichage : BirthReminder n'a
 * aucune visibilité sur ces collectes. Ni montant, ni contributeurs, ni preuve
 * de versement, ni remboursement possible. L'organisateur doit le comprendre
 * avant d'activer, et l'invité avant de cliquer.
 */
const ExternalPoolManager = ({
  shortId,
  externalPoolEnabled,
  externalPoolUrl,
  externalPoolLabel,
}) => {
  const [enabled, setEnabled] = useState(externalPoolEnabled || false);
  const [url, setUrl] = useState(externalPoolUrl || "");
  const [label, setLabel] = useState(externalPoolLabel || "");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(!!externalPoolUrl);
  const [error, setError] = useState("");

  const save = async (nextEnabled, nextUrl) => {
    const res = await apiHandler.put(
      `/events/${shortId}/direct-transfer/external-pool`,
      { enabled: nextEnabled, url: nextUrl, label },
    );
    return res.data;
  };

  const handleToggle = async () => {
    const next = !enabled;
    setToggling(true);
    setError("");
    try {
      // À l'activation sans lien encore saisi, on n'envoie rien au serveur :
      // il refuserait (le lien est obligatoire quand c'est activé). On ouvre
      // simplement le formulaire.
      if (next && !url.trim()) {
        setEnabled(true);
        return;
      }
      await save(next, next ? url : "");
      setEnabled(next);
      if (!next) {
        setSaved(false);
        setUrl("");
        setLabel("");
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
      const data = await save(true, url);
      setUrl(data.externalPoolUrl);
      setLabel(data.externalPoolLabel || "");
      setEnabled(true);
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Lien invalide.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bi-manager">
      <label className="bi-toggle-row">
        <span>Proposer une cagnotte sur un autre service</span>
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
            <label className="bi-label">Lien de la cagnotte</label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSaved(false);
              }}
              className="bi-input"
              placeholder="https://www.leetchi.com/c/..."
              autoComplete="off"
              inputMode="url"
            />
          </div>

          <div className="bi-field">
            <label className="bi-label">Nom affiché (optionnel)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setSaved(false);
              }}
              className="bi-input"
              placeholder="Notre cagnotte Leetchi"
              maxLength={60}
              autoComplete="off"
            />
          </div>

          {saved ? (
            <div className="bi-status">
              <i className="fa-solid fa-circle-check"></i>
              <div>
                <p className="bi-status-title">Lien enregistré</p>
                <p className="bi-status-sub">
                  Vos invités le verront sur la page de l'événement.
                </p>
              </div>
            </div>
          ) : (
            <motion.button
              className="bi-btn bi-btn-primary"
              onClick={handleSave}
              disabled={saving || !url.trim()}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer le lien"}
            </motion.button>
          )}

          {/* Dit une fois, clairement, ce que ça implique pour lui. */}
          <p className="bi-muted">
            La collecte se déroule entièrement sur le service que vous avez
            choisi. BirthReminder n'en voit ni les montants ni les
            participants, ne peut rien confirmer en cas de litige et ne pourra
            rien rembourser : vos invités devront s'adresser à vous, ou à ce
            service.
          </p>
        </>
      )}
    </div>
  );
};

export default ExternalPoolManager;

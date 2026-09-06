import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import { euro } from "./lib/stripeFees";
import "./css/giftPool.css";

const GiftPoolManager = ({ shortId, pool, onUpdated }) => {
  const [connectStatus, setConnectStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  // ── Remboursement ─────────────────────────────────────────────────────────
  // Chargé séparément de la cagnotte : le bloc reste pertinent quand celle-ci
  // est DÉJÀ fermée par une annulation ou un transfert d'organisation — c'est
  // même précisément là qu'on en a besoin.
  const [refund, setRefund] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [refundConfirm, setRefundConfirm] = useState(false);

  const fetchRefundPreview = async () => {
    try {
      const res = await apiHandler.get(`/events/${shortId}/pool/refund-preview`);
      setRefund(res.data);
    } catch {
      // 403 si on n'est pas l'organisateur : le bloc reste simplement masqué.
      setRefund(null);
    }
  };

  const handleRefundAll = async () => {
    if (!refundConfirm) {
      setRefundConfirm(true);
      return;
    }
    setRefunding(true);
    setError("");
    try {
      const res = await apiHandler.post(`/events/${shortId}/pool/refund-all`);
      const report = res.data;
      await fetchRefundPreview();
      onUpdated?.();
      window.alert(
        report.failed === 0
          ? `${report.refunded} remboursement${report.refunded > 1 ? "s" : ""} envoyé${report.refunded > 1 ? "s" : ""}. Les contributeurs seront prévenus dès que Stripe les confirme.`
          : `${report.refunded} réussi${report.refunded > 1 ? "s" : ""}, ${report.failed} en échec. Vous pouvez relancer : seules les contributions non remboursées seront reprises.`,
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Erreur lors du remboursement.",
      );
    } finally {
      setRefunding(false);
      setRefundConfirm(false);
    }
  };

  // Form state
  const [active, setActive] = useState(pool?.active || false);
  const [mode, setMode] = useState(pool?.mode || "free");
  const [goalEuros, setGoalEuros] = useState(
    pool?.goal ? String(pool.goal / 100) : "",
  );

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await apiHandler.get("/stripe/connect/status");
      setConnectStatus(res.data);
    } catch {
      setConnectStatus({ connected: false, ready: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchRefundPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId]);

  const handleConnect = async () => {
    setOnboarding(true);
    setError("");
    try {
      const res = await apiHandler.post("/stripe/connect/onboard");
      window.location.href = res.data.url;
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Impossible de démarrer la connexion Stripe.",
      );
      setOnboarding(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSavedOk(false);
    try {
      const payload = {
        active,
        mode,
        goal:
          mode === "goal" && goalEuros
            ? Math.round(Number(goalEuros) * 100)
            : null,
      };
      const res = await apiHandler.put(`/events/${shortId}/pool`, payload);
      onUpdated?.(res.data);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err) {
      if (err?.response?.data?.code === "STRIPE_NOT_READY") {
        setError(
          "Connectez d'abord votre compte Stripe pour activer la cagnotte.",
        );
      } else {
        setError(
          err?.response?.data?.message || "Erreur lors de l'enregistrement.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const ready = connectStatus?.ready;

  const exampleGross = 2000;
  const exampleFee = Math.round(exampleGross * 0.015) + 25;
  const exampleNet = exampleGross - exampleFee;

  return (
    <div className="gp-manager">
      <div className="gp-section">
        <h4 className="gp-section-title">
          <i className="fa-brands fa-stripe-s"></i> Compte de paiement
        </h4>

        {loadingStatus ? (
          <p className="gp-muted">Vérification du compte…</p>
        ) : ready ? (
          <div className="gp-status gp-status-ok">
            <i className="fa-solid fa-circle-check"></i>
            <span>
              Compte Stripe connecté — vous pouvez encaisser une cagnotte.
            </span>
          </div>
        ) : (
          <div className="gp-connect-prompt">
            <p className="gp-muted">
              {connectStatus?.connected
                ? "Votre compte Stripe n'est pas encore finalisé."
                : "Connectez un compte Stripe pour recevoir les contributions directement."}
            </p>
            <motion.button
              className="gp-btn gp-btn-primary"
              onClick={handleConnect}
              disabled={onboarding}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {onboarding
                ? "Redirection…"
                : connectStatus?.connected
                  ? "Finaliser mon compte"
                  : "Connecter Stripe"}
            </motion.button>
          </div>
        )}
      </div>

      <div className="gp-section">
        <h4 className="gp-section-title">
          <i className="fa-solid fa-piggy-bank"></i> Cagnotte
        </h4>

        <label className="gp-toggle-row">
          <span>Activer la cagnotte</span>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={!ready}
          />
        </label>

        {active && (
          <>
            <div className="gp-field">
              <label className="gp-label">Type de cagnotte</label>
              <div className="gp-radio-group">
                <label
                  className={`gp-radio ${mode === "free" ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="poolMode"
                    value="free"
                    checked={mode === "free"}
                    onChange={() => setMode("free")}
                  />
                  Libre
                </label>
                <label
                  className={`gp-radio ${mode === "goal" ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="poolMode"
                    value="goal"
                    checked={mode === "goal"}
                    onChange={() => setMode("goal")}
                  />
                  Avec objectif
                </label>
              </div>
            </div>

            {mode === "goal" && (
              <div className="gp-field">
                <label className="gp-label">Montant objectif (€)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={goalEuros}
                  onChange={(e) => setGoalEuros(e.target.value)}
                  className="gp-input"
                  placeholder="Ex : 150"
                />
              </div>
            )}

            <div className="gp-fee-notice">
              <i className="fa-solid fa-circle-info"></i>
              <div>
                <p className="gp-fee-notice-title">Frais de paiement</p>
                <p className="gp-fee-notice-text">
                  Stripe prélève environ <strong>1,5 % + 0,25 €</strong> par
                  contribution (carte européenne standard). Ces frais sont
                  déduits automatiquement ; vous recevez le montant net sur
                  votre compte bancaire. Exemple : pour une contribution de{" "}
                  {euro(exampleGross)}, vous recevez environ {euro(exampleNet)}.
                </p>
                <p className="gp-fee-notice-text">
                  Les contributions sont{" "}
                  <strong>versées automatiquement</strong> sur le compte
                  bancaire associé à votre compte Stripe.
                </p>
              </div>
            </div>
          </>
        )}

        {error && <p className="gp-error">{error}</p>}
        {savedOk && (
          <motion.p
            className="gp-saved-ok"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <i className="fa-solid fa-circle-check"></i> Cagnotte enregistrée.
          </motion.p>
        )}

        <motion.button
          className="gp-btn gp-btn-primary gp-btn-full"
          onClick={handleSave}
          disabled={saving || (active && !ready)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {saving
            ? "Enregistrement…"
            : savedOk
              ? "Enregistré ✓"
              : "Enregistrer"}
        </motion.button>
      </div>

      {refund?.count > 0 && (
        <div className="gp-section">
          <p className="gp-section-title">💸 Rembourser les contributeurs</p>
          <p className="gp-muted">
            {refund.count} contribution{refund.count > 1 ? "s" : ""} —{" "}
            <strong>{euro(refund.totalRefunded)}</strong> seront intégralement
            rendus à leurs auteurs.
          </p>
          {/* ⚠️ Le chiffre qui compte pour l'organisateur. Stripe ne restitue
              pas les frais de la transaction d'origine : le contributeur
              récupère tout, et l'écart reste à sa charge. Le découvrir après
              coup serait une mauvaise surprise. */}
          <p className="gp-refund-warn">
            ⚠️ Cette opération vous coûtera <strong>{euro(refund.feeLoss)}</strong> :
            Stripe ne rend pas les frais des paiements d'origine. La cagnotte
            sera fermée, et l'opération est irréversible.
          </p>
          {error && <p className="gp-error">{error}</p>}
          <motion.button
            className="gp-btn gp-btn-full gp-btn-danger"
            onClick={handleRefundAll}
            disabled={refunding}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {refunding
              ? "Remboursement en cours…"
              : refundConfirm
                ? "Confirmer le remboursement de tout le monde ?"
                : "Rembourser tout le monde"}
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default GiftPoolManager;

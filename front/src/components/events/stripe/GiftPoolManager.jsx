import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import apiHandler from "../../../api/apiHandler";
import { euro } from "./lib/stripeFees";
import ConfirmModal from "../../UI/ConfirmModal";
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

  /*
   * Solde du compte connecté.
   *
   * ⚠️ « Où est mon argent ? » est LA question de l'organisateur, et
   * l'application n'y répondait pas du tout : il fallait retrouver un vieil
   * email de Stripe. Un solde à zéro veut d'ailleurs presque toujours dire
   * « déjà viré sur votre banque » — d'où l'affichage des derniers virements
   * à côté, sans lesquels un zéro inquiète au lieu de rassurer.
   */
  const [balance, setBalance] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  /*
   * Déconnexion du compte de paiement.
   *
   * ⚠️ Sans ce bouton, un organisateur qui a créé un compte Stripe une fois
   * n'avait aucun moyen de revenir en arrière depuis l'application. Avec des
   * comptes Standard — de vrais comptes Stripe lui appartenant — pouvoir
   * couper le lien est une attente légitime.
   *
   * Le serveur refuse tant qu'il reste des contributions encaissées non
   * remboursées : couper le lien rendrait tout remboursement impossible,
   * alors que l'obligation de rendre l'argent, elle, subsiste.
   */
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const disconnect = async () => {
    setDisconnecting(true);
    setError("");
    try {
      await apiHandler.delete("/stripe/connect/account");
      setConfirmDisconnect(false);
      setBalance(null);
      await fetchStatus();
      onUpdated?.();
    } catch (err) {
      setConfirmDisconnect(false);
      setError(
        err?.response?.data?.message ||
          "Impossible de déconnecter votre compte.",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await apiHandler.get("/stripe/connect/balance");
      setBalance(res.data);
    } catch {
      setBalance(null);
    }
  };

  const openDashboard = async () => {
    setDashLoading(true);
    setError("");

    // ⚠️ L'onglet doit être ouvert MAINTENANT, pas après l'appel réseau.
    //
    // Un `window.open` exécuté après un `await` a perdu le contexte du clic :
    // les navigateurs le traitent comme une fenêtre surgissante non
    // sollicitée et la bloquent, silencieusement. Aucune erreur, aucun
    // onglet — exactement le symptôme « le bouton ne fait rien ».
    //
    // On ouvre donc l'onglet dans la foulée du clic, puis on y pose l'adresse
    // quand elle arrive. Si l'ouverture a quand même été refusée, on le dit
    // au lieu de laisser croire à une panne.
    const tab = window.open("", "_blank", "noopener,noreferrer");

    try {
      const res = await apiHandler.post("/stripe/connect/dashboard");
      if (tab) {
        tab.location.href = res.data.url;
      } else {
        setError(
          "Votre navigateur a bloqué l'ouverture du tableau de bord Stripe. " +
            "Autorisez les fenêtres surgissantes pour ce site, ou rendez-vous " +
            "sur dashboard.stripe.com.",
        );
      }
    } catch (err) {
      // L'onglet a été ouvert avant l'appel : le refermer, sinon l'organisateur
      // se retrouve avec une page blanche sans explication.
      tab?.close();
      const d = err?.response?.data;
      setError(
        [
          d?.message || "Impossible d'ouvrir votre tableau de bord Stripe.",
          d?.detail,
        ]
          .filter(Boolean)
          .join(" — "),
      );
    } finally {
      setDashLoading(false);
    }
  };

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
    fetchBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortId]);

  const handleConnect = async () => {
    setOnboarding(true);
    setError("");
    try {
      const res = await apiHandler.post("/stripe/connect/onboard");
      window.location.href = res.data.url;
    } catch (err) {
      // Le `detail` porte le message exact de Stripe (champ refusé, URL non
      // publique…). Sans lui, l'utilisateur — et toi en développement — restez
      // devant une erreur générique sans piste.
      const d = err?.response?.data;
      setError(
        [d?.message || "Impossible de démarrer la connexion Stripe.", d?.detail]
          .filter(Boolean)
          .join(" — "),
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
          <>
            <div className="gp-status gp-status-ok">
              <i className="fa-solid fa-circle-check"></i>
              <span>
                Compte Stripe connecté — vous pouvez encaisser une cagnotte.
              </span>
            </div>

            {balance?.connected && (
              <div className="gp-balance">
                <div className="gp-balance-row">
                  <span>Disponible</span>
                  <strong>{euro(balance.availableCents)}</strong>
                </div>
                {balance.pendingCents > 0 && (
                  <div className="gp-balance-row">
                    <span>En attente de règlement</span>
                    <strong>{euro(balance.pendingCents)}</strong>
                  </div>
                )}

                {balance.payouts?.length > 0 ? (
                  <p className="gp-balance-note">
                    Dernier virement : {euro(balance.payouts[0].amount)}
                    {balance.payouts[0].arrivalDate && (
                      <>
                        {" "}
                        — arrivée le{" "}
                        {new Date(
                          balance.payouts[0].arrivalDate,
                        ).toLocaleDateString("fr-FR")}
                      </>
                    )}
                  </p>
                ) : (
                  <p className="gp-balance-note">
                    Aucun virement pour l'instant. Stripe verse automatiquement
                    sur votre compte bancaire selon son calendrier.
                  </p>
                )}

                <motion.button
                  className="gp-btn gp-btn-ghost gp-btn-full"
                  onClick={openDashboard}
                  disabled={dashLoading}
                  whileTap={{ scale: 0.98 }}
                >
                  {dashLoading
                    ? "Ouverture…"
                    : "Voir mes virements sur Stripe"}
                </motion.button>
                <p className="gp-balance-hint">
                  Solde, virements et coordonnées bancaires se gèrent depuis
                  votre tableau de bord Stripe, avec les identifiants du compte
                  créé lors de la configuration.
                </p>

                <button
                  type="button"
                  className="gp-disconnect"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Déconnecter mon compte de paiement
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="gp-connect-prompt">
            <p className="gp-muted">
              {connectStatus?.connected
                ? "Votre compte Stripe n'est pas encore finalisé."
                : "Créez votre compte Stripe pour recevoir les contributions directement. C'est votre compte : vous y gérez vos virements, et BirthReminder ne détient jamais l'argent."}
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
                  : "Créer mon compte Stripe"}
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

        {/* ── Ce que l'organisateur s'engage à faire ────────────────────
            Posé ICI, juste après l'interrupteur, et non enterré dans les CGU :
            ouvrir une cagnotte crée une obligation de remboursement en cas
            d'annulation, et cette obligation coûte de l'argent. La découvrir
            au moment d'annuler serait la découvrir trop tard. */}
        {active && (
          <div className="gp-commit">
            <p className="gp-commit-title">Ce que vous vous engagez à faire</p>
            <p className="gp-commit-text">
              L'argent arrive directement sur votre compte Stripe :
              BirthReminder ne le détient jamais et n'intervient à aucun moment
              sur les fonds. Vous restez le seul responsable de la cagnotte
              vis-à-vis des contributeurs.
            </p>
            <p className="gp-commit-text">
              À savoir : si vous remboursez une contribution, les frais prélevés
              lors du paiement d'origine ne vous sont pas restitués par Stripe.
            </p>
            <p className="gp-commit-links">
              <a
                href="https://stripe.com/fr/legal/connect-account"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contrat de compte Stripe Connect
              </a>
              <span aria-hidden="true"> · </span>
              <a
                href="https://stripe.com/fr/legal/ssa"
                target="_blank"
                rel="noopener noreferrer"
              >
                Conditions des services Stripe
              </a>
            </p>
          </div>
        )}

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
            ⚠️ Cette opération vous coûtera{" "}
            {refund.estimatedCount > 0 ? "environ " : ""}
            <strong>{euro(refund.feeLoss)}</strong> : Stripe ne rend pas les
            frais des paiements d'origine. La cagnotte sera fermée, et
            l'opération est irréversible.
          </p>
          {/* Les frais dépendent de la carte de chaque contributeur — 1,5 %
              pour une carte européenne standard, jusqu'à 3,15 % plus
              conversion pour une carte étrangère. On les relève désormais à
              l'encaissement ; pour les contributions plus anciennes il ne
              reste qu'une estimation, et l'annoncer comme un chiffre exact
              serait mentir sur une opération irréversible. */}
          {refund.estimatedCount > 0 && (
            <p className="gp-refund-note">
              {refund.estimatedCount} contribution
              {refund.estimatedCount > 1 ? "s" : ""} sur {refund.count} est
              chiffrée au tarif d'une carte européenne standard. Le coût réel
              peut être plus élevé si le paiement venait d'une carte
              professionnelle ou étrangère.
            </p>
          )}
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

      <ConfirmModal
        open={confirmDisconnect}
        title="Déconnecter votre compte de paiement ?"
        message={
          "Vos cagnottes encore ouvertes seront fermées et vous ne pourrez " +
          "plus encaisser de contributions. Vous pourrez reconnecter un " +
          "compte plus tard, mais il faudra refaire la vérification Stripe."
        }
        confirmLabel="Déconnecter"
        tone="danger"
        busy={disconnecting}
        onConfirm={disconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
};

export default GiftPoolManager;

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import apiHandler from "../../../api/apiHandler";
import { getStripe } from "./lib/stripeClient";
import "./css/giftPool.css";

const PRESET_AMOUNTS = [1000, 2000, 5000]; // centimes : 10€, 20€, 50€

// Étape paiement (à l'intérieur du provider Elements)
const PaymentStep = ({ onSuccess, onBack }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Vérifiez vos informations de paiement.");
      setSubmitting(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Le paiement a échoué.");
      setSubmitting(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="gp-pay-step">
      <PaymentElement />
      {error && <p className="gp-error">{error}</p>}
      <div className="gp-modal-actions">
        <button
          className="gp-btn gp-btn-ghost"
          onClick={onBack}
          disabled={submitting}
        >
          Retour
        </button>
        <motion.button
          className="gp-btn gp-btn-primary"
          onClick={handlePay}
          disabled={!stripe || submitting}
          whileTap={{ scale: 0.98 }}
        >
          {submitting ? "Paiement…" : "Confirmer le paiement"}
        </motion.button>
      </div>
    </div>
  );
};

const ContributeModal = ({ shortId, onClose, onSuccess }) => {
  const [step, setStep] = useState("amount"); // amount | pay | done
  const [amount, setAmount] = useState(2000);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Bloque le scroll du body quand le modal est ouvert
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const effectiveAmount = customAmount
    ? Math.round(Number(customAmount) * 100)
    : amount;

  const handleContinue = async () => {
    setError("");
    if (!effectiveAmount || effectiveAmount < 100) {
      setError("Le montant minimum est de 1 €.");
      return;
    }
    setCreating(true);
    try {
      const res = await apiHandler.post(`/events/${shortId}/pool/contribute`, {
        amount: effectiveAmount,
        message: message || undefined,
        anonymous,
        guestName: guestName || undefined,
      });
      setClientSecret(res.data.clientSecret);
      setStripeAccountId(res.data.stripeAccountId);
      setStep("pay");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Impossible de préparer le paiement.",
      );
    } finally {
      setCreating(false);
    }
  };

  const modalContent = (
    <motion.div
      className="gp-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="gp-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="gp-modal-close" onClick={onClose}>
          <i className="fa-solid fa-xmark"></i>
        </button>

        {step === "amount" && (
          <>
            <h3 className="gp-modal-title">Participer à la cagnotte</h3>

            <div className="gp-amount-presets">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  className={`gp-preset ${!customAmount && amount === a ? "active" : ""}`}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount("");
                  }}
                >
                  {a / 100} €
                </button>
              ))}
            </div>

            <div className="gp-field">
              <label className="gp-label">Autre montant (€)</label>
              <input
                type="number"
                min="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="gp-input"
                placeholder="Montant libre"
              />
            </div>

            <div className="gp-field">
              <label className="gp-label">Message (optionnel)</label>
              <input
                type="text"
                maxLength={280}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="gp-input"
                placeholder="Joyeux anniversaire !"
              />
            </div>

            <div className="gp-field">
              <label className="gp-label">Votre nom (si non connecté)</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="gp-input"
                placeholder="Votre prénom"
              />
            </div>

            <label className="gp-toggle-row">
              <span>Rester anonyme</span>
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
            </label>

            {error && <p className="gp-error">{error}</p>}

            <motion.button
              className="gp-btn gp-btn-primary gp-btn-full"
              onClick={handleContinue}
              disabled={creating}
              whileTap={{ scale: 0.98 }}
            >
              {creating
                ? "Préparation…"
                : `Contribuer ${(effectiveAmount / 100).toFixed(2)} €`}
            </motion.button>
          </>
        )}

        {step === "pay" && clientSecret && (
          <>
            <h3 className="gp-modal-title">Paiement sécurisé</h3>
            <Elements
              stripe={getStripe(stripeAccountId)}
              options={{
                clientSecret,
                appearance: { theme: "stripe" },
              }}
            >
              <PaymentStep
                onSuccess={() => setStep("done")}
                onBack={() => setStep("amount")}
              />
            </Elements>
          </>
        )}

        {step === "done" && (
          <div className="gp-done">
            <div className="gp-done-icon">🎉</div>
            <h3>Merci pour votre contribution !</h3>
            <p className="gp-muted">
              Votre paiement est en cours de confirmation. Il apparaîtra dans la
              cagnotte dans un instant.
            </p>
            <motion.button
              className="gp-btn gp-btn-primary gp-btn-full"
              onClick={onSuccess}
              whileTap={{ scale: 0.98 }}
            >
              Fermer
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
};

export default ContributeModal;

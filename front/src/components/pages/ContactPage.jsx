import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import apiHandler from "../../api/apiHandler";
import Logo from "../UI/Logo";
import "./css/contactPage.css";

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSend = emailOk && subject.trim() && message.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiHandler.post("/support/public", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(
        err?.response?.data?.message ?? "Erreur lors de l'envoi du message.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="contact-page">
      <Helmet>
        <title>Contact – BirthReminder</title>
        <meta
          name="description"
          content="Contactez l'équipe BirthReminder : question, bug ou suggestion."
        />
      </Helmet>

      <div className="contact-header">
        <Link to="/" className="contact-back">
          ← Retour
        </Link>
        <Logo className="contact-logo" />
      </div>

      <div className="contact-card">
        {sent ? (
          <div className="contact-done">
            <div className="contact-done-emoji">✅</div>
            <h1>Message envoyé</h1>
            <p>Merci ! Notre équipe te répondra par email dès que possible.</p>
            <Link to="/" className="contact-btn">
              Retour à l'accueil
            </Link>
          </div>
        ) : (
          <>
            <div className="contact-hero-emoji">✉️</div>
            <h1 className="contact-title">Contacter le support</h1>
            <p className="contact-desc">
              Une question, un bug, une suggestion ? Écris-nous, on te répond par
              email.
            </p>

            {error && <p className="contact-error">{error}</p>}

            <form onSubmit={handleSubmit} className="contact-form">
              <label className="contact-label">Nom (optionnel)</label>
              <input
                className="contact-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom"
              />

              <label className="contact-label">Email *</label>
              <input
                className="contact-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
              />

              <div className="contact-label-row">
                <label className="contact-label">Objet *</label>
                <span className="contact-counter">
                  {subject.length}/{SUBJECT_MAX}
                </span>
              </div>
              <input
                className="contact-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                placeholder="Objet de ta demande"
                maxLength={SUBJECT_MAX}
                required
              />

              <div className="contact-label-row">
                <label className="contact-label">Message *</label>
                <span className="contact-counter">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <textarea
                className="contact-input contact-textarea"
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value.slice(0, MESSAGE_MAX))
                }
                placeholder="Décris ta demande…"
                rows={7}
                maxLength={MESSAGE_MAX}
                required
              />

              <button
                type="submit"
                className="contact-btn"
                disabled={!canSend || sending}
              >
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import apiHandler from "../../api/apiHandler";
import NamedayInput from "../dashboard/NamedayInput";
import "../dashboard/css/namedayInput.css";

const COMMENT_MAX = 1000;

/**
 * Signaler une fête incorrecte (page Contact).
 *
 * Formulaire court et structuré plutôt que le message libre : on demande le
 * prénom et, si la personne la connaît, la bonne date. Le serveur ajoute la
 * date que donne le calendrier aujourd'hui et construit le ticket (catégorie
 * "nameday") — l'admin voit « Mia : 29 septembre → proposé 15 août » et ouvre
 * le prénom dans l'onglet Fêtes en un clic.
 *
 * Pas bloqué par une conversation en cours sur un autre sujet (règle serveur :
 * un signalement ouvert par prénom).
 */
export default function NamedayReportForm({
  loggedIn,
  currentUser,
  initialName = "",
  onSent,
  onExisting,
  onCancel,
}) {
  const [firstName, setFirstName] = useState(initialName);
  const [expectedDate, setExpectedDate] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSend = firstName.trim() && (loggedIn || emailOk);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    const payload = {
      category: "nameday",
      namedayReport: {
        name: firstName.trim(),
        expectedDate: expectedDate || null,
      },
      message: comment.trim(),
    };
    try {
      if (loggedIn) {
        await apiHandler.post("/support", payload);
      } else {
        await apiHandler.post("/support/public", {
          ...payload,
          name: name.trim(),
          email: email.trim().toLowerCase(),
        });
      }
      onSent(loggedIn);
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.ticket) {
        setError(err.response.data.message);
        onExisting?.(err.response.data.ticket);
        return;
      }
      setError(err?.response?.data?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="contact-form-wrapper">
      <div className="contact-form-divider">
        <span>Fête incorrecte</span>
      </div>

      <p className="contact-desc">
        Un prénom fêté à la mauvaise date, ou pas fêté du tout ? Dis-nous
        lequel : on corrige le calendrier pour tout le monde.
      </p>

      {error && <p className="contact-error">{error}</p>}

      <form onSubmit={submit} className="contact-form">
        {loggedIn ? (
          <p className="contact-as-user">
            Envoyé en tant que{" "}
            <strong>
              {currentUser.name} {currentUser.surname || ""}
            </strong>{" "}
            ({currentUser.email})
          </p>
        ) : (
          <>
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
          </>
        )}

        <label className="contact-label">Prénom concerné *</label>
        <input
          className="contact-input"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value.slice(0, 60))}
          placeholder="Ex : Mia, Jean-Luc…"
          required
        />

        <label className="contact-label">Bonne date (si tu la connais)</label>
        <NamedayInput
          value={expectedDate}
          onChange={setExpectedDate}
          placeholder="Mois"
        />

        <div className="contact-label-row">
          <label className="contact-label">Précision (optionnel)</label>
          <span className="contact-counter">
            {comment.length}/{COMMENT_MAX}
          </span>
        </div>
        <textarea
          className="contact-input contact-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          placeholder="Ex : dans ma famille on la fête le 15 août"
          rows={3}
          maxLength={COMMENT_MAX}
        />

        <div className="contact-nameday-actions">
          <button type="submit" className="contact-btn" disabled={!canSend || sending}>
            {sending ? "Envoi…" : "Signaler"}
          </button>
          <button
            type="button"
            className="contact-btn contact-btn--ghost"
            onClick={onCancel}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

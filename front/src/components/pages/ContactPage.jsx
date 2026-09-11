import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import apiHandler from "../../api/apiHandler";
import useAuth from "../../context/useAuth";
import Logo from "../UI/Logo";
import HelpCenter from "./HelpCenter";
import "./css/contactPage.css";

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 2000;

export default function ContactPage() {
  const { isLoggedIn, currentUser } = useAuth();
  const loggedIn = Boolean(isLoggedIn && currentUser);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [sentLoggedIn, setSentLoggedIn] = useState(false);

  // Le centre d'aide est la première chose que voit l'utilisateur : le
  // formulaire ne s'affiche que quand il a cliqué "Contacter le support"
  // depuis une réponse consultée qui ne lui convenait pas (voir HelpCenter).
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef(null);

  // Un seul ticket actif à la fois (voir routes/support.js) : un utilisateur
  // connecté qui en a déjà un en cours continue cette conversation dans le
  // dashboard (onglet Support) plutôt que d'en ouvrir un nouveau ici. Un
  // ticket fermé (résolu) ne compte pas — il peut repartir sur un nouveau
  // sujet normalement.
  const [activeTicket, setActiveTicket] = useState(null);

  useEffect(() => {
    if (!loggedIn) return;
    apiHandler
      .get("/support/mine")
      .then((res) => {
        const list = res.data?.tickets || [];
        setActiveTicket(list.find((t) => t.status !== "closed") || null);
      })
      .catch(() => {});
  }, [loggedIn]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const canSend = loggedIn
    ? subject.trim() && message.trim()
    : emailOk && subject.trim() && message.trim();

  const handleNeedHelp = (context) => {
    // Déjà une conversation en cours : on continue là-bas plutôt que
    // d'ouvrir un nouveau sujet en parallèle.
    if (loggedIn && activeTicket) {
      navigate(`/home?tab=support&ticketId=${activeTicket._id}`);
      return;
    }
    setFormOpen(true);
    // On ne pré-remplit que si l'utilisateur n'a pas déjà commencé à écrire
    // son propre objet — jamais écraser ce qu'il a tapé.
    if (context && !subject.trim()) {
      setSubject(`Question non résolue : ${context}`.slice(0, SUBJECT_MAX));
    }
    // Laisse le temps au formulaire de s'afficher avant de scroller.
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      if (loggedIn) {
        await apiHandler.post("/support", {
          subject: subject.trim(),
          message: message.trim(),
        });
        setFormOpen(false);
        setSubject("");
        setMessage("");
        setSentLoggedIn(true);
      } else {
        await apiHandler.post("/support/public", {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
        });
        setSent(true);
      }
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.ticket) {
        // Course rare : un ticket actif a été créé entre-temps (autre onglet
        // par ex.) — on redirige plutôt que d'afficher une simple erreur.
        setActiveTicket(err.response.data.ticket);
        setFormOpen(false);
        navigate(`/home?tab=support&ticketId=${err.response.data.ticket._id}`);
        return;
      }
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
        ) : sentLoggedIn ? (
          <div className="contact-done">
            <div className="contact-done-emoji">✅</div>
            <h1>Message envoyé</h1>
            <p>
              Retrouve l'échange avec l'équipe dans l'onglet{" "}
              <strong>Support</strong> de ton espace, dès qu'elle t'aura
              répondu.
            </p>
            <Link to="/home?tab=support" className="contact-btn">
              Voir mes échanges
            </Link>
          </div>
        ) : (
          <>
            <div className="contact-hero-emoji">✉️</div>
            <h1 className="contact-title">Comment pouvons-nous t'aider ?</h1>
            <p className="contact-desc">
              Cherche ta réponse ci-dessous, ou passe directement au
              formulaire si tu préfères nous écrire.
            </p>

            {loggedIn && activeTicket && (
              <div className="contact-existing-thread-banner">
                <span>Tu as déjà une conversation avec le support.</span>
                <Link
                  to={`/home?tab=support&ticketId=${activeTicket._id}`}
                  className="contact-btn contact-btn--ghost"
                >
                  Voir mes échanges
                </Link>
              </div>
            )}

            <HelpCenter
              onNeedHelp={handleNeedHelp}
              hasActiveTicket={loggedIn && Boolean(activeTicket)}
            />

            {formOpen && (
              <div ref={formRef} className="contact-form-wrapper">
                <div className="contact-form-divider">
                  <span>Écris-nous</span>
                </div>

                {error && <p className="contact-error">{error}</p>}

                <form onSubmit={handleSubmit} className="contact-form">
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
                    onChange={(e) =>
                      setSubject(e.target.value.slice(0, SUBJECT_MAX))
                    }
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

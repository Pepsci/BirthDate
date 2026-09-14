import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

  /*
   * Chemin guidé « problème de cagnotte ».
   *
   * ⚠️ Nos conditions disent au contributeur de nous écrire quand
   * l'organisateur ne répond pas — mais rien ne structurait ce moment-là. Il
   * arrivait un ticket « bonjour j'ai payé quelque part et je n'ai rien reçu »,
   * sans montant, sans événement, sans référence : deux allers-retours avant
   * de pouvoir seulement identifier le paiement.
   *
   * Le gabarit demande ces éléments d'emblée. La dernière question — « avez-vous
   * contacté l'organisateur ? » — est la plus utile de toutes : c'est la
   * première marche de la procédure, et la grande majorité des situations se
   * règlent là. Connaître la réponse dès le premier message évite de la poser.
   */
  const poolIssueTemplate = (c) => ({
    subject: c?.eventTitle
      ? `Problème de cagnotte — ${c.eventTitle}`.slice(0, SUBJECT_MAX)
      : "Problème avec une cagnotte",
    message: [
      "— Ma contribution —",
      c?.amountLabel ? `Montant : ${c.amountLabel}` : "Montant : ",
      c?.dateLabel ? `Date : ${c.dateLabel}` : "Date : ",
      c?.eventTitle ? `Événement : ${c.eventTitle}` : "Événement : ",
      c?.organizer ? `Encaissé par : ${c.organizer}` : "Encaissé par : ",
      c?.reference ? `Référence de paiement : ${c.reference}` : "Référence de paiement : ",
      "",
      "— Ce qui se passe —",
      "",
      "",
      "— Ai-je déjà contacté l'organisateur ? —",
      "(oui, le … / pas encore)",
      "",
    ].join("\n"),
  });

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

  /*
   * Litige de cagnotte : on demande DE QUELLE cagnotte il s'agit.
   *
   * ⚠️ Ce n'est pas du confort. Sans cette sélection, le ticket arrive en
   * texte libre et il faut deviner l'événement pour retrouver le paiement.
   * Avec elle, le ticket porte l'identifiant de la cagnotte : l'admin ouvre
   * directement les contributions concernées.
   *
   * C'est aussi ce qui autorise la dérogation à la règle du ticket unique —
   * le serveur plafonne à un ticket ouvert par cagnotte, donc la liste des
   * contributions borne naturellement le nombre de fils possibles.
   */
  const [myContributions, setMyContributions] = useState(null);
  const [poolMode, setPoolMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  /*
   * ⚠️ Distinct de `selectedEvent`, et c'est le cœur du correctif : une
   * contribution dont l'événement a été supprimé n'a plus de `shortId`. Si la
   * catégorie dépendait de l'événement, ces demandes repartaient en « général »
   * et se faisaient refuser au profit d'une conversation en cours sur un autre
   * sujet — celui qui n'a pas été remboursé ne pouvait plus rien signaler.
   */
  const [isPoolIssue, setIsPoolIssue] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    apiHandler
      .get("/support/mine")
      .then((res) => {
        const list = res.data?.tickets || [];
        // ⚠️ Les tickets de cagnotte sont exclus du « ticket actif » : sinon un
        // litige d'argent en cours interdirait toute autre question, ce qui
        // ferait réapparaître le blocage dans l'autre sens. Même règle que le
        // serveur (voir routes/support.js).
        setActiveTicket(
          list.find((t) => t.status !== "closed" && t.category !== "pool") ||
            null,
        );
      })
      .catch(() => {});
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    apiHandler
      .get("/events/mine/contributions")
      .then((res) => setMyContributions(res.data?.contributions || []))
      .catch(() => setMyContributions([]));
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

  const chooseContribution = (c) =>
    openPoolIssue({
      amountLabel: (c.amount / 100).toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
      }),
      dateLabel: new Date(c.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      eventTitle: c.event?.title || null,
      organizer: c.event?.organizer || null,
      reference: c.reference,
      eventShortId: c.event?.shortId || null,
    });

  /*
   * `prepared` vient de « Mes contributions » : tout est déjà connu, on ouvre
   * le formulaire directement. Sinon on demande d'abord de quelle cagnotte il
   * s'agit.
   *
   * ⚠️ Un litige de cagnotte n'est PAS bloqué par une conversation en cours
   * sur un autre sujet : c'est le seul cas où de l'argent est en jeu, et
   * c'était précisément celui que la règle du ticket unique empêchait. Le
   * serveur plafonne autrement — un ticket ouvert par cagnotte.
   */
  const openPoolIssue = (prepared) => {
    setIsPoolIssue(true);
    if (prepared) {
      setSelectedEvent(prepared.eventShortId || null);
      const tpl = poolIssueTemplate(prepared);
      setPoolMode(false);
      setFormOpen(true);
      if (!subject.trim()) setSubject(tpl.subject);
      if (!message.trim()) setMessage(tpl.message);
    } else {
      setPoolMode(true);
      setSelectedEvent(null);
    }
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  /*
   * Arrivée depuis « Mes contributions » : la contribution voyage dans l'état
   * de navigation, jamais dans l'URL — une référence de paiement n'a rien à
   * faire dans une barre d'adresse, ni dans un historique de navigateur.
   */
  useEffect(() => {
    const c = location.state?.poolIssue;
    if (!c) return;
    openPoolIssue(c);
    // Consommé une fois : un retour arrière ne doit pas ré-ouvrir le gabarit.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, activeTicket]);

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
          // La catégorie autorise le ticket malgré une autre conversation en
          // cours ; l'événement, quand on l'a, donne à l'admin un lien direct.
          // Les deux sont indépendants : un événement supprimé ne doit pas
          // faire retomber la demande en « général ».
          category: isPoolIssue ? "pool" : undefined,
          eventShortId: selectedEvent || undefined,
        });
        setFormOpen(false);
        setSubject("");
        setMessage("");
        setIsPoolIssue(false);
        setSelectedEvent(null);
        setPoolMode(false);
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
        // ⚠️ Ne jamais rediriger en silence : l'utilisateur vient d'écrire un
        // message, il doit comprendre pourquoi il atterrit sur une
        // conversation qui n'est pas celle qu'il ouvrait. Le cas s'était
        // produit en test et ressemblait à s'y méprendre à « le ticket ne se
        // crée pas ».
        const existing = err.response.data.ticket;
        setActiveTicket(existing);
        setError(
          `${err.response.data.message} Vous allez être redirigé vers cette conversation — votre message n'a pas été envoyé, pensez à le copier.`,
        );
        setTimeout(() => {
          setFormOpen(false);
          navigate(`/home?tab=support&ticketId=${existing._id}`);
        }, 2500);
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

            {/* Entrée dédiée : un litige de cagnotte engage de l'argent, il
                ne doit pas se perdre dans la liste des questions fréquentes. */}
            <button
              type="button"
              className="contact-pool-issue"
              onClick={() => openPoolIssue(null)}
            >
              <span className="contact-pool-issue-emoji">💶</span>
              <span>
                <strong>Un problème avec une cagnotte ?</strong>
                <small>
                  Contribution non remboursée, événement annulé, organisateur
                  injoignable — nous vous guidons.
                </small>
              </span>
            </button>

            <HelpCenter
              onNeedHelp={handleNeedHelp}
              onPoolIssue={() => openPoolIssue(null)}
              hasActiveTicket={loggedIn && Boolean(activeTicket)}
            />

            {/* Choix de la cagnotte concernée. C'est ce qui rattache le
                ticket à un événement précis : côté admin, le lien vers les
                contributions est immédiat au lieu de devoir deviner. */}
            {poolMode && !formOpen && (
              <div ref={formRef} className="contact-pool-picker">
                <p className="contact-pool-picker-title">
                  De quelle cagnotte s'agit-il ?
                </p>

                {myContributions === null ? (
                  <p className="contact-pool-picker-empty">Chargement…</p>
                ) : myContributions.length === 0 ? (
                  <>
                    <p className="contact-pool-picker-empty">
                      Aucune contribution n'est enregistrée sur votre compte.
                      Si vous avez participé sans être connecté, décrivez-nous
                      la situation en joignant le reçu reçu par email.
                    </p>
                    <button
                      type="button"
                      className="contact-btn"
                      onClick={() => openPoolIssue({})}
                    >
                      Continuer sans sélection
                    </button>
                  </>
                ) : (
                  myContributions
                    .filter((c) => c.status !== "refunded")
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="contact-pool-option"
                        onClick={() => chooseContribution(c)}
                      >
                        <strong>{c.event?.title || "Événement supprimé"}</strong>
                        <small>
                          {(c.amount / 100).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          ·{" "}
                          {new Date(c.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </small>
                      </button>
                    ))
                )}
              </div>
            )}

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

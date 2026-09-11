import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/supportThread.css";

const MESSAGE_MAX = 2000;
const STATUS_LABEL = { open: "Ouvert", answered: "Répondu", closed: "Fermé" };

// Fil de discussion d'un ticket support, affiché dans le même volet que
// ChatWindow quand l'onglet "Support" de ConversationList est sélectionné.
// Le ticket vient de Chat.jsx (état + mises à jour socket en direct) ;
// ce composant se contente d'afficher et d'envoyer les réponses.
export default function SupportThread({ ticket, onTicketUpdate }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const threadRef = useRef(null);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [ticket?._id, ticket?.messages?.length]);

  useEffect(() => {
    setReply("");
    setError(null);
  }, [ticket?._id]);

  if (!ticket) return null;

  const closed = ticket.status === "closed";

  const sendReply = async () => {
    if (!reply.trim() || sending || closed) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiHandler.post(`/support/mine/${ticket._id}/reply`, {
        message: reply.trim(),
      });
      onTicketUpdate?.(res.data.ticket);
      setReply("");
    } catch (err) {
      if (err?.response?.status === 409 && err?.response?.data?.ticket) {
        // Le ticket a été fermé entre-temps (l'admin vient de clore) : on
        // reflète l'état à jour plutôt que de laisser croire que ça a marché.
        onTicketUpdate?.(err.response.data.ticket);
      }
      setError(err?.response?.data?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <div className="support-thread">
      <div className="support-thread-header">
        <h3>{ticket.subject}</h3>
        <span
          className={`support-thread-status support-thread-status--${ticket.status}`}
        >
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <div className="support-thread-messages" ref={threadRef}>
        {ticket.messages.map((m, i) => (
          <div
            key={i}
            className={`support-thread-msg support-thread-msg--${m.sender}`}
          >
            <div className="support-thread-msg-body">{m.body}</div>
            <div className="support-thread-msg-meta">
              {m.sender === "admin" ? "Équipe BirthReminder" : "Toi"}
              {" · "}
              {new Date(m.createdAt).toLocaleString("fr-FR")}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="support-thread-error">{error}</p>}

      {closed ? (
        <div className="support-thread-closed">
          <span>✅ Problème résolu, ticket fermé.</span>
          <Link to="/contact">Ouvrir un nouveau sujet</Link>
        </div>
      ) : (
        <div className="support-thread-reply">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, MESSAGE_MAX))}
            onKeyDown={handleKeyDown}
            placeholder="Écrire une réponse…"
            rows={2}
            maxLength={MESSAGE_MAX}
          />
          <button
            type="button"
            disabled={!reply.trim() || sending}
            onClick={sendReply}
          >
            {sending ? "…" : "Envoyer"}
          </button>
        </div>
      )}
    </div>
  );
}

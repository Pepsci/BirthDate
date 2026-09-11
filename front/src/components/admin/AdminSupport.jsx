import React, { useEffect, useState, useCallback, useRef } from "react";
import apiHandler from "../../api/apiHandler";
import socketService from "../services/socket.service";
import "./css/admin.css";
import "./css/adminSupport.css";

const STATUS_LABEL = {
  open: "Ouvert",
  answered: "Répondu",
  closed: "Fermé",
};

const STATUS_TAG_CLASS = {
  open: "admin-tag-warning",
  answered: "admin-tag-success",
  closed: "admin-tag-danger",
};

const AdminSupport = () => {
  const [data, setData] = useState({ tickets: [], total: 0, page: 1, pages: 1 });
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadList = useCallback(() => {
    const params = new URLSearchParams({ page });
    if (status) params.set("status", status);
    apiHandler
      .get(`/admin/support?${params}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [page, status]);

  useEffect(loadList, [loadList]);

  // Les nouveaux tickets / réponses utilisateur arrivent en direct (room
  // "admin" côté serveur, voir server.js + routes/support.js) : sans ça il
  // fallait recharger la page pour les voir apparaître.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const socket = socketService.connect();

    const handleAdminSupportMessage = ({ ticket: updated }) => {
      if (!updated) return;
      setData((d) => {
        const exists = d.tickets.some((t) => t._id === updated._id);
        return {
          ...d,
          tickets: exists
            ? d.tickets.map((t) => (t._id === updated._id ? updated : t))
            : [updated, ...d.tickets],
        };
      });
      if (selectedIdRef.current === updated._id) {
        setTicket(updated);
      }
    };

    socket.on("admin:support:message", handleAdminSupportMessage);
    return () => {
      socket.off("admin:support:message", handleAdminSupportMessage);
    };
  }, []);

  const openTicket = (id) => {
    setSelectedId(id);
    setTicket(null);
    apiHandler
      .get(`/admin/support/${id}`)
      .then((res) => {
        setTicket(res.data.ticket);
        // Le badge "non lu" de la liste doit se mettre à jour immédiatement.
        setData((d) => ({
          ...d,
          tickets: d.tickets.map((t) =>
            t._id === id ? { ...t, unreadAdmin: false } : t,
          ),
        }));
      })
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  };

  const sendReply = async () => {
    if (!reply.trim() || sending || !ticket) return;
    setSending(true);
    try {
      const res = await apiHandler.post(`/admin/support/${ticket._id}/reply`, {
        message: reply.trim(),
      });
      setTicket(res.data.ticket);
      setReply("");
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (newStatus) => {
    if (!ticket) return;
    try {
      const res = await apiHandler.patch(`/admin/support/${ticket._id}`, {
        status: newStatus,
      });
      setTicket(res.data.ticket);
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur");
    }
  };

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Support ({data.total})</h1>

      <div className="admin-toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous statuts</option>
          <option value="open">Ouvert</option>
          <option value="answered">Répondu</option>
          <option value="closed">Fermé</option>
        </select>
      </div>

      <div className="support-layout">
        <div className="support-list">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>De</th>
                  <th>Objet</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => openTicket(t._id)}
                    className={
                      t._id === selectedId ? "support-row--active" : ""
                    }
                  >
                    <td>
                      {t.unreadAdmin && <span className="support-dot" />}
                      {new Date(t.lastMessageAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td>
                      {t.userId
                        ? `${t.userId.name} ${t.userId.surname || ""}`
                        : t.name || "Visiteur"}
                      <div className="admin-muted">{t.email}</div>
                    </td>
                    <td>{t.subject}</td>
                    <td>
                      <span className={`admin-tag ${STATUS_TAG_CLASS[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Précédent
            </button>
            <span>
              Page {data.page} / {data.pages || 1}
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Suivant →
            </button>
          </div>
        </div>

        <div className="support-detail">
          {!ticket ? (
            <p className="admin-muted">Sélectionne un message à gauche.</p>
          ) : (
            <>
              <div className="support-detail-header">
                <div>
                  <h2>{ticket.subject}</h2>
                  <p className="admin-muted">
                    {ticket.userId
                      ? `${ticket.userId.name} ${ticket.userId.surname || ""} (compte)`
                      : `${ticket.name || "Visiteur"} (sans compte)`}
                    {" · "}
                    {ticket.email}
                  </p>
                </div>
                <div className="support-detail-actions">
                  <span className={`admin-tag ${STATUS_TAG_CLASS[ticket.status]}`}>
                    {STATUS_LABEL[ticket.status]}
                  </span>
                  {ticket.status !== "closed" ? (
                    <button
                      type="button"
                      className="support-status-btn"
                      onClick={() => changeStatus("closed")}
                    >
                      Fermer
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="support-status-btn"
                      onClick={() => changeStatus("open")}
                    >
                      Rouvrir
                    </button>
                  )}
                </div>
              </div>

              <div className="support-thread">
                {ticket.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`support-msg support-msg--${m.sender}`}
                  >
                    <div className="support-msg-body">{m.body}</div>
                    <div className="support-msg-meta">
                      {m.sender === "admin" ? "Équipe" : "Utilisateur"} ·{" "}
                      {new Date(m.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                ))}
              </div>

              {!ticket.userId && (
                <p className="support-email-note">
                  Sans compte : la réponse part par email à {ticket.email}, ce
                  fil se ferme ensuite (pas de retour possible dans l'app).
                </p>
              )}

              <div className="support-reply">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Écrire une réponse…"
                  rows={4}
                />
                <button
                  type="button"
                  disabled={!reply.trim() || sending}
                  onClick={sendReply}
                >
                  {sending ? "Envoi…" : "Répondre"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupport;

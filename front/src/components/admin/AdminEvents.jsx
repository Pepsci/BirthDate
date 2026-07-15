import React, { useEffect, useState, useCallback } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const AdminEvents = () => {
  const [data, setData] = useState({ events: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    apiHandler
      .get(`/admin/events?${params}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const remove = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer définitivement cet événement (cascade) ?"))
      return;
    apiHandler
      .delete(`/admin/events/${id}`)
      .then(load)
      .catch((err) => alert(err.response?.data?.message || "Erreur"));
  };

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Événements ({data.total})</h1>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Rechercher titre ou shortId…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous statuts</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="cancelled">Cancelled</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Type</th>
              <th>Organisateur</th>
              <th>Date</th>
              <th>Invités</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((ev) => (
              <tr
                key={ev._id}
                onClick={() => window.open(`/event/${ev.shortId}`, "_blank")}
              >
                <td>
                  {ev.title} <span className="admin-muted">({ev.shortId})</span>
                </td>
                <td>{ev.type}</td>
                <td>
                  {ev.organizer
                    ? `${ev.organizer.name} ${ev.organizer.surname || ""}`
                    : "—"}
                </td>
                <td>
                  {ev.selectedDate || ev.fixedDate
                    ? new Date(ev.selectedDate || ev.fixedDate).toLocaleDateString(
                        "fr-FR",
                      )
                    : ev.dateMode === "vote"
                      ? "vote en cours"
                      : "—"}
                </td>
                <td>{ev.invitationsCount}</td>
                <td>
                  <span
                    className={`admin-tag ${
                      ev.status === "published"
                        ? "admin-tag-success"
                        : ev.status === "cancelled"
                          ? "admin-tag-danger"
                          : ""
                    }`}
                  >
                    {ev.status}
                  </span>
                  {ev.giftPool?.active && (
                    <span className="admin-tag admin-tag-primary">cagnotte</span>
                  )}
                </td>
                <td>
                  <button
                    className="admin-btn-danger admin-btn-small"
                    onClick={(e) => remove(e, ev._id)}
                  >
                    Supprimer
                  </button>
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
        <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
          Suivant →
        </button>
      </div>
    </div>
  );
};

export default AdminEvents;

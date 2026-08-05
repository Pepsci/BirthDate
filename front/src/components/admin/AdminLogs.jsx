import React, { useEffect, useState, useCallback } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const ACTIONS = [
  "login",
  "logout",
  "signup",
  "password_reset_request",
  "password_reset",
  "account_update",
  "account_delete",
  "friend_add",
  "message_send",
];

const AdminLogs = () => {
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 1 });
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page });
    if (action) params.set("action", action);
    apiHandler
      .get(`/admin/logs?${params}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [page, action]);

  useEffect(load, [load]);

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Logs ({data.total})</h1>

      <div className="admin-toolbar">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log._id}>
                <td>{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                <td>
                  {log.userId
                    ? `${log.userId.name} ${log.userId.surname || ""}`
                    : "—"}
                  {log.userId?.email && (
                    <span className="admin-muted"> ({log.userId.email})</span>
                  )}
                </td>
                <td>
                  <span className="admin-tag">{log.action}</span>
                  {/* Demande de reset bloquée par l'anti-renvoi : sans ce
                      marqueur, une rafale de demandes ressemblerait à des
                      envois d'emails réellement effectués. */}
                  {log.metadata?.throttled && (
                    <span className="admin-muted"> · bloquée (anti-spam)</span>
                  )}
                </td>
                <td className="admin-muted">{log.ipAddress}</td>
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

export default AdminLogs;

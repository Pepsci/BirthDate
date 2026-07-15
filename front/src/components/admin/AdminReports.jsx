// Panel admin : signalements UGC (conformité stores — traitement < 24 h)
import React, { useCallback, useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const REASON_LABELS = {
  spam: "📣 Spam",
  harassment: "⚠️ Harcèlement",
  inappropriate: "🚫 Contenu inapproprié",
  scam: "💸 Arnaque / fraude",
  other: "❓ Autre",
};

const TYPE_LABELS = {
  message: "Message privé",
  eventMessage: "Message d'événement",
  giftProposal: "Proposition de cadeau",
  wishlist: "Wishlist",
  user: "Utilisateur",
  other: "Autre",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "🕐 En attente" },
  { value: "reviewed", label: "👀 Examiné" },
  { value: "actioned", label: "✅ Action prise" },
  { value: "dismissed", label: "🗑️ Classé sans suite" },
];

const statusTag = (status) => {
  if (status === "pending") return "admin-tag admin-tag-danger";
  if (status === "reviewed") return "admin-tag admin-tag-warning";
  if (status === "actioned") return "admin-tag admin-tag-success";
  return "admin-tag";
};

const AdminReports = () => {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(() => {
    const qs = filter === "all" ? "" : `?status=${filter}`;
    apiHandler
      .get(`/moderation/reports${qs}`)
      .then((res) => setReports(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [filter]);

  useEffect(load, [load]);

  const updateStatus = async (reportId, status) => {
    try {
      await apiHandler.put(`/moderation/reports/${reportId}`, { status });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Mise à jour impossible.");
    }
  };

  if (error) return <p className="admin-error">{error}</p>;
  if (!reports) return <p className="admin-loading">Chargement des signalements…</p>;

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="admin-page">
      <h1>Signalements ({reports.length})</h1>
      <p className="admin-muted">
        Engagement stores : traitement sous 24 h.{" "}
        {filter === "pending" && pendingCount > 0 && (
          <strong>{pendingCount} en attente.</strong>
        )}
      </p>

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">En attente</option>
          <option value="reviewed">Examinés</option>
          <option value="actioned">Action prise</option>
          <option value="dismissed">Classés</option>
          <option value="all">Tous</option>
        </select>
      </div>

      {reports.length === 0 ? (
        <div className="admin-card admin-alert-empty">
          <span className="admin-card-value">✅</span>
          <span className="admin-card-label">Aucun signalement</span>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Motif</th>
                <th>Signalé par</th>
                <th>Cible</th>
                <th>Extrait</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r._id}>
                  <td>{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                  <td>{TYPE_LABELS[r.contentType] || r.contentType}</td>
                  <td>{REASON_LABELS[r.reason] || r.reason}</td>
                  <td>
                    {r.reporter
                      ? `${r.reporter.name} (${r.reporter.email})`
                      : "—"}
                  </td>
                  <td>
                    {r.targetUser
                      ? `${r.targetUser.name} (${r.targetUser.email})`
                      : "—"}
                  </td>
                  <td className="admin-report-preview">
                    {r.contentPreview || r.details || "—"}
                  </td>
                  <td>
                    <span className={statusTag(r.status)}>{r.status}</span>
                  </td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r._id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminReports;

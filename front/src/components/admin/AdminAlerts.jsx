import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const RULE_LABELS = {
  big_contribution: "💰 Grosse contribution unique",
  big_total: "📈 Total collecté élevé",
  velocity: "⚡ Afflux rapide de contributions",
  refund_ratio: "↩️ Taux de remboursement anormal",
};

const AdminAlerts = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiHandler
      .get("/admin/pools/alerts")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, []);

  if (error) return <p className="admin-error">{error}</p>;
  if (!data) return <p className="admin-loading">Analyse des cagnottes…</p>;

  const { alerts, thresholds } = data;

  return (
    <div className="admin-page">
      <h1>Alertes cagnottes ({alerts.length})</h1>

      <p className="admin-muted">
        Seuils actuels : contribution ≥ {thresholds.bigContribution / 100} € ·
        total ≥ {thresholds.bigTotal / 100} € · ≥ {thresholds.velocityCount}{" "}
        contributions / {thresholds.velocityWindowMinutes} min · remboursements
        ≥ {Math.round(thresholds.refundRatio * 100)} %
      </p>

      {alerts.length === 0 ? (
        <div className="admin-card admin-alert-empty">
          <span className="admin-card-value">✅</span>
          <span className="admin-card-label">
            Aucune cagnotte suspecte détectée
          </span>
        </div>
      ) : (
        <div className="admin-alerts-list">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`admin-alert-card ${
                a.severity === "high" ? "admin-alert-high" : "admin-alert-medium"
              }`}
            >
              <div className="admin-alert-header">
                <strong>{RULE_LABELS[a.type] || a.type}</strong>
                <span
                  className={`admin-tag ${
                    a.severity === "high"
                      ? "admin-tag-danger"
                      : "admin-tag-warning"
                  }`}
                >
                  {a.severity === "high" ? "priorité haute" : "à surveiller"}
                </span>
              </div>
              <p className="admin-alert-details">{a.details}</p>
              <p className="admin-muted">
                Événement : <strong>{a.event.title}</strong> ({a.event.shortId})
                {a.event.organizer && (
                  <>
                    {" "}
                    · Organisateur : {a.event.organizer.name}{" "}
                    {a.event.organizer.surname || ""} ({a.event.organizer.email})
                  </>
                )}
                {" "}· Collecté : {euros(a.totals.collected)} (
                {a.totals.contributions} contribution(s), {a.totals.refunded}{" "}
                remboursée(s))
              </p>
              <div className="admin-alert-actions">
                <button onClick={() => navigate("/admin/pools")}>
                  Voir les cagnottes
                </button>
                <button
                  onClick={() => window.open(`/event/${a.event.shortId}`, "_blank")}
                >
                  Ouvrir l'événement
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAlerts;

import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

// Mini graphique en barres CSS (30 jours)
const MiniBars = ({ data, color }) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="admin-minibars">
      {data.map((d) => (
        <div
          key={d._id}
          className="admin-minibar"
          style={{ height: `${(d.count / max) * 100}%`, background: color }}
          title={`${d._id} : ${d.count}`}
        />
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiHandler
      .get("/admin/stats")
      .then((res) => setStats(res.data))
      .catch((err) =>
        setError(err.response?.data?.message || "Erreur de chargement"),
      );
  }, []);

  if (error) return <p className="admin-error">{error}</p>;
  if (!stats) return <p className="admin-loading">Chargement des stats…</p>;

  const { users, activity, events, pools, series } = stats;

  return (
    <div className="admin-page">
      <h1>Dashboard</h1>

      <h3 className="admin-section-title">Utilisateurs</h3>
      <div className="admin-cards">
        <div className="admin-card">
          <span className="admin-card-value">{users.total}</span>
          <span className="admin-card-label">Total inscrits</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{users.verified}</span>
          <span className="admin-card-label">Vérifiés</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">+{users.newToday}</span>
          <span className="admin-card-label">Aujourd'hui</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">+{users.new7d}</span>
          <span className="admin-card-label">7 derniers jours</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">+{users.new30d}</span>
          <span className="admin-card-label">30 derniers jours</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{users.pendingDeletion}</span>
          <span className="admin-card-label">En attente suppression</span>
        </div>
      </div>

      <h3 className="admin-section-title">Activité</h3>
      <div className="admin-cards">
        <div className="admin-card">
          <span className="admin-card-value">{activity.loginsToday}</span>
          <span className="admin-card-label">Logins aujourd'hui</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{activity.logins7d}</span>
          <span className="admin-card-label">Logins 7 jours</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{activity.totalDates}</span>
          <span className="admin-card-label">Dates enregistrées</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{activity.totalFriendships}</span>
          <span className="admin-card-label">Amitiés</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{activity.totalMessages}</span>
          <span className="admin-card-label">Messages</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{activity.totalEventMessages}</span>
          <span className="admin-card-label">Messages events</span>
        </div>
      </div>

      <h3 className="admin-section-title">Événements</h3>
      <div className="admin-cards">
        <div className="admin-card">
          <span className="admin-card-value">{events.total}</span>
          <span className="admin-card-label">Total</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{events.upcoming}</span>
          <span className="admin-card-label">À venir</span>
        </div>
        {Object.entries(events.byStatus || {}).map(([status, count]) => (
          <div className="admin-card" key={status}>
            <span className="admin-card-value">{count}</span>
            <span className="admin-card-label">{status}</span>
          </div>
        ))}
      </div>

      <h3 className="admin-section-title">Cagnottes</h3>
      <div className="admin-cards">
        <div className="admin-card">
          <span className="admin-card-value">{pools.activeCount}</span>
          <span className="admin-card-label">Actives</span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{euros(pools.succeeded?.total)}</span>
          <span className="admin-card-label">
            Collecté ({pools.succeeded?.count || 0} contributions)
          </span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{euros(pools.refunded?.total)}</span>
          <span className="admin-card-label">
            Remboursé ({pools.refunded?.count || 0})
          </span>
        </div>
        <div className="admin-card">
          <span className="admin-card-value">{pools.pending?.count || 0}</span>
          <span className="admin-card-label">En attente</span>
        </div>
      </div>

      <h3 className="admin-section-title">Évolution — 30 derniers jours</h3>
      <div className="admin-charts">
        <div className="admin-chart-box">
          <h4>Inscriptions</h4>
          <MiniBars data={series.signups} color="var(--primary)" />
        </div>
        <div className="admin-chart-box">
          <h4>Connexions</h4>
          <MiniBars data={series.logins} color="var(--success)" />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

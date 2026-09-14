import React, { useEffect, useState, useCallback } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const AdminPools = () => {
  const [data, setData] = useState({ pools: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState("true"); // true | false | all
  const [expanded, setExpanded] = useState(null); // { event, contributions }
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    apiHandler
      .get(`/admin/pools?page=${page}&active=${scope}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [page, scope]);

  useEffect(load, [load]);

  const openContributions = (eventId) => {
    apiHandler
      .get(`/admin/pools/${eventId}/contributions`)
      .then((res) => setExpanded(res.data))
      .catch(() => {});
  };

  /*
   * Remboursement administrateur.
   *
   * ⚠️ C'est une exception, pas un outil de service après-vente.
   *
   * En charges directes, rembourser prélève sur le solde de l'ORGANISATEUR.
   * S'il a déjà viré sa collecte, son compte part en négatif et la perte finit
   * à la charge de BirthReminder. Un remboursement déclenché ici est un acte
   * volontaire : contrairement à une opposition bancaire, personne ne nous
   * l'impose. Rembourser à la place d'un organisateur solvable mais lent,
   * c'est payer la dette d'autrui sans y être tenu — et se placer, aux yeux
   * des utilisateurs suivants, dans le rôle de celui qui rembourse.
   *
   * La règle : on relaie, l'organisateur rembourse. Ce bouton sert aux cas où
   * il ne le fera jamais — fraude avérée, compte disparu — et de préférence
   * tant que l'argent est encore là.
   *
   * Le serveur refuse (409) si le solde est insuffisant ; `force` permet
   * d'assumer l'avance en connaissance du montant.
   */
  const refund = (contributionId, { force = false } = {}) => {
    if (
      !window.confirm(
        force
          ? "Forcer le remboursement malgré un solde insuffisant ? Le compte de l'organisateur passera en négatif et la perte peut finir à votre charge."
          : "Rembourser cette contribution via Stripe ? Cette action est irréversible.",
      )
    )
      return;
    apiHandler
      .post(`/admin/pools/contributions/${contributionId}/refund`, { force })
      .then(() => {
        openContributions(expanded.event._id);
        load();
      })
      .catch((err) => {
        const d = err.response?.data;
        if (d?.code === "INSUFFICIENT_CONNECTED_BALANCE") {
          if (window.confirm(`${d.message}\n\nForcer quand même ?`)) {
            refund(contributionId, { force: true });
          }
          return;
        }
        alert(d?.message || "Erreur remboursement");
      });
  };

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Cagnottes ({data.total})</h1>

      <div className="admin-toolbar">
        <select
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setPage(1);
          }}
        >
          <option value="true">Actives</option>
          <option value="false">Inactives</option>
          <option value="all">Toutes</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Événement</th>
              <th>Organisateur</th>
              <th>Objectif</th>
              <th>Collecté</th>
              <th>Remboursé</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {data.pools.map((p) => (
              <tr key={p.eventId} onClick={() => openContributions(p.eventId)}>
                <td>
                  {p.title}{" "}
                  <span className="admin-muted">({p.shortId})</span>
                </td>
                <td>
                  {p.organizer
                    ? `${p.organizer.name} ${p.organizer.surname || ""}`
                    : "—"}
                </td>
                <td>{p.giftPool?.goal ? euros(p.giftPool.goal) : "libre"}</td>
                <td>
                  <strong>{euros(p.totals.succeeded?.total)}</strong>{" "}
                  <span className="admin-muted">
                    ({p.totals.succeeded?.count || 0})
                  </span>
                </td>
                <td>{euros(p.totals.refunded?.total)}</td>
                <td>
                  {p.giftPool?.deadline
                    ? new Date(p.giftPool.deadline).toLocaleDateString("fr-FR")
                    : "—"}
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

      {expanded && (
        <div className="admin-modal-overlay" onClick={() => setExpanded(null)}>
          <div
            className="admin-modal admin-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setExpanded(null)}
            >
              ✕
            </button>
            <h2>{expanded.event.title}</h2>
            <p className="admin-muted">
              Organisateur : {expanded.event.organizer?.name}{" "}
              {expanded.event.organizer?.surname || ""} (
              {expanded.event.organizer?.email})
            </p>

            {/* État du compte qui détient réellement l'argent. Sans ça, on
                clique « Rembourser » sans savoir s'il reste quelque chose. */}
            {expanded.connectedAccount && (
              <div
                className={
                  "admin-connect-balance" +
                  (expanded.connectedAccount.availableCents <= 0
                    ? " admin-connect-warn"
                    : "")
                }
              >
                <span>
                  Solde disponible :{" "}
                  <strong>
                    {euros(expanded.connectedAccount.availableCents)}
                  </strong>
                </span>
                <span>
                  En attente :{" "}
                  <strong>
                    {euros(expanded.connectedAccount.pendingCents)}
                  </strong>
                </span>
                <span>
                  Virements :{" "}
                  <strong>
                    {expanded.connectedAccount.payoutsEnabled
                      ? "activés"
                      : "bloqués"}
                  </strong>
                </span>
                <span>
                  Perte en cas de négatif :{" "}
                  <strong>
                    {expanded.connectedAccount.lossesPayer === "application"
                      ? "BirthReminder"
                      : expanded.connectedAccount.lossesPayer === "stripe"
                        ? "Stripe"
                        : "inconnu"}
                  </strong>
                </span>
              </div>
            )}

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Contributeur</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expanded.contributions.map((c) => (
                  <tr key={c._id}>
                    <td>
                      {c.contributor
                        ? `${c.contributor.name} ${c.contributor.surname || ""}`
                        : c.guestName || "Invité externe"}
                      {c.anonymous && (
                        <span className="admin-muted"> (anonyme)</span>
                      )}
                    </td>
                    <td>{euros(c.amount)}</td>
                    <td>
                      <span
                        className={`admin-tag ${
                          c.status === "succeeded"
                            ? "admin-tag-success"
                            : c.status === "refunded"
                              ? "admin-tag-warning"
                              : c.status === "failed"
                                ? "admin-tag-danger"
                                : ""
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td>{new Date(c.createdAt).toLocaleString("fr-FR")}</td>
                    <td>
                      {c.status === "succeeded" && (
                        <button
                          className="admin-btn-danger admin-btn-small"
                          onClick={() => refund(c._id)}
                        >
                          Rembourser
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {expanded.contributions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-muted">
                      Aucune contribution
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPools;

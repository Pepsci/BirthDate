import React, { useEffect, useState, useCallback } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";

const AdminUsers = () => {
  const [data, setData] = useState({ users: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null); // { user, counts, stripeAccount, lastLoginAt }
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page });
    if (search) params.set("search", search);
    if (filter) params.set("filter", filter);
    apiHandler
      .get(`/admin/users?${params}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Erreur"));
  }, [page, search, filter]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0); // debounce recherche
    return () => clearTimeout(t);
  }, [load, search]);

  const openDetail = (id) => {
    apiHandler
      .get(`/admin/users/${id}`)
      .then((res) => setDetail(res.data))
      .catch(() => {});
  };

  const setRole = (id, role) => {
    apiHandler
      .patch(`/admin/users/${id}/role`, { role })
      .then(() => {
        setDetail(null);
        load();
      })
      .catch((err) => alert(err.response?.data?.message || "Erreur"));
  };

  const softDelete = (id) => {
    if (!window.confirm("Marquer ce compte pour suppression ?")) return;
    apiHandler
      .delete(`/admin/users/${id}`)
      .then(() => {
        setDetail(null);
        load();
      })
      .catch((err) => alert(err.response?.data?.message || "Erreur"));
  };

  const restore = (id) => {
    apiHandler
      .patch(`/admin/users/${id}/restore`)
      .then(() => {
        setDetail(null);
        load();
      })
      .catch((err) => alert(err.response?.data?.message || "Erreur"));
  };

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Utilisateurs ({data.total})</h1>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Rechercher nom, prénom, email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous</option>
          <option value="verified">Vérifiés</option>
          <option value="unverified">Non vérifiés</option>
          <option value="deleted">En suppression</option>
          <option value="admins">Admins</option>
        </select>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Vérifié</th>
              <th>Rôle</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u._id} onClick={() => openDetail(u._id)}>
                <td>
                  {u.name} {u.surname || ""}
                </td>
                <td>{u.email}</td>
                <td>{u.isVerified ? "✅" : "—"}</td>
                <td>
                  {u.role === "admin" ? (
                    <span className="admin-tag admin-tag-primary">admin</span>
                  ) : (
                    "user"
                  )}
                </td>
                <td>
                  {u.deletedAt ? (
                    <span className="admin-tag admin-tag-danger">suppression</span>
                  ) : (
                    <span className="admin-tag admin-tag-success">actif</span>
                  )}
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

      {detail && (
        <div className="admin-modal-overlay" onClick={() => setDetail(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="admin-modal-close" onClick={() => setDetail(null)}>
              ✕
            </button>
            <h2>
              {detail.user.name} {detail.user.surname || ""}
            </h2>
            <p className="admin-muted">{detail.user.email}</p>

            <div className="admin-detail-grid">
              <div>
                <strong>{detail.counts.dates}</strong> dates
              </div>
              <div>
                <strong>{detail.counts.friends}</strong> amis
              </div>
              <div>
                <strong>{detail.counts.eventsOrganized}</strong> events organisés
              </div>
              <div>
                <strong>{detail.counts.contributions}</strong> contributions
              </div>
            </div>

            <p>
              Dernière connexion :{" "}
              {detail.lastLoginAt
                ? new Date(detail.lastLoginAt).toLocaleString("fr-FR")
                : "inconnue"}
            </p>
            <p>
              Stripe :{" "}
              {detail.stripeAccount
                ? detail.stripeAccount.chargesEnabled
                  ? "compte actif (encaissements OK)"
                  : "compte créé, onboarding incomplet"
                : "aucun compte"}
            </p>

            <div className="admin-modal-actions">
              {detail.user.role === "admin" ? (
                <button onClick={() => setRole(detail.user._id, "user")}>
                  Retirer admin
                </button>
              ) : (
                <button onClick={() => setRole(detail.user._id, "admin")}>
                  Promouvoir admin
                </button>
              )}
              {detail.user.deletedAt ? (
                <button
                  className="admin-btn-success"
                  onClick={() => restore(detail.user._id)}
                >
                  Restaurer le compte
                </button>
              ) : (
                <button
                  className="admin-btn-danger"
                  onClick={() => softDelete(detail.user._id)}
                >
                  Supprimer le compte
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;

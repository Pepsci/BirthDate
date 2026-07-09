import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/sharedGiftSection.css";

export default function SharedInvites() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(null); // invitation en cours
  const [dates, setDates] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await apiHandler.get("/shared-gifts/invitations");
      setInvites(res.data);
    } catch {
      setError("Erreur de chargement.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAccept = async (inv) => {
    setAccepting(inv);
    try {
      const res = await apiHandler.get("/date");
      setDates(res.data || []);
    } catch {
      setDates([]);
    }
  };

  const confirmAccept = async (dateId) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiHandler.post(`/shared-gifts/invitations/${accepting._id}/accept`, {
        dateId,
      });
      setAccepting(null);
      await load();
    } catch {
      setError("Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const decline = async (inv) => {
    setBusy(true);
    try {
      await apiHandler.post(`/shared-gifts/invitations/${inv._id}/decline`);
      await load();
    } catch {
      setError("Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sgs-wrapper" style={{ maxWidth: 620, margin: "1.5rem auto", padding: "0 1rem" }}>
      <button className="sgs-btn sgs-btn--ghost" onClick={() => navigate("/home")}>
        ← Retour
      </button>
      <h2>👥 Listes de cadeaux communes</h2>
      {error && <p className="sgs-error">{error}</p>}
      {!invites && <p className="sgs-loading">Chargement…</p>}
      {invites && invites.length === 0 && (
        <p className="sgs-loading">Aucune invitation en attente.</p>
      )}

      {invites?.map((inv) => (
        <div
          key={inv._id}
          style={{
            background: "var(--bg-primary,#fff)",
            border: "1px solid var(--border-color,#e5e7eb)",
            borderRadius: 12,
            padding: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <p style={{ margin: "0 0 0.75rem" }}>
            <strong>
              {inv.fromUser?.name} {inv.fromUser?.surname || ""}
            </strong>{" "}
            veut créer une liste de cadeaux commune
            {inv.label ? ` pour ${inv.label}` : ""}.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button className="sgs-btn sgs-btn--ghost" disabled={busy} onClick={() => decline(inv)}>
              Refuser
            </button>
            <button className="sgs-btn" disabled={busy} onClick={() => openAccept(inv)}>
              Accepter
            </button>
          </div>
        </div>
      ))}

      {accepting && (
        <div className="sgs-modal-overlay" onClick={() => setAccepting(null)}>
          <div className="sgs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Associer à quelle carte ?</h3>
            <p className="sgs-modal-sub">
              Choisis la carte anniversaire à relier à cette liste commune.
            </p>
            {dates.length === 0 && <p>Aucune carte disponible.</p>}
            {dates.map((d) => (
              <button
                key={d._id}
                className="sgs-friend-row"
                disabled={busy}
                onClick={() => confirmAccept(d._id)}
              >
                {(d.name || d.linkedUser?.name) ?? "?"}{" "}
                {(d.surname || d.linkedUser?.surname) ?? ""}
                {d.linkedUser ? " · Ami" : d.family ? " · Famille" : ""}
              </button>
            ))}
            <button className="sgs-btn sgs-btn--ghost" onClick={() => setAccepting(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

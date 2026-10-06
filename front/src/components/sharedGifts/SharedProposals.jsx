import { useState } from "react";
import apiHandler from "../../api/apiHandler";
import ConfirmModal from "../UI/ConfirmModal";
import "./css/sharedProposals.css";

/**
 * Propositions d'idées sur une liste commune.
 *
 * Deux visages selon le rôle (`list.myRole`) :
 *   - invité : un bouton « Proposer une idée », un petit formulaire, et la
 *     liste de SES propositions en attente, qu'il peut retirer ;
 *   - gestionnaire : les propositions de tous les invités, avec Accepter
 *     (l'idée entre dans la liste) et Refuser (elle disparaît).
 *
 * Le serveur ne renvoie à chacun que ce qu'il a le droit de voir : rien à
 * filtrer ici. Chaque action renvoie la liste à jour, remontée par `onChange`.
 */
export default function SharedProposals({ list, listId, onChange }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ giftName: "", url: "", price: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [toDecline, setToDecline] = useState(null);

  const isMember = list.myRole !== "viewer";
  const proposals = list.proposals ?? [];

  /** Lance un appel, remonte la liste à jour ou affiche l'erreur du serveur. */
  const run = async (call) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      onChange(res.data);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Une erreur s'est produite.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.giftName.trim()) {
      setError("Indique le nom du cadeau.");
      return;
    }
    const ok = await run(() =>
      apiHandler.post(`/shared-gifts/${listId}/proposals`, {
        giftName: form.giftName.trim(),
        url: form.url.trim() || null,
        price: form.price === "" ? null : form.price,
      }),
    );
    if (ok) {
      setForm({ giftName: "", url: "", price: "" });
      setOpen(false);
    }
  };

  const decide = (proposalId, decision) =>
    run(() =>
      apiHandler.post(
        `/shared-gifts/${listId}/proposals/${proposalId}/${decision}`,
      ),
    );

  const proposerName = (p) =>
    `${p.proposedBy?.name ?? ""} ${p.proposedBy?.surname ?? ""}`.trim() ||
    "un invité";

  const details = (p) => (
    <div className="sgp-details">
      <span className="sgp-name">{p.giftName}</span>
      {p.price != null && <span className="sgp-meta">{p.price} €</span>}
      {p.url && (
        <a
          className="sgp-link"
          href={p.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          {p.url}
        </a>
      )}
    </div>
  );

  // ── Gestionnaire ──────────────────────────────────────────────────────────
  if (isMember) {
    if (proposals.length === 0) return null;
    return (
      <div className="sgp-box">
        <h3 className="sgp-title">
          💡 Propositions à examiner ({proposals.length})
        </h3>
        {error && <p className="sgp-error">{error}</p>}
        {proposals.map((p) => (
          <div key={p._id} className="sgp-row">
            {details(p)}
            <span className="sgp-meta">Proposé par {proposerName(p)}</span>
            <div className="sgp-actions">
              <button
                type="button"
                className="sgp-btn sgp-btn--primary"
                disabled={busy}
                onClick={() => decide(p._id, "accept")}
              >
                Accepter
              </button>
              <button
                type="button"
                className="sgp-btn"
                disabled={busy}
                onClick={() => setToDecline(p)}
              >
                Refuser
              </button>
            </div>
          </div>
        ))}

        <ConfirmModal
          open={!!toDecline}
          title="Refuser cette proposition ?"
          message={
            toDecline
              ? `${proposerName(toDecline)} sera prévenu que « ${toDecline.giftName} » n'a pas été retenue.`
              : ""
          }
          confirmLabel="Refuser"
          onConfirm={async () => {
            const p = toDecline;
            setToDecline(null);
            if (p) await decide(p._id, "decline");
          }}
          onCancel={() => setToDecline(null)}
        />
      </div>
    );
  }

  // ── Invité ────────────────────────────────────────────────────────────────
  return (
    <div className="sgp-box">
      {!open ? (
        <button
          type="button"
          className="sgp-btn sgp-btn--primary"
          onClick={() => setOpen(true)}
        >
          💡 Proposer une idée
        </button>
      ) : (
        <form className="sgp-form" onSubmit={submit}>
          <h3 className="sgp-title">Proposer une idée</h3>
          <p className="sgp-meta">
            Les gestionnaires de la liste décident de l'ajouter ou non.
          </p>
          <input
            className="sgp-input"
            placeholder="Nom du cadeau *"
            maxLength={120}
            value={form.giftName}
            onChange={(e) => setForm({ ...form, giftName: e.target.value })}
          />
          <input
            className="sgp-input"
            type="url"
            placeholder="Lien (facultatif)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <input
            className="sgp-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="Prix (facultatif)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <div className="sgp-actions">
            <button
              type="submit"
              className="sgp-btn sgp-btn--primary"
              disabled={busy}
            >
              Envoyer la proposition
            </button>
            <button
              type="button"
              className="sgp-btn"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && <p className="sgp-error">{error}</p>}

      {proposals.length > 0 && (
        <div className="sgp-mine">
          <h3 className="sgp-title">Mes propositions en attente</h3>
          {proposals.map((p) => (
            <div key={p._id} className="sgp-row">
              {details(p)}
              <button
                type="button"
                className="sgp-withdraw"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    apiHandler.delete(
                      `/shared-gifts/${listId}/proposals/${p._id}`,
                    ),
                  )
                }
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

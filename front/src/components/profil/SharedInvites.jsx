import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/sharedGiftSection.css";

export default function SharedInvites({ embedded = false }) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(null); // invitation en cours
  const [dates, setDates] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      // ⚠️ Deux choses différentes, chargées ensemble parce qu'elles
      // apparaissent au même endroit :
      //  - les INVITATIONS à devenir membre, qui s'acceptent ou se refusent ;
      //  - les listes qu'on m'a partagées en INVITÉ et que je n'ai pas encore
      //    rattachées à une carte.
      //
      // Les secondes n'étaient chargées nulle part côté web. Or une liste non
      // rattachée n'apparaît dans aucun écran : si on ferme la notification
      // sans terminer le rattachement, elle devient définitivement
      // introuvable. Une action en attente ne doit jamais dépendre d'un
      // message éphémère.
      const [inv, shared] = await Promise.all([
        apiHandler.get("/shared-gifts/invitations"),
        apiHandler.get("/shared-gifts/shared-with-me").catch(() => ({ data: [] })),
      ]);
      setInvites(inv.data);
      setPending(shared.data || []);
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

  /**
   * @param payload `{ dateId }` pour une carte existante, `{ newDate: {} }`
   *   pour la créer au passage — le serveur reprend alors le nom et la date de
   *   naissance depuis la carte de celui qui invite, qui décrit la même
   *   personne.
   */
  const confirmAccept = async (payload) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiHandler.post(
        `/shared-gifts/invitations/${accepting._id}/accept`,
        payload,
      );
      setAccepting(null);
      // Une carte tout juste créée n'est visible nulle part tant qu'on n'y va
      // pas : on emmène directement dessus, la liste commune y est déjà posée.
      if (payload.newDate && res.data?.dateId) {
        navigate(`/home?tab=date&dateId=${res.data.dateId}`);
        return;
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  // Prénom de la personne concernée : `fromDate` d'abord (la carte de celui qui
  // invite), `label` en repli pour les invitations d'avant l'ajout du populate.
  const acceptTargetName = accepting
    ? [accepting.fromDate?.name, accepting.fromDate?.surname]
        .filter(Boolean)
        .join(" ") ||
      accepting.label ||
      null
    : null;

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
      {/* `embedded` : le composant sert aussi d'onglet dans la page Profil, où
          un bouton « retour à l'accueil » n'aurait aucun sens. */}
      {!embedded && (
        <button
          className="sgs-btn sgs-btn--ghost"
          onClick={() => navigate("/home")}
        >
          ← Retour
        </button>
      )}
      <h2>👥 Listes de cadeaux communes</h2>
      {error && <p className="sgs-error">{error}</p>}
      {!invites && <p className="sgs-loading">Chargement…</p>}
      {pending.length > 0 && (
        <section className="sgi-pending">
          <h3 className="sgi-pending-title">Listes partagées avec vous</h3>
          {pending.map((l) => (
            <button
              key={l._id}
              className="sgi-pending-card"
              onClick={() => navigate(`/shared-list/${l._id}/attach`)}
            >
              <span>
                <strong>
                  {l.from
                    ? `${l.from.name} ${l.from.surname ?? ""}`.trim()
                    : "Quelqu'un"}
                </strong>{" "}
                vous a partagé une liste
                {l.label ? ` pour ${l.label}` : ""} — {l.giftCount} idée
                {l.giftCount > 1 ? "s" : ""}.
              </span>
              <span className="sgi-pending-hint">
                Cliquez pour l'ajouter à une carte et pouvoir réserver →
              </span>
            </button>
          ))}
        </section>
      )}

      {invites && invites.length === 0 && pending.length === 0 && (
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

      {/* Nom de la personne concernée, repris de l'invitation : `fromDate` est
          la carte de celui qui invite, elle décrit la même personne. */}
      {accepting && (
        <div className="sgs-modal-overlay" onClick={() => setAccepting(null)}>
          <div className="sgs-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Associer à quelle carte ?</h3>
            <p className="sgs-modal-sub">
              Une liste commune s'affiche sur la carte de la personne concernée.
              Choisissez-en une, ou créez-la.
            </p>
            {/* Créer la carte au passage. C'était le blocage principal : il
                fallait DÉJÀ avoir enregistré la personne pour pouvoir accepter,
                alors qu'on est justement invité à préparer le cadeau de
                quelqu'un qu'on n'a pas forcément dans son carnet. Le nom et la
                date viennent de l'invitation, rien à saisir. */}
            {acceptTargetName && (
              <button
                className="sgs-btn sgs-friend-row"
                disabled={busy}
                onClick={() => confirmAccept({ newDate: {} })}
              >
                ➕ Créer la carte de {acceptTargetName}
              </button>
            )}

            {dates.length === 0 ? (
              <p className="sgs-modal-sub">
                Vous n'avez encore aucune carte — utilisez le bouton ci-dessus.
              </p>
            ) : (
              dates.map((d) => (
                <button
                  key={d._id}
                  className="sgs-friend-row"
                  disabled={busy}
                  onClick={() => confirmAccept({ dateId: d._id })}
                >
                  {(d.name || d.linkedUser?.name) ?? "?"}{" "}
                  {(d.surname || d.linkedUser?.surname) ?? ""}
                  {d.linkedUser ? " · Ami" : d.family ? " · Famille" : ""}
                </button>
              ))
            )}
            <button className="sgs-btn sgs-btn--ghost" onClick={() => setAccepting(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

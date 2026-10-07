import { useEffect, useRef, useState } from "react";
import apiHandler from "../../api/apiHandler";
import ConfirmModal from "../UI/ConfirmModal";
import "../UI/css/giftCardGrid.css";
import "./css/sharedProposals.css";

const OCCASION_EMOJI = {
  Anniversaire: "🎂",
  Noël: "🎄",
  "Saint-Valentin": "💝",
  "Fête des Mères": "💐",
  "Fête des Pères": "👔",
  Mariage: "💍",
  Naissance: "👶",
  Diplôme: "🎓",
  Crémaillère: "🏠",
  Autre: "✨",
};

const STATUS_BADGE = {
  pending: { label: "⏳ En attente", className: "gcg-badge--pending" },
  accepted: { label: "✅ Acceptée", className: "gcg-badge--purchased" },
  declined: { label: "↩️ Non retenue", className: "sgp-status--declined" },
};

const EMPTY_FORM = {
  giftName: "",
  occasion: "Anniversaire",
  price: "",
  url: "",
  image: "",
};

/** Temps laissé pour annuler un effacement. La barre de progression du
 *  bandeau dure le même temps : garder `.sgp-undo-bar` (CSS) aligné. */
const UNDO_DELAY_MS = 6000;

const statusOf = (p) => p.status || "pending";

const fullName = (u) => `${u?.name ?? ""} ${u?.surname ?? ""}`.trim();

const shortDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      })
    : "";

/**
 * Bloc repliable : un titre cliquable avec le nombre d'éléments, et son
 * contenu. Sert aux trois groupes de propositions.
 */
function Section({ title, count, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="sgp-section">
      <button
        type="button"
        className="sgp-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {title} ({count})
        </span>
        <span className="sgp-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && children}
    </section>
  );
}

/**
 * Propositions d'idées sur une liste commune.
 *
 * Deux visages selon le rôle (`list.myRole`) :
 *   - invité : un bouton « Proposer une idée », le formulaire, et SES
 *     propositions avec leur état (en attente, acceptée, non retenue) ;
 *   - gestionnaire : les propositions à examiner, avec Accepter / Refuser,
 *     puis celles déjà traitées.
 *
 * Les propositions traitées restent affichées : c'est ce qui permet de
 * retrouver une réponse quand la notification a été effacée sans être lue.
 *
 * Les cartes reprennent les classes de GiftCardGrid (`gcg-*`) pour avoir
 * exactement la forme des autres idées cadeaux.
 *
 * Le serveur ne renvoie à chacun que ce qu'il a le droit de voir : rien à
 * filtrer ici. Chaque action renvoie la liste à jour, remontée par `onChange`.
 */
export default function SharedProposals({ list, listId, occasions, onChange }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [toDecline, setToDecline] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState(null);
  // Carte en cours d'effacement (voir « Effacer avec délai d'annulation »).
  // Déclaré ici : la liste affichée, juste en dessous, en dépend.
  const [removing, setRemoving] = useState(null);
  const removeTimer = useRef(null);
  const removingRef = useRef(null);
  removingRef.current = removing;

  const isMember = list.myRole !== "viewer";
  // La carte en cours d'effacement est déjà retirée de l'affichage.
  const proposals = (list.proposals ?? []).filter(
    (p) => p._id !== removing?._id,
  );
  const pending = proposals.filter((p) => statusOf(p) === "pending");
  const decided = proposals
    .filter((p) => statusOf(p) !== "pending")
    .sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0));

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
        occasion: form.occasion,
        url: form.url.trim() || null,
        image: form.image.trim() || null,
        price: form.price === "" ? null : form.price,
      }),
    );
    if (ok) {
      setForm(EMPTY_FORM);
      setFetchMessage(null);
      setFormOpen(false);
    }
  };

  /**
   * Remplit le formulaire à partir du lien du produit : nom, prix, image.
   * Même service que pour la liste de souhaits et les idées cadeaux
   * (`/wishlist/fetch-url`). Ce qui est trouvé remplace le champ ; ce qui ne
   * l'est pas laisse la saisie en place.
   */
  const fetchFromUrl = async () => {
    const raw = form.url.trim();
    if (!raw || fetching) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setFetching(true);
    setFetchMessage(null);
    try {
      const res = await apiHandler.post("/wishlist/fetch-url", { url });
      if (!res.data.success) {
        setFetchMessage(
          `⚠️ ${res.data.message || "Ce site ne permet pas la récupération automatique."}`,
        );
        return;
      }
      const { title, image, price } = res.data.data || {};
      setForm((prev) => ({
        ...prev,
        url: res.data.affiliateUrl || url,
        giftName: title ? String(title).slice(0, 120) : prev.giftName,
        image: image || prev.image,
        price: price != null && price !== "" ? String(price) : prev.price,
      }));
      const missing = [
        !title && "nom",
        !price && "prix",
        !image && "image",
      ].filter(Boolean);
      setFetchMessage(
        missing.length === 0
          ? "✓ Infos récupérées, vérifie-les avant d'envoyer."
          : `⚠️ Remplissage partiel : ${missing.join(", ")} à compléter.`,
      );
    } catch {
      setFetchMessage("⚠️ Impossible de lire ce lien. Remplis les champs à la main.");
    } finally {
      setFetching(false);
    }
  };

  const decide = (proposalId, decision) =>
    run(() =>
      apiHandler.post(
        `/shared-gifts/${listId}/proposals/${proposalId}/${decision}`,
      ),
    );

  // ── Effacer avec délai d'annulation ───────────────────────────────────────
  // La carte disparaît tout de suite, mais rien n'est envoyé au serveur avant
  // UNDO_DELAY_MS : pendant ce temps, « Annuler » la fait revenir. Une seule
  // carte à la fois ; en effacer une autre valide la précédente.

  const deleteUrl = (proposalId) =>
    `/shared-gifts/${listId}/proposals/${proposalId}`;

  const commitRemove = (target) => {
    clearTimeout(removeTimer.current);
    setRemoving(null);
    if (target) run(() => apiHandler.delete(deleteUrl(target._id)));
  };

  const askRemove = (p) => {
    // Une autre carte attendait : on la valide sans passer par `run`, qui
    // refuserait un second appel tant que le premier n'est pas fini.
    if (removingRef.current) {
      clearTimeout(removeTimer.current);
      apiHandler.delete(deleteUrl(removingRef.current._id)).catch(() => {});
    }
    setRemoving(p);
    removeTimer.current = setTimeout(() => commitRemove(p), UNDO_DELAY_MS);
  };

  const undoRemove = () => {
    clearTimeout(removeTimer.current);
    setRemoving(null);
  };

  // Si on quitte l'écran pendant le délai, l'effacement demandé est envoyé.
  useEffect(
    () => () => {
      clearTimeout(removeTimer.current);
      if (removingRef.current) {
        apiHandler.delete(deleteUrl(removingRef.current._id)).catch(() => {});
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Une proposition, dans la forme d'une carte d'idée cadeau. */
  const card = (p, { lines = [], actions = null, showBadge = true }) => {
    const badge = STATUS_BADGE[statusOf(p)];
    return (
      <div
        key={p._id}
        className={`gcg-card ${showBadge ? `sgp-card--${statusOf(p)}` : ""}`}
      >
        <div className="gcg-img-wrapper">
          {p.image ? (
            <img
              src={p.image}
              alt={p.giftName}
              className="gcg-img"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className={`gcg-img-placeholder ${p.image ? "sgp-hidden" : ""}`}
          >
            <span className="gcg-img-emoji">
              {OCCASION_EMOJI[p.occasion] || "🎁"}
            </span>
          </div>
        </div>

        <div className="gcg-body">
          <div className="gcg-body-top">
            <h4 className="gcg-title">{p.giftName}</h4>
            {p.occasion && (
              <p className="gcg-meta">
                {OCCASION_EMOJI[p.occasion] || "🎁"} {p.occasion}
              </p>
            )}
            {lines.filter(Boolean).map((line) => (
              <p key={line} className="gcg-meta">
                {line}
              </p>
            ))}
          </div>

          <div className="gcg-body-bottom">
            <div className="gcg-footer">
              {p.price != null && (
                <span className="gcg-price">{p.price} €</span>
              )}
              {/* État de la proposition : en bas de carte, à côté du prix,
                  pour ne pas recouvrir l'image. */}
              {showBadge && (
                <span className={`sgp-status ${badge.className}`}>
                  {badge.label}
                </span>
              )}
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="gcg-link"
                >
                  🔗 Voir
                </a>
              )}
            </div>
            {actions && <div className="gcg-actions">{actions}</div>}
          </div>
        </div>
      </div>
    );
  };

  // ── Gestionnaire ──────────────────────────────────────────────────────────
  if (isMember) {
    if (proposals.length === 0) return null;
    return (
      <div className="sgp-box">
        {error && <p className="sgp-error">{error}</p>}

        {pending.length > 0 && (
          <Section
            title="💡 Propositions à examiner"
            count={pending.length}
            defaultOpen
          >
            <div className="gcg-grid">
              {pending.map((p) =>
                card(p, {
                  showBadge: false,
                  lines: [`Proposé par ${fullName(p.proposedBy) || "un invité"}`],
                  actions: (
                    <>
                      <button
                        type="button"
                        className="gcg-btn gcg-btn--primary"
                        disabled={busy}
                        onClick={() => decide(p._id, "accept")}
                      >
                        ✅ Accepter
                      </button>
                      <button
                        type="button"
                        className="gcg-btn gcg-btn--ghost"
                        disabled={busy}
                        onClick={() => setToDecline(p)}
                      >
                        Refuser
                      </button>
                    </>
                  ),
                }),
              )}
            </div>
          </Section>
        )}

        {decided.length > 0 && (
          <Section
            title="🗂️ Propositions traitées"
            count={decided.length}
            defaultOpen={false}
          >
            <div className="gcg-grid">
              {decided.map((p) =>
                card(p, {
                  lines: [
                    `Proposé par ${fullName(p.proposedBy) || "un invité"}`,
                    `${statusOf(p) === "accepted" ? "Acceptée" : "Refusée"}${
                      fullName(p.decidedBy)
                        ? ` par ${fullName(p.decidedBy)}`
                        : ""
                    } le ${shortDate(p.decidedAt)}`,
                  ],
                  // Revenir sur la décision. Refuser passe par la même
                  // confirmation que la première fois.
                  actions:
                    statusOf(p) === "accepted" ? (
                      <button
                        type="button"
                        className="gcg-btn gcg-btn--ghost"
                        disabled={busy}
                        onClick={() => setToDecline(p)}
                      >
                        ↩️ Refuser finalement
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="gcg-btn gcg-btn--ghost"
                        disabled={busy}
                        onClick={() => decide(p._id, "accept")}
                      >
                        ✅ Accepter finalement
                      </button>
                    ),
                }),
              )}
            </div>
          </Section>
        )}

        <ConfirmModal
          open={!!toDecline}
          title="Refuser cette proposition ?"
          message={
            toDecline
              ? `${fullName(toDecline.proposedBy) || "L'invité"} sera prévenu que « ${toDecline.giftName} » n'a pas été retenue.${
                  statusOf(toDecline) === "accepted"
                    ? " L'idée sera retirée de la liste."
                    : ""
                }`
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
      {!formOpen ? (
        <button
          type="button"
          className="gcg-btn gcg-btn--primary"
          onClick={() => setFormOpen(true)}
        >
          💡 Proposer une idée
        </button>
      ) : (
        <form className="sgp-form" onSubmit={submit}>
          <h3 className="sgp-title">Proposer une idée</h3>
          <p className="sgp-hint">
            Les gestionnaires de la liste décident de l'ajouter ou non.
          </p>
          {/* Le lien d'abord : il peut remplir tout le reste. */}
          <div className="sgp-form-row">
            <input
              className="sgp-input"
              type="url"
              placeholder="Lien du produit (facultatif)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <button
              type="button"
              className="gcg-btn gcg-btn--ghost sgp-fetch"
              disabled={!form.url.trim() || fetching}
              onClick={fetchFromUrl}
            >
              {fetching ? "⏳ Recherche…" : "🔍 Récupérer les infos"}
            </button>
          </div>
          {fetchMessage && <p className="sgp-hint">{fetchMessage}</p>}
          <input
            className="sgp-input"
            placeholder="Nom du cadeau *"
            maxLength={120}
            value={form.giftName}
            onChange={(e) => setForm({ ...form, giftName: e.target.value })}
          />
          <div className="sgp-form-row">
            <select
              className="sgp-input"
              value={form.occasion}
              onChange={(e) => setForm({ ...form, occasion: e.target.value })}
            >
              {(occasions ?? Object.keys(OCCASION_EMOJI)).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              className="sgp-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Prix €"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <input
            className="sgp-input"
            type="url"
            placeholder="Lien d'une image (facultatif)"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />
          {form.image.trim() && (
            <img
              src={form.image.trim()}
              alt=""
              className="sgp-preview"
              onError={(e) => e.target.classList.add("sgp-hidden")}
              onLoad={(e) => e.target.classList.remove("sgp-hidden")}
            />
          )}
          <div className="sgp-form-actions">
            <button
              type="submit"
              className="gcg-btn gcg-btn--primary"
              disabled={busy}
            >
              Envoyer la proposition
            </button>
            <button
              type="button"
              className="gcg-btn gcg-btn--ghost"
              disabled={busy}
              onClick={() => {
                setFormOpen(false);
                setError(null);
                setFetchMessage(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && <p className="sgp-error">{error}</p>}

      {removing && (
        <div className="sgp-undo" role="status">
          <div className="sgp-undo-row">
            <span>
              « {removing.giftName} »{" "}
              {statusOf(removing) === "pending" ? "retirée" : "effacée"}
            </span>
            <button
              type="button"
              className="sgp-undo-btn"
              onClick={undoRemove}
            >
              Annuler
            </button>
          </div>
          {/* Temps restant pour annuler. `key` : la barre repart de zéro si
              on efface une autre carte pendant le délai. */}
          <div className="sgp-undo-track" aria-hidden="true">
            <div key={removing._id} className="sgp-undo-bar" />
          </div>
        </div>
      )}

      {proposals.length > 0 && (
        <Section title="📝 Mes propositions" count={proposals.length} defaultOpen>
          <div className="gcg-grid">
            {[...pending, ...decided].map((p) =>
              card(p, {
                lines: [
                  statusOf(p) !== "pending"
                    ? `Réponse du ${shortDate(p.decidedAt)}`
                    : null,
                ],
                actions: (
                  <button
                    type="button"
                    className="gcg-btn gcg-btn--ghost"
                    disabled={busy}
                    onClick={() => askRemove(p)}
                  >
                    {statusOf(p) === "pending" ? "Retirer" : "Effacer"}
                  </button>
                ),
              }),
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

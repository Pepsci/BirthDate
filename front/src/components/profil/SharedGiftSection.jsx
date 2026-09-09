import { useEffect, useState, useCallback } from "react";
import apiHandler from "../../api/apiHandler";
import GiftCardGrid from "../UI/GiftCardGrid";
import ConfirmModal from "../UI/ConfirmModal";
import SharedListSharePanel from "../sharedGifts/SharedListSharePanel";
import useAuth from "../../context/useAuth";
import "./css/sharedGiftSection.css";

const OCCASIONS = [
  "Anniversaire",
  "Noël",
  "Saint-Valentin",
  "Fête des Mères",
  "Fête des Pères",
  "Mariage",
  "Naissance",
  "Diplôme",
  "Crémaillère",
  "Autre",
];

const NEXT_STATUS = {
  to_buy: "bought",
  bought: "to_give",
  to_give: "offered",
  offered: "to_buy",
};

export default function SharedGiftSection({ currentDate, onUpdate }) {
  const { currentUser } = useAuth();
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Création
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [sentInvites, setSentInvites] = useState([]);

  // Filtre par occasion. Une liste commune vit longtemps et mélange Noël,
  // anniversaire et le reste : sans filtre, préparer UNE occasion oblige à
  // faire le tri à l'œil à chaque visite.
  const [filter, setFilter] = useState("all");
  // Second axe : l'état de réservation. Indépendant de l'occasion — chercher
  // « ce qui reste à prendre pour Noël » croise les deux, et n'aurait pas de
  // réponse si l'un remplaçait l'autre.
  const [reservedFilter, setReservedFilter] = useState("all");
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Formulaire cadeau (ajout / édition)
  const [showShare, setShowShare] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    giftName: "",
    occasion: "Anniversaire",
    price: "",
    url: "",
  });

  const listId = currentDate.sharedGiftList;

  // ⚠️ Rôle du visiteur. Le serveur renvoie `myRole` ("member" | "viewer") sur
  // GET /:id et sur les routes de mutation ; le web l'ignorait totalement et
  // affichait à un invité les boutons d'ajout, d'édition et de suppression,
  // qui renvoyaient tous 403. On retombe sur "member" en l'absence du champ :
  // avant cette version, seuls des membres pouvaient atteindre cet écran.
  const isMember = !list || list.myRole !== "viewer";

  // Idées à afficher : filtre par occasion, puis séparation des déjà offerts.
  const allGifts = list?.gifts ?? [];
  // Le serveur renvoie deux formes selon le rôle : un MEMBRE reçoit
  // `reservedBy` / `reservedByGuest`, un INVITÉ seulement les booléens.
  const giftIsReserved = (g) =>
    g.isReserved ?? (!!g.reservedBy || !!g.reservedByGuest);
  // Le `!!currentUser?._id` n'est pas décoratif : sans lui, un cadeau non
  // réservé donne `undefined` à gauche, et un visiteur sans session `undefined`
  // à droite — l'égalité serait vraie et le filtre « Je m'en occupe »
  // retournerait TOUTE la liste.
  const giftIsMine = (g) =>
    g.reservedByMe ??
    (!!currentUser?._id &&
      (g.reservedBy?._id?.toString() === currentUser._id ||
        g.reservedBy?.toString() === currentUser._id));
  const byOccasion =
    filter === "all" ? allGifts : allGifts.filter((g) => g.occasion === filter);
  const filtered = byOccasion.filter((g) => {
    if (reservedFilter === "free") return !giftIsReserved(g);
    if (reservedFilter === "taken") return giftIsReserved(g);
    if (reservedFilter === "mine") return giftIsMine(g);
    return true;
  });
  const active = filtered.filter((g) => (g.status || "to_buy") !== "offered");
  const offered = filtered.filter((g) => (g.status || "to_buy") === "offered");

  const loadSent = useCallback(async () => {
    try {
      const res = await apiHandler.get(
        `/shared-gifts/sent?dateId=${currentDate._id}`,
      );
      setSentInvites(res.data || []);
    } catch {
      setSentInvites([]);
    }
  }, [currentDate._id]);

  const loadList = useCallback(async () => {
    if (!listId) {
      setList(null);
      loadSent();
      return;
    }
    setLoading(true);
    try {
      const res = await apiHandler.get(`/shared-gifts/${listId}`);
      setList(res.data);
    } catch {
      setError("Impossible de charger la liste commune.");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // ── Création : choisir un ami ──────────────────────────────────────────────
  const openPicker = async () => {
    setInviteMsg(null);
    setPickerOpen(true);
    try {
      const res = await apiHandler.get("/friends");
      setFriends((res.data || []).filter((f) => f?.friendUser?._id));
    } catch {
      setFriends([]);
    }
  };

  const invite = async (friendId) => {
    setPickerOpen(false);
    try {
      await apiHandler.post("/shared-gifts/invite", {
        friendId,
        dateId: currentDate._id,
      });
      setInviteMsg("Invitation envoyée ✅ En attente de la réponse.");
      loadSent();
    } catch {
      setError("Erreur lors de l'invitation.");
    }
  };

  const cancelInvite = async (id) => {
    try {
      await apiHandler.post(`/shared-gifts/invitations/${id}/cancel`);
      setSentInvites((prev) => prev.filter((i) => i._id !== id));
      setInviteMsg(null);
    } catch {
      setError("Erreur.");
    }
  };

  // ── CRUD cadeaux communs ───────────────────────────────────────────────────
  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.giftName.trim()) return;
    const payload = {
      giftName: form.giftName.trim(),
      occasion: form.occasion,
      price: form.price ? Number(form.price) : null,
      url: form.url.trim() || null,
    };
    try {
      if (editing) {
        const res = await apiHandler.patch(
          `/shared-gifts/${listId}/gifts/${editing._id}`,
          payload,
        );
        setList(res.data);
      } else {
        const res = await apiHandler.post(
          `/shared-gifts/${listId}/gifts`,
          payload,
        );
        setList(res.data);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ giftName: "", occasion: "Anniversaire", price: "", url: "" });
    } catch {
      setError("Erreur lors de l'enregistrement.");
    }
  };

  const toggleStatus = async (raw) => {
    const next = NEXT_STATUS[raw.status || (raw.purchased ? "bought" : "to_buy")];
    try {
      const res = await apiHandler.patch(
        `/shared-gifts/${listId}/gifts/${raw._id}`,
        { status: next },
      );
      setList(res.data);
    } catch {
      setError("Erreur.");
    }
  };

  const setStatus = async (raw, status) => {
    try {
      const res = await apiHandler.patch(
        `/shared-gifts/${listId}/gifts/${raw._id}`,
        { status },
      );
      setList(res.data);
    } catch {
      setError("Erreur.");
    }
  };

  /**
   * Masquer une idée aux invités et au lien public. Elle reste dans la liste
   * pour les gestionnaires — c'est ce qu'on garde entre soi : le gros cadeau
   * qu'on se réserve, l'idée encore incertaine.
   *
   * Le filtrage est fait par le SERVEUR : une idée masquée ne part jamais sur
   * le réseau vers quelqu'un qui n'y a pas droit, plutôt que d'être cachée à
   * l'affichage.
   */
  const toggleHidden = async (raw, next) => {
    try {
      const res = await apiHandler.patch(
        `/shared-gifts/${listId}/gifts/${raw._id}`,
        { hiddenFromViewers: next },
      );
      setList(res.data);
    } catch {
      setError("Erreur.");
    }
  };

  const deleteGift = async (id) => {
    try {
      const res = await apiHandler.delete(`/shared-gifts/${listId}/gifts/${id}`);
      setList(res.data);
    } catch {
      setError("Erreur.");
    }
  };

  const startEdit = (raw) => {
    setEditing(raw);
    setForm({
      giftName: raw.giftName || "",
      occasion: raw.occasion || "Anniversaire",
      price: raw.price != null ? String(raw.price) : "",
      url: raw.url || "",
    });
    setShowForm(true);
  };

  // ── Réservation ──────────────────────────────────────────────────────────
  // « Je m'en occupe » : c'est ce qui évite que deux personnes achètent la même
  // chose. Le web n'appelait tout simplement pas ces routes — une réservation
  // faite depuis le mobile ou le lien public n'apparaissait nulle part ici, et
  // aucune ne pouvait être créée depuis le web.
  const reserve = async (giftId) => {
    try {
      const res = await apiHandler.post(
        `/shared-gifts/${listId}/gifts/${giftId}/reserve`,
      );
      setList(res.data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Impossible de réserver ce cadeau.",
      );
    }
  };

  const unreserve = async (giftId) => {
    try {
      const res = await apiHandler.post(
        `/shared-gifts/${listId}/gifts/${giftId}/unreserve`,
      );
      setList(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    }
  };

  const leave = async () => {
    try {
      await apiHandler.post(`/shared-gifts/${listId}/leave`);
      setConfirmLeave(false);
      onUpdate?.({ ...currentDate, sharedGiftList: null });
      setList(null);
    } catch (err) {
      setConfirmLeave(false);
      setError(err?.response?.data?.message || "Erreur.");
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (!listId) {
    return (
      <div className="sgs-empty">
        <div className="sgs-empty-emoji">👥</div>
        <h3>Liste d'idées commune</h3>
        <p>
          Partage une liste d'idées cadeaux avec un proche : vous la voyez et
          l'éditez tous les deux.
        </p>
        {inviteMsg && <p className="sgs-invite-msg">{inviteMsg}</p>}
        <button className="sgs-btn" onClick={openPicker}>
          ＋ Créer une liste commune
        </button>

        {sentInvites.map((inv) => (
          <div key={inv._id} className="sgs-sent-row">
            <span>
              En attente de {inv.toUser?.name} {inv.toUser?.surname || ""}…
            </span>
            <button className="sgs-cancel" onClick={() => cancelInvite(inv._id)}>
              Annuler
            </button>
          </div>
        ))}

        {pickerOpen && (
          <div className="sgs-modal-overlay" onClick={() => setPickerOpen(false)}>
            <div className="sgs-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Avec qui créer la liste ?</h3>
              <p className="sgs-modal-sub">
                Il recevra une invitation à rejoindre la liste.
              </p>
              {friends.length === 0 && <p>Aucun ami disponible.</p>}
              {friends.map((f) => (
                <button
                  key={f.friendship._id}
                  className="sgs-friend-row"
                  onClick={() => invite(f.friendUser._id)}
                >
                  {f.friendUser.name} {f.friendUser.surname || ""}
                </button>
              ))}
              <button
                className="sgs-btn sgs-btn--ghost"
                onClick={() => setPickerOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading && !list) return <p className="sgs-loading">Chargement…</p>;
  if (!list) return <p className="sgs-loading">{error || "…"}</p>;

  return (
    <div className="sgs-wrapper">
      <div className="sgs-header">
        <h2>👥 Idées communes</h2>
        {isMember && (
          <div className="sgs-header-actions">
            <button
              className="sgs-btn sgs-btn--sm"
              onClick={() => setShowShare((v) => !v)}
            >
              {showShare ? "✕ Fermer" : "🔗 Partager"}
            </button>
            <button
              className="sgs-btn sgs-btn--sm"
              onClick={() => {
                setEditing(null);
                setForm({
                  giftName: "",
                  occasion: "Anniversaire",
                  price: "",
                  url: "",
                });
                setShowForm((v) => !v);
              }}
            >
              {showForm ? "✕ Fermer" : "＋ Ajouter"}
            </button>
          </div>
        )}
      </div>

      {/* ⚠️ Garde indispensable : pour un invité, le serveur met `members` à
          undefined (les identités lui sont masquées) — sans le `?? []`, ce
          .map() faisait planter tout l'écran. */}
      {isMember && (
        <p className="sgs-members">
          Membres :{" "}
          {(list.members ?? [])
            .map((m) => `${m.name}${m.surname ? " " + m.surname : ""}`)
            .join(", ")}
        </p>
      )}

      {!isMember && (
        <p className="sgs-members">
          Vous consultez cette liste en invité : vous pouvez réserver une idée,
          mais pas la modifier. Les cadeaux déjà achetés ou offerts ne vous sont
          pas montrés.
        </p>
      )}

      {isMember && showShare && (
        <SharedListSharePanel
          listId={listId}
          onClose={() => setShowShare(false)}
        />
      )}
      {error && <p className="sgs-error">{error}</p>}

      {isMember && showForm && (
        <form className="sgs-form" onSubmit={submitForm}>
          <input
            className="sgs-input"
            placeholder="Nom du cadeau *"
            value={form.giftName}
            onChange={(e) => setForm({ ...form, giftName: e.target.value })}
          />
          <div className="sgs-form-row">
            <select
              className="sgs-input"
              value={form.occasion}
              onChange={(e) => setForm({ ...form, occasion: e.target.value })}
            >
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              className="sgs-input"
              placeholder="Prix €"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <input
            className="sgs-input"
            placeholder="Lien (optionnel)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <button className="sgs-btn" type="submit">
            {editing ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      )}

      {/* Filtre par occasion — seules celles réellement présentes : proposer
          un filtre qui ne renvoie rien est une impasse. */}
      {list.gifts.length > 0 && (
        <div className="sgs-filters">
          <button
            type="button"
            className={`sgs-chip ${filter === "all" ? "sgs-chip--on" : ""}`}
            onClick={() => setFilter("all")}
          >
            Toutes
          </button>
          {OCCASIONS.filter((o) =>
            list.gifts.some((g) => g.occasion === o),
          ).map((o) => (
            <button
              key={o}
              type="button"
              className={`sgs-chip ${filter === o ? "sgs-chip--on" : ""}`}
              onClick={() => setFilter(o)}
            >
              {o}
            </button>
          ))}

          {/* Second axe : l'état de réservation. Sur une liste tenue à
              plusieurs, la question courante n'est pas « quelles idées » mais
              « qu'est-ce qui reste à prendre ». */}
          <span className="sgs-chip-sep" aria-hidden="true" />
          {[
            ["all", "Toutes"],
            ["free", "🆓 Libres"],
            ["taken", "🔒 Réservées"],
            ["mine", "✓ Je m'en occupe"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`sgs-chip ${reservedFilter === value ? "sgs-chip--on" : ""}`}
              onClick={() => setReservedFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="sgs-loading">
          {list.gifts.length === 0
            ? "Aucune idée commune pour l'instant."
            : reservedFilter === "free"
              ? "Tout est déjà réservé pour ce filtre 🎁"
              : "Aucune idée pour ce filtre."}
        </p>
      )}

      <GiftCardGrid
        items={active}
        type="gifts"
        currentUserId={currentUser?._id}
        // readOnly retire les actions de gestion et fait apparaître, à la
        // place, le bouton de réservation — la seule action ouverte à un invité.
        readOnly={!isMember}
        onEdit={isMember ? startEdit : undefined}
        onDelete={isMember ? deleteGift : undefined}
        onToggle={isMember ? toggleStatus : undefined}
        onReserve={reserve}
        onUnreserve={unreserve}
        onToggleHidden={isMember ? toggleHidden : undefined}
        onSetStatus={isMember ? setStatus : undefined}
      />

      {/* Déjà offerts, sous un trait. Rangés, pas cachés : c'est la mémoire de
          ce qui a été offert, et donc ce qui évite d'offrir deux fois la même
          chose l'année suivante. Les invités ne sont pas concernés — le
          serveur ne leur envoie jamais les cadeaux « offert ». */}
      {offered.length > 0 && (
        <section className="sgs-offered">
          <div className="sgs-offered-divider" />
          <h4 className="sgs-offered-title">
            🎉 Déjà offerts · {offered.length}
          </h4>
          <GiftCardGrid
            items={offered}
            type="gifts"
            currentUserId={currentUser?._id}
            readOnly={!isMember}
            onEdit={isMember ? startEdit : undefined}
            onDelete={isMember ? deleteGift : undefined}
            onToggle={isMember ? toggleStatus : undefined}
            onReserve={reserve}
            onUnreserve={unreserve}
            onToggleHidden={isMember ? toggleHidden : undefined}
            onSetStatus={isMember ? setStatus : undefined}
          />
        </section>
      )}

      {/* Le texte diffère selon le rôle : un membre peut faire disparaître la
          liste s'il est le dernier, un invité perd seulement son accès. */}
      <ConfirmModal
        open={confirmLeave}
        title={
          isMember ? "Quitter la liste commune ?" : "Ne plus suivre cette liste ?"
        }
        message={
          isMember
            ? "Vos idées y restent pour les autres membres. Si vous êtes le dernier, la liste sera supprimée."
            : "Vous perdrez l'accès à cette liste. Un membre pourra vous la repartager plus tard."
        }
        confirmLabel={isMember ? "Quitter" : "Ne plus suivre"}
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />

      <button className="sgs-leave" onClick={() => setConfirmLeave(true)}>
        {isMember ? "Quitter la liste commune" : "Ne plus suivre cette liste"}
      </button>
    </div>
  );
}

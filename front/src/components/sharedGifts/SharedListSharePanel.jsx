import { useCallback, useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/sharedListSharePanel.css";

/**
 * Partage et accès d'une liste commune — réservé aux membres.
 *
 * Ce panneau n'existait pas côté web. Les routes serveur (`/:id/share`,
 * `/:id/access`, `/:id/viewers`, `/:id/access/code`) étaient toutes en place et
 * utilisées par l'app mobile, mais aucun composant React ne les appelait : sur
 * le web, une fois la liste créée, il n'y avait plus aucun moyen d'y donner
 * accès à qui que ce soit.
 *
 * Trois façons de partager, volontairement présentées ensemble parce qu'elles
 * répondent à trois besoins différents :
 *  - inviter un MEMBRE : il co-gère la liste (via l'invitation à accepter, gérée
 *    par le composant parent) ;
 *  - ajouter un INVITÉ : il consulte et peut réserver, sans rien modifier ;
 *  - le LIEN PUBLIC : pour quelqu'un qui n'a pas de compte. Le code d'accès
 *    n'est demandé qu'au moment de réserver, jamais pour consulter.
 */
export default function SharedListSharePanel({ listId, onClose }) {
  const [access, setAccess] = useState(null);
  const [share, setShare] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, sh] = await Promise.all([
        apiHandler.get(`/shared-gifts/${listId}/access`),
        apiHandler.get(`/shared-gifts/${listId}/share`),
      ]);
      setAccess(a.data);
      setShare(sh.data);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Impossible de charger les accès.",
      );
    }
  }, [listId]);

  useEffect(() => {
    load();
  }, [load]);

  const openPicker = async () => {
    setPickerOpen(true);
    try {
      const res = await apiHandler.get("/friends");
      setFriends((res.data || []).filter((f) => f?.friendUser?._id));
    } catch {
      setFriends([]);
    }
  };

  const addViewer = async (friendId) => {
    setBusy(true);
    setError(null);
    try {
      await apiHandler.post(`/shared-gifts/${listId}/viewers`, { friendId });
      setPickerOpen(false);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors du partage.");
    } finally {
      setBusy(false);
    }
  };

  const removeViewer = async (userId, name) => {
    if (!window.confirm(`Retirer l'accès de ${name} ?`)) return;
    setBusy(true);
    try {
      await apiHandler.delete(`/shared-gifts/${listId}/viewers/${userId}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async () => {
    setBusy(true);
    try {
      const res = await apiHandler.patch(`/shared-gifts/${listId}/share/toggle`);
      setShare(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const regenerateCode = async () => {
    if (
      !window.confirm(
        "Générer un nouveau code ?\n\nL'ancien cessera de fonctionner : les personnes à qui vous l'aviez donné ne pourront plus réserver tant qu'elles n'auront pas le nouveau.",
      )
    )
      return;
    setBusy(true);
    try {
      const res = await apiHandler.post(`/shared-gifts/${listId}/access/code`);
      setAccess((prev) => ({ ...prev, accessCode: res.data.accessCode }));
      // Le lien « lien + code » embarque l'ancien code : le laisser affiché
      // ferait copier un lien qui ne déverrouille plus rien.
      setShare((prev) =>
        prev
          ? {
              ...prev,
              accessCode: res.data.accessCode,
              publicUrlWithCode: res.data.publicUrlWithCode,
            }
          : prev,
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!access || !share) {
    return (
      <div className="slsp">
        <p className="slsp-muted">{error || "Chargement…"}</p>
      </div>
    );
  }

  const viewers = access.viewers || [];
  // Un membre ou un invité déjà présent n'a pas à réapparaître dans le
  // sélecteur : le serveur refuserait de toute façon, autant ne pas le proposer.
  const alreadyIn = new Set([
    ...(access.members || []).map((m) => m._id),
    ...viewers.map((v) => v.user?._id),
  ]);
  const selectable = friends.filter(
    (f) => !alreadyIn.has(f.friendUser._id),
  );

  return (
    <div className="slsp">
      <div className="slsp-head">
        <h3>🔗 Partage et accès</h3>
        {onClose && (
          <button className="slsp-close" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {error && <p className="slsp-error">{error}</p>}

      {/* ── Invités ────────────────────────────────────────────────────── */}
      <section className="slsp-section">
        <div className="slsp-section-head">
          <h4>👀 Invités</h4>
          <button
            className="slsp-btn slsp-btn--sm"
            disabled={busy}
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
          >
            {pickerOpen ? "✕ Fermer" : "＋ Partager à un contact"}
          </button>
        </div>
        <p className="slsp-muted">
          Ils consultent la liste et peuvent réserver une idée, mais ne peuvent
          rien ajouter ni modifier. Les cadeaux déjà achetés ou offerts leur sont
          masqués.
        </p>

        {pickerOpen && (
          <ul className="slsp-picker">
            {selectable.length === 0 ? (
              <li className="slsp-muted">
                Aucun contact à ajouter — ils ont déjà tous accès.
              </li>
            ) : (
              selectable.map((f) => (
                <li key={f.friendUser._id}>
                  <span>
                    {f.friendUser.name} {f.friendUser.surname}
                  </span>
                  <button
                    className="slsp-btn slsp-btn--sm"
                    disabled={busy}
                    onClick={() => addViewer(f.friendUser._id)}
                  >
                    Partager
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {viewers.length === 0 ? (
          <p className="slsp-muted">Personne pour l'instant.</p>
        ) : (
          <ul className="slsp-people">
            {viewers.map((v) => (
              <li key={v.user._id}>
                <span>
                  {v.user.name} {v.user.surname}
                </span>
                <button
                  className="slsp-btn slsp-btn--ghost slsp-btn--sm"
                  disabled={busy}
                  onClick={() =>
                    removeViewer(v.user._id, v.user.name || "ce contact")
                  }
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Lien public ────────────────────────────────────────────────── */}
      <section className="slsp-section">
        <div className="slsp-section-head">
          <h4>🌍 Lien public</h4>
          <button
            className="slsp-btn slsp-btn--sm"
            disabled={busy}
            onClick={togglePublic}
          >
            {share.isPublic ? "Désactiver" : "Activer"}
          </button>
        </div>
        <p className="slsp-muted">
          Pour partager la liste à quelqu'un qui n'a pas de compte.{" "}
          {access.accessCode
            ? "Avec un code, le lien ne montre rien tant qu'il n'est pas saisi."
            : "Sans code, toute personne ayant le lien voit les idées et peut en réserver."}
        </p>

        {share.isPublic && share.publicUrl && (
          <>
            {/* Le lien qui porte le code passe en premier : depuis que le
                code garde la porte, envoyer le lien nu oblige à envoyer le
                code dans un second message, et la moitié des gens ne le font
                pas. Le lien nu reste dessous pour qui préfère transmettre le
                code de vive voix. */}
            {share.publicUrlWithCode && (
              <div className="slsp-copyrow">
                <input
                  readOnly
                  value={share.publicUrlWithCode}
                  className="slsp-input"
                />
                <button
                  className="slsp-btn slsp-btn--sm"
                  onClick={() => copy(share.publicUrlWithCode)}
                >
                  {copied ? "✓ Copié" : "📋 Lien + code"}
                </button>
              </div>
            )}
            <div className="slsp-copyrow">
              <input readOnly value={share.publicUrl} className="slsp-input" />
              <button
                className="slsp-btn slsp-btn--sm"
                onClick={() => copy(share.publicUrl)}
              >
                {copied
                  ? "✓ Copié"
                  : share.publicUrlWithCode
                    ? "📋 Lien seul"
                    : "📋 Copier"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Code de réservation ────────────────────────────────────────── */}
      <section className="slsp-section">
        <div className="slsp-section-head">
          <h4>🔑 Code d'accès</h4>
          <button
            className="slsp-btn slsp-btn--sm"
            disabled={busy}
            onClick={regenerateCode}
          >
            {access.accessCode ? "Régénérer" : "Générer"}
          </button>
        </div>
        <p className="slsp-muted">
          Demandé aux visiteurs du lien public pour OUVRIR la liste. Tant
          qu'il n'est pas saisi, les idées ne sont pas envoyées : le lien peut
          circuler sans montrer ce que vous préparez. Régénérer le code
          invalide les liens déjà distribués qui le contenaient.
        </p>
        {access.accessCode && (
          <div className="slsp-copyrow">
            <code className="slsp-code">{access.accessCode}</code>
            <button
              className="slsp-btn slsp-btn--sm"
              onClick={() => copy(access.accessCode)}
            >
              {copied ? "✓ Copié" : "📋 Copier"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

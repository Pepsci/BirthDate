import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./css/publicSharedList.css";

const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api"
    : "https://birthreminder.com/api";

// Emojis d'occasion — miroir de mobile/src/lib/occasions.ts, pour qu'une meme
// idee porte le meme symbole dans l'app et sur la page publique.
const OCCASION_EMOJI = {
  Anniversaire: "🎂",
  "Noël": "🎄",
  "Saint-Valentin": "💝",
  "Fête des Mères": "💐",
  "Fête des Pères": "👔",
  Mariage: "💍",
  Naissance: "👶",
  "Diplôme": "🎓",
  "Crémaillère": "🏠",
  Autre: "✨",
};

const occasionEmoji = (occasion) => OCCASION_EMOJI[occasion] ?? "🎁";

/**
 * « de Marie » / « d'Arthur ». L'elision se fait sur la voyelle initiale,
 * accents compris — « d'Élise », pas « de Élise ».
 */
function withPreposition(name) {
  const first = (name || "").trim().charAt(0).toLowerCase();
  return /[aeiouyàâäéèêëîïôöùûü]/.test(first) ? `d'${name}` : `de ${name}`;
}

// Identite du visiteur, conservee localement : c'est elle qui lui permettra
// de liberer SA reservation plus tard, depuis le meme navigateur.
const nameKey = "psl_guest_name";
const codeKey = (slug) => `psl_code_${slug}`;

/**
 * Vue publique d'une liste d'idees commune — /liste/:slug, sans compte.
 *
 * Le lien seul suffit pour CONSULTER. Reserver demande le code de la liste,
 * exactement comme le code ami des wishlists personnelles : le lien peut donc
 * circuler librement sans que quiconque puisse bloquer tous les cadeaux.
 *
 * Les prenoms des reserveurs ne sont jamais exposes ici — un lien public peut
 * etre transfere a la personne concernee. Seuls les membres, dans
 * l'application, voient qui s'occupe de quoi.
 */
export default function PublicSharedList() {
  const { publicSlug } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [brokenImages, setBrokenImages] = useState(() => new Set());

  const [guestName, setGuestName] = useState(
    () => localStorage.getItem(nameKey) || "",
  );
  const [code, setCode] = useState(
    () => localStorage.getItem(codeKey(publicSlug)) || "",
  );

  const [pendingGift, setPendingGift] = useState(null); // { id, action }
  const [modalOpen, setModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  const fetchList = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_URL}/shared-gifts/public/${publicSlug}`,
      );
      setData(res.data);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? "Cette liste n'existe pas ou n'est plus partagee."
          : "Impossible de charger cette liste pour le moment.",
      );
    } finally {
      setLoading(false);
    }
  }, [publicSlug]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Envoie la reservation. Retourne false si le serveur refuse le code, pour
  // que l'appelant puisse redemander une saisie plutot qu'afficher une erreur.
  const send = async (giftId, action, withName, withCode) => {
    setWorkingId(giftId);
    try {
      await axios.post(
        `${API_URL}/shared-gifts/public/${publicSlug}/gifts/${giftId}/${action}`,
        { guestName: withName, code: withCode },
      );
      await fetchList();
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) return false;
      setError(
        err?.response?.data?.message ?? "L'operation n'a pas pu aboutir.",
      );
      return true;
    } finally {
      setWorkingId(null);
    }
  };

  // Reserver / liberer. On ouvre la fenetre de saisie seulement si une
  // information manque (prenom, ou code quand la liste en exige un).
  const act = async (gift, action) => {
    const needsCode = data?.requiresCode && !code;
    if (!guestName || needsCode) {
      setPendingGift({ id: gift._id, action });
      setNameInput(guestName);
      setCodeInput(code);
      setModalError("");
      setModalOpen(true);
      return;
    }
    const ok = await send(gift._id, action, guestName, code);
    if (!ok) {
      // Code devenu invalide (change par un membre) : on le redemande.
      localStorage.removeItem(codeKey(publicSlug));
      setCode("");
      setPendingGift({ id: gift._id, action });
      setNameInput(guestName);
      setCodeInput("");
      setModalError("Ce code n'est plus valide.");
      setModalOpen(true);
    }
  };

  const submitModal = async (e) => {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) {
      setModalError("Indique ton prenom.");
      return;
    }
    const c = codeInput.trim().toUpperCase();
    const ok = await send(pendingGift.id, pendingGift.action, n, c);
    if (!ok) {
      setModalError("Code d'acces invalide.");
      return;
    }
    localStorage.setItem(nameKey, n);
    setGuestName(n);
    if (c) {
      localStorage.setItem(codeKey(publicSlug), c);
      setCode(c);
    }
    setModalOpen(false);
    setPendingGift(null);
  };

  if (loading) {
    return <div className="psl-loading">Chargement de la liste…</div>;
  }

  if (error && !data) {
    return (
      <div className="psl-error-page">
        <span className="psl-error-icon">🎁</span>
        <p>{error}</p>
      </div>
    );
  }

  const gifts = data?.gifts ?? [];

  return (
    <div className="psl-page">
      <header className="psl-header">
        <div className="psl-header-inner">
          <a href="https://birthreminder.com" className="psl-logo">
            🎂 BirthReminder
          </a>
          <p className="psl-tagline">
            {data?.label
              ? `Liste de cadeaux ${withPreposition(data.label)}`
              : "Liste de cadeaux commune"}
          </p>
        </div>
      </header>

      <main className="psl-main">
        {error && <p className="psl-inline-error">{error}</p>}

        {gifts.length === 0 ? (
          <div className="psl-empty">
            <span>🎁</span>
            <p>Aucune idee dans cette liste pour l'instant.</p>
          </div>
        ) : (
          <>
            <p className="psl-count">
              {gifts.length} idee{gifts.length > 1 ? "s" : ""} ·{" "}
              {data.memberCount} participant
              {data.memberCount > 1 ? "s" : ""}
            </p>

            <div className="psl-grid">
              {gifts.map((g) => (
                <article
                  key={g._id}
                  className={`psl-card${g.isReserved ? " psl-card--reserved" : ""}`}
                >
                  <div className="psl-card-img-wrap">
                    {g.image && !brokenImages.has(g._id) ? (
                      <img
                        src={g.image}
                        alt=""
                        className="psl-card-img"
                        loading="lazy"
                        onError={() =>
                          setBrokenImages((prev) => new Set(prev).add(g._id))
                        }
                      />
                    ) : (
                      <div className="psl-card-img-placeholder">
                        {occasionEmoji(g.occasion)}
                      </div>
                    )}
                  </div>

                  <div className="psl-card-body">
                    <h3 className="psl-card-title">{g.giftName}</h3>
                    {g.occasion && (
                      <p className="psl-card-meta">{g.occasion}</p>
                    )}

                    <div className="psl-card-footer">
                      {g.price != null && (
                        <span className="psl-card-price">{g.price} €</span>
                      )}
                      {g.isReserved && (
                        <span className="psl-badge psl-badge--reserved">
                          Reserve
                        </span>
                      )}
                    </div>

                    {g.url && (
                      <a
                        href={g.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="psl-card-link"
                      >
                        Voir le cadeau
                      </a>
                    )}

                    <button
                      type="button"
                      className={`psl-btn${g.isReserved ? " psl-btn--free" : " psl-btn--reserve"}`}
                      disabled={workingId === g._id}
                      onClick={() =>
                        act(g, g.isReserved ? "unreserve" : "reserve")
                      }
                    >
                      {workingId === g._id
                        ? "…"
                        : g.isReserved
                          ? "Liberer ma reservation"
                          : "Je m'en occupe"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        <p className="psl-notice">
          Reserver empeche quelqu'un d'autre d'offrir le meme cadeau. Seule la
          personne ayant reserve peut liberer sa reservation.
        </p>
      </main>

      {modalOpen && (
        <div className="psl-modal-overlay">
          <div className="psl-modal">
            <h3>Avant de reserver</h3>
            <form onSubmit={submitModal}>
              <label className="psl-modal-label">Ton prenom</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Marie"
                maxLength={40}
                autoFocus
                className="psl-modal-input"
              />

              {data?.requiresCode && (
                <>
                  <label className="psl-modal-label">
                    Code de la liste
                  </label>
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="psl-modal-input psl-modal-input--code"
                  />
                </>
              )}

              {modalError && <p className="psl-modal-error">{modalError}</p>}

              <div className="psl-modal-actions">
                <button
                  type="button"
                  className="psl-modal-cancel"
                  onClick={() => {
                    setModalOpen(false);
                    setPendingGift(null);
                  }}
                >
                  Annuler
                </button>
                <button type="submit" className="psl-modal-confirm">
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
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

// ── Identite du visiteur ────────────────────────────────────────────────────
// Le prenom ne peut PAS jouer ce role : il ne prouve rien, il se devine, et
// le serveur ne peut pas s'en servir pour reconnaitre le navigateur qui a
// reserve. D'ou un jeton tire au hasard, garde en local — c'est lui qui vaut
// « c'est bien moi », et lui seul autorise a liberer une reservation.
const tokenKey = "psl_guest_token";
const nameKey = "psl_guest_name";
const emailKey = "psl_guest_email";
const codeKey = (slug) => `psl_code_${slug}`;

/** Lecture tolerante : un navigateur peut refuser le stockage local. */
function readLocal(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* navigation privee, stockage bloque : on continue sans memoriser */
  }
}

/**
 * Jeton du visiteur. `randomUUID` est absent des contextes non securises
 * (http) et des navigateurs anciens : le repli doit rester assez long pour
 * que le serveur l'accepte (16 caracteres minimum).
 */
function newToken() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/**
 * Identite du visiteur pour cette visite, etablie UNE fois avant tout appel.
 *
 * ⚠️ L'ordre compte. Le lien du mail de confirmation porte le jeton (`g`) et
 * le code (`c`) : c'est ce qui permet de retrouver sa reservation depuis un
 * autre appareil, ou le stockage local est vide. Si on lit le stockage local
 * avant de regarder l'URL, on repart avec un jeton tout neuf et le lien du
 * mail ne sert plus a rien — la fonctionnalite entiere tombe.
 *
 * L'adresse est nettoyee ensuite : un copier-coller de l'URL ne doit pas
 * diffuser le jeton de quelqu'un.
 */
function bootstrapGuest(slug) {
  const params = new URLSearchParams(window.location.search);
  const fromLink = params.get("g");
  const codeFromLink = params.get("c");

  if (fromLink && fromLink.length >= 16) writeLocal(tokenKey, fromLink);

  let token = readLocal(tokenKey);
  if (!token) {
    token = newToken();
    writeLocal(tokenKey, token);
  }

  const code = codeFromLink || readLocal(codeKey(slug)) || "";
  if (codeFromLink || fromLink) {
    window.history.replaceState({}, "", window.location.pathname);
  }
  return { token, code };
}

/**
 * Vue publique d'une liste d'idees commune — /liste/:slug, sans compte.
 *
 * Le CODE OUVRE LA LISTE : tant qu'il n'est pas donne, l'API ne renvoie meme
 * pas les idees. Le lien seul ne montre donc rien, et peut circuler sans
 * exposer ce que quelqu'un prepare. Une liste sans code reste ouverte au lien
 * seul, c'est le choix de celui qui partage.
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

  // Etabli avant le premier rendu et fige pour toute la visite.
  const boot = useRef(null);
  if (boot.current === null) boot.current = bootstrapGuest(publicSlug);
  const guestToken = boot.current.token;

  const [guestName, setGuestName] = useState(() => readLocal(nameKey));
  const [guestEmail, setGuestEmail] = useState(() => readLocal(emailKey));
  const [code, setCode] = useState("");

  // Deverrouillage
  const [codeInput, setCodeInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // Saisie prenom / mail avant la premiere reservation
  const [pendingGift, setPendingGift] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [modalError, setModalError] = useState("");
  const [workingId, setWorkingId] = useState(null);

  /**
   * Charge la liste. Sans code on ne recoit que la coquille (titre + « il faut
   * un code ») ; avec un code valide, les idees.
   */
  const fetchList = useCallback(
    async (withCode) => {
      try {
        const shell = await axios.get(
          `${API_URL}/shared-gifts/public/${publicSlug}`,
        );

        if (!shell.data.locked) {
          setData(shell.data);
          return true;
        }

        setData(shell.data);
        if (!withCode) return false;

        const full = await axios.post(
          `${API_URL}/shared-gifts/public/${publicSlug}/view`,
          { code: withCode, guestToken },
        );
        setData(full.data);
        setCode(withCode);
        writeLocal(codeKey(publicSlug), withCode);
        return true;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 403) return false;
        setError(
          status === 404
            ? "Cette liste n'existe pas ou n'est plus partagee."
            : "Impossible de charger cette liste pour le moment.",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [publicSlug, guestToken],
  );

  useEffect(() => {
    fetchList(boot.current.code);
  }, [fetchList]);

  const submitUnlock = async (e) => {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (!c) {
      setUnlockError("Saisis le code de la liste.");
      return;
    }
    setUnlocking(true);
    const ok = await fetchList(c);
    setUnlocking(false);
    setUnlockError(ok ? "" : "Ce code ne correspond pas a cette liste.");
  };

  /**
   * Envoie une reservation ou une liberation. Renvoie le `reason` du serveur
   * en cas de refus — « code invalide » et « ce n'est pas ta reservation »
   * arrivent tous deux en 403, et les confondre affichait « code incorrect »
   * a quelqu'un dont le code etait bon.
   */
  const send = async (giftId, action, payload) => {
    setWorkingId(giftId);
    try {
      const res = await axios.post(
        `${API_URL}/shared-gifts/public/${publicSlug}/gifts/${giftId}/${action}`,
        { code, guestToken, ...payload },
      );
      setData(res.data);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err?.response?.data?.reason ?? null,
        message: err?.response?.data?.message ?? null,
      };
    } finally {
      setWorkingId(null);
    }
  };

  const handleFailure = (res) => {
    if (res.reason === "BAD_CODE") {
      // Le code a change pendant la visite : on renvoie a la porte.
      writeLocal(codeKey(publicSlug), "");
      setCode("");
      setData((d) => (d ? { ...d, locked: true, gifts: [] } : d));
      setUnlockError("Le code de cette liste a change.");
      return;
    }
    setError(res.message ?? "L'operation n'a pas pu aboutir.");
  };

  const reserve = async (gift) => {
    if (!guestName) {
      setPendingGift(gift._id);
      setNameInput(guestName);
      setEmailInput(guestEmail);
      setModalError("");
      return;
    }
    const res = await send(gift._id, "reserve", {
      guestName,
      guestEmail: guestEmail || undefined,
    });
    if (!res.ok) handleFailure(res);
  };

  const release = async (gift) => {
    const res = await send(gift._id, "unreserve", {});
    if (!res.ok) handleFailure(res);
  };

  const submitModal = async (e) => {
    e.preventDefault();
    const n = nameInput.trim();
    if (!n) {
      setModalError("Indique ton prenom.");
      return;
    }
    const mail = emailInput.trim();
    const res = await send(pendingGift, "reserve", {
      guestName: n,
      guestEmail: mail || undefined,
    });
    if (!res.ok) {
      if (res.reason === "BAD_EMAIL") {
        setModalError("Cette adresse email ne semble pas valide.");
        return;
      }
      setPendingGift(null);
      handleFailure(res);
      return;
    }
    writeLocal(nameKey, n);
    setGuestName(n);
    writeLocal(emailKey, mail);
    setGuestEmail(mail);
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

  const header = (
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
  );

  // ── Porte fermee ──────────────────────────────────────────────────────────
  // Les idees ne sont pas dans `data` : le serveur ne les a pas envoyees.
  // Rien a cacher cote client, donc rien a contourner en lisant la page.
  if (data?.locked) {
    return (
      <div className="psl-page">
        {header}
        <main className="psl-main">
          <div className="psl-gate">
            <span className="psl-gate-icon">🔒</span>
            <h2 className="psl-gate-title">Cette liste est protegee</h2>
            <p className="psl-gate-sub">
              Saisis le code communique par la personne qui t'a partage le
              lien pour voir les idees et en reserver une.
            </p>
            <form onSubmit={submitUnlock} className="psl-gate-form">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoFocus
                className="psl-modal-input psl-modal-input--code"
              />
              {unlockError && <p className="psl-modal-error">{unlockError}</p>}
              <button
                type="submit"
                className="psl-modal-confirm"
                disabled={unlocking}
              >
                {unlocking ? "Verification…" : "Ouvrir la liste"}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const gifts = data?.gifts ?? [];

  return (
    <div className="psl-page">
      {header}

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
                          {g.reservedByMe ? "Ta reservation" : "Reserve"}
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

                    {/* Trois etats bien distincts. Avant, tout cadeau reserve
                        affichait « liberer ma reservation » a TOUT LE MONDE :
                        le serveur ne pouvait pas dire qui avait reserve, donc
                        chaque visiteur croyait que la reservation etait la
                        sienne — et se prenait un refus en cliquant. */}
                    {g.reservedByMe ? (
                      <button
                        type="button"
                        className="psl-btn psl-btn--free"
                        disabled={workingId === g._id}
                        onClick={() => release(g)}
                      >
                        {workingId === g._id
                          ? "…"
                          : "Liberer ma reservation"}
                      </button>
                    ) : g.isReserved ? (
                      <button type="button" className="psl-btn" disabled>
                        Deja reserve
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="psl-btn psl-btn--reserve"
                        disabled={workingId === g._id}
                        onClick={() => reserve(g)}
                      >
                        {workingId === g._id ? "…" : "Je m'en occupe"}
                      </button>
                    )}
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

      {pendingGift && (
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

              <label className="psl-modal-label">
                Ton email <span className="psl-optional">(facultatif)</span>
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="marie@exemple.fr"
                maxLength={120}
                className="psl-modal-input"
              />
              <p className="psl-modal-hint">
                Pour recevoir la confirmation et retrouver ta reservation
                depuis un autre appareil. Sans email, elle ne sera modifiable
                que depuis ce navigateur.
              </p>

              {modalError && <p className="psl-modal-error">{modalError}</p>}

              <div className="psl-modal-actions">
                <button
                  type="button"
                  className="psl-modal-cancel"
                  onClick={() => setPendingGift(null)}
                >
                  Annuler
                </button>
                <button type="submit" className="psl-modal-confirm">
                  Reserver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

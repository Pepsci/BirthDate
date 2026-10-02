import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/admin.css";
import "./css/adminAppBanners.css";

/**
 * Bandeaux de l'accueil mobile (collection AppBanner, lue par l'app via
 * GET /api/app-version). Tout changement est en ligne immédiatement.
 *
 *  - Versions : la dernière version DISPONIBLE en store, par plateforme. Les
 *    apps plus anciennes affichent « Nouvelle version disponible ». À remplir
 *    seulement une fois le build téléchargeable (Play Console / TestFlight).
 *  - Annonce : un message libre. Une fois fermée par quelqu'un, elle ne lui
 *    revient plus ; publier une nouvelle annonce la montre à tout le monde.
 *
 * Seules les apps qui contiennent le bandeau (2.3.2 et suivantes) les voient.
 */

const PLATFORMS = [
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
];

const DEFAULT_UPDATE_TITLE = "✨ Nouvelle version disponible";
const defaultUpdateMessage = (v) =>
  `BirthReminder ${v || "x.y.z"} est prête. Touche ici pour mettre à jour.`;

const errorOf = (err) => err.response?.data?.message || "Erreur";

const emptyRelease = { version: "", url: "", title: "", message: "" };
const toForm = (r) => ({
  version: r?.version || "",
  url: r?.url || "",
  title: r?.title || "",
  message: r?.message || "",
});

// Aperçu du bandeau, tel qu'il apparaît sur l'accueil mobile
const Preview = ({ kind, title, message }) => (
  <div className={`ab-preview ab-preview--${kind}`}>
    <div>
      {title && <strong>{title}</strong>}
      {message && <p>{message}</p>}
    </div>
    <span className="ab-preview-close">✕</span>
  </div>
);

const AdminAppBanners = () => {
  const [releases, setReleases] = useState({ android: emptyRelease, ios: emptyRelease });
  const [current, setCurrent] = useState(null); // annonce publiée
  const [draft, setDraft] = useState({
    title: "",
    message: "",
    url: "",
    until: "",
    platforms: ["android", "ios"],
  });
  const [meta, setMeta] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const apply = (doc) => {
    setReleases({ android: toForm(doc.android), ios: toForm(doc.ios) });
    setCurrent(doc.announcement || null);
    setMeta({ updatedAt: doc.updatedAt, by: doc.updatedBy?.name || null });
  };

  useEffect(() => {
    apiHandler
      .get("/admin/app-banners")
      .then((res) => apply(res.data))
      .catch((err) => setError(errorOf(err)));
  }, []);

  const setRelease = (platform, field, value) =>
    setReleases((r) => ({ ...r, [platform]: { ...r[platform], [field]: value } }));

  const run = async (fn, ok) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fn();
      apply(res.data);
      setNotice({ ok: true, text: ok });
    } catch (err) {
      setNotice({ ok: false, text: errorOf(err) });
    } finally {
      setSaving(false);
    }
  };

  const saveReleases = () =>
    run(() => apiHandler.put("/admin/app-banners/releases", releases), "Versions enregistrées.");

  const publish = () => {
    if (current && !window.confirm("Remplacer l'annonce en cours ? La nouvelle s'affichera à tout le monde, même à ceux qui avaient fermé l'ancienne.")) return;
    run(() => apiHandler.put("/admin/app-banners/announcement", draft), "Annonce publiée.");
  };

  const removeAnnouncement = () => {
    if (!window.confirm("Retirer l'annonce de toutes les apps ?")) return;
    run(() => apiHandler.delete("/admin/app-banners/announcement"), "Annonce retirée.");
  };

  const togglePlatform = (id) =>
    setDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(id)
        ? d.platforms.filter((p) => p !== id)
        : [...d.platforms, id],
    }));

  if (error) return <p className="admin-error">{error}</p>;

  return (
    <div className="admin-page">
      <h1>Bandeaux de l'app</h1>
      <p className="admin-muted">
        Affichés sur l'accueil de l'app mobile (avec un compte), à partir de la
        version 2.3.2. Tout changement est en ligne immédiatement.
        {meta?.by && (
          <> Dernière modification : {meta.by}, {new Date(meta.updatedAt).toLocaleString("fr-FR")}.</>
        )}
      </p>

      {notice && (
        <p className={notice.ok ? "ab-notice" : "admin-error"} onClick={() => setNotice(null)}>
          {notice.text}
        </p>
      )}

      {/* ── Versions ── */}
      <section className="ab-section">
        <h2 className="admin-section-title">Nouvelle version disponible</h2>
        <p className="admin-muted">
          Indiquez la dernière version <strong>téléchargeable</strong> (celle
          des notes de mise à jour, ex. 2.3.2). Les apps plus anciennes
          affichent le bandeau. Vide = pas de bandeau sur cette plateforme.
        </p>

        <div className="ab-grid">
          {PLATFORMS.map(({ id, label }) => {
            const r = releases[id];
            return (
              <div key={id} className="ab-card">
                <h3>{label}</h3>
                <label className="ab-field">
                  <span>Version publiée</span>
                  <input
                    value={r.version}
                    onChange={(e) => setRelease(id, "version", e.target.value)}
                    placeholder="2.3.2"
                  />
                </label>
                <label className="ab-field">
                  <span>Lien de mise à jour</span>
                  <input
                    value={r.url}
                    onChange={(e) => setRelease(id, "url", e.target.value)}
                    placeholder={id === "ios" ? "itms-beta://" : "https://play.google.com/…"}
                  />
                </label>
                <label className="ab-field">
                  <span>Titre (facultatif)</span>
                  <input
                    value={r.title}
                    maxLength={80}
                    onChange={(e) => setRelease(id, "title", e.target.value)}
                    placeholder={DEFAULT_UPDATE_TITLE}
                  />
                </label>
                <label className="ab-field">
                  <span>Message (facultatif)</span>
                  <textarea
                    rows={2}
                    value={r.message}
                    maxLength={240}
                    onChange={(e) => setRelease(id, "message", e.target.value)}
                    placeholder={defaultUpdateMessage(r.version)}
                  />
                </label>
                {r.version && (
                  <Preview
                    kind="update"
                    title={r.title || DEFAULT_UPDATE_TITLE}
                    message={r.message || defaultUpdateMessage(r.version)}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn-success" onClick={saveReleases} disabled={saving}>
            Enregistrer les versions
          </button>
        </div>
      </section>

      {/* ── Annonce ── */}
      <section className="ab-section">
        <h2 className="admin-section-title">Annonce</h2>

        {current ? (
          <div className="ab-card">
            <h3>En ligne</h3>
            <Preview kind="announce" title={current.title} message={current.message} />
            <p className="admin-muted">
              {current.platforms.map((p) => PLATFORMS.find((x) => x.id === p)?.label).join(" + ")}
              {current.url && <> · lien : {current.url}</>}
              {current.until
                ? <> · jusqu'au {new Date(current.until).toLocaleDateString("fr-FR")}</>
                : " · sans date de fin"}
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-danger" onClick={removeAnnouncement} disabled={saving}>
                Retirer l'annonce
              </button>
            </div>
          </div>
        ) : (
          <p className="admin-muted">Aucune annonce en ligne.</p>
        )}

        <div className="ab-card">
          <h3>{current ? "Remplacer par une nouvelle annonce" : "Nouvelle annonce"}</h3>
          <label className="ab-field">
            <span>Titre</span>
            <input
              value={draft.title}
              maxLength={80}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="🎉 Nouveau : les fêtes sont corrigées"
            />
          </label>
          <label className="ab-field">
            <span>Message</span>
            <textarea
              rows={3}
              value={draft.message}
              maxLength={400}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              placeholder="Une fête te semble fausse ? Signale-la depuis une carte."
            />
          </label>
          <label className="ab-field">
            <span>Lien au toucher (facultatif)</span>
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://… ou un écran de l'app : /contact, /events"
            />
          </label>
          <div className="ab-row">
            <label className="ab-field">
              <span>Jusqu'au (inclus, facultatif)</span>
              <input
                type="date"
                value={draft.until}
                onChange={(e) => setDraft({ ...draft, until: e.target.value })}
              />
            </label>
            <div className="ab-field">
              <span>Plateformes</span>
              <div className="ab-checks">
                {PLATFORMS.map(({ id, label }) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={draft.platforms.includes(id)}
                      onChange={() => togglePlatform(id)}
                    />{" "}
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          {(draft.title || draft.message) && (
            <Preview kind="announce" title={draft.title} message={draft.message} />
          )}
          <div className="admin-modal-actions">
            <button
              className="admin-btn-success"
              onClick={publish}
              disabled={saving || !(draft.title.trim() || draft.message.trim()) || !draft.platforms.length}
            >
              Publier l'annonce
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminAppBanners;

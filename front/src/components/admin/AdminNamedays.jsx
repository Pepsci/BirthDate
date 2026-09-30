import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import apiHandler from "../../api/apiHandler";
import NamedayInput from "../dashboard/NamedayInput";
import "../dashboard/css/namedayInput.css";
import "./css/admin.css";
import "./css/adminNamedays.css";

/**
 * Calendrier des fêtes (collection Nameday).
 *
 * Cinq onglets :
 *  - Par date        : prénoms principaux et leurs variantes, dans l'ordre de l'année ;
 *  - Liste complète  : tous les prénoms (principaux + variantes) de A à Z ;
 *  - Composés        : prénoms composés des répertoires, avec la date que leur
 *                      donne la règle (Jean-Luc → Luc) — à vérifier une fois ;
 *  - Sans fête       : prénoms des répertoires qui ne matchent rien ;
 *  - À appliquer     : cartes dont la fête automatique ne correspond plus au
 *                      calendrier (modif laissée « Plus tard », ou nouvelle
 *                      règle après un déploiement). Remplace le script
 *                      recompute-namedays.js au quotidien.
 *
 * Après chaque modification, on demande au serveur quels contacts existants
 * changeraient (POST /apply en simulation) et on propose de l'appliquer.
 * Les fêtes choisies à la main par les utilisateurs ne sont jamais touchées.
 *
 * ?q=Mia dans l'URL pré-remplit la recherche (lien depuis un ticket support).
 */

const PAGE_SIZE = 30;

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// Même normalisation que le serveur (utils/namedayNormalize.js) :
// accents retirés, espace entre deux prénoms = tiret (« Jean marc » = « jean-marc »)
const strip = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*-\s*|\s+/g, "-")
    .replace(/[^a-z-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const formatDate = (mmdd) => {
  if (!mmdd) return "—";
  const [m, d] = mmdd.split("-");
  return new Date(2000, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
};

const errorOf = (err) => err.response?.data?.message || "Erreur";

const paginate = (list, page) =>
  list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

// ── Pagination ─────────────────────────────────────────────────────────────
const Pager = ({ page, total, onChange }) => {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Précédent
      </button>
      <span>
        Page {page} / {pages} · {total} ligne(s)
      </span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Suivant →
      </button>
    </div>
  );
};

// ── Fenêtre d'ajout / modification ─────────────────────────────────────────
// mode : "add" (prénom principal), "alias" (variante), "edit" (principal),
//        "edit-alias" (variante existante)
const EntryModal = ({ modal, entries, onClose, onSaved }) => {
  const [name, setName] = useState(modal.name || "");
  const [date, setDate] = useState(modal.date || "");
  const [aliasOf, setAliasOf] = useState(modal.aliasOf || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isAlias = modal.mode === "alias" || modal.mode === "edit-alias";
  const isEdit = modal.mode === "edit" || modal.mode === "edit-alias";

  const titles = {
    add: "Ajouter un prénom",
    alias: "Ajouter une variante",
    edit: `Modifier ${modal.name}`,
    "edit-alias": `Modifier la variante ${modal.name}`,
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!isEdit) {
        await apiHandler.post(
          "/admin/namedays",
          isAlias ? { name, aliasOf } : { name, date },
        );
        onSaved([name]);
      } else {
        const body = { name };
        if (isAlias) body.aliasOf = aliasOf;
        else body.date = date;
        const res = await apiHandler.patch(`/admin/namedays/${modal.id}`, body);
        onSaved(res.data.affected);
      }
    } catch (err) {
      setError(errorOf(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <form
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="admin-modal-close" onClick={onClose}>
          ✕
        </button>
        <h2>{titles[modal.mode]}</h2>
        {modal.hint && <p className="admin-muted">{modal.hint}</p>}

        <label className="nd-field">
          <span>Prénom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </label>

        {isAlias ? (
          <label className="nd-field">
            <span>Variante de</span>
            <input
              list="nd-canonicals"
              value={aliasOf}
              onChange={(e) => setAliasOf(e.target.value)}
              placeholder="Michel, Marie…"
              required
            />
            <datalist id="nd-canonicals">
              {entries.map((en) => (
                <option key={en._id} value={en.name}>
                  {formatDate(en.date)}
                </option>
              ))}
            </datalist>
            <small className="admin-muted">
              La variante prend la date de ce prénom et la suivra s'il change.
            </small>
          </label>
        ) : (
          <div className="nd-field">
            <span>Date de fête</span>
            <NamedayInput value={date} onChange={setDate} placeholder="Mois" />
            {isEdit && modal.aliasCount > 0 && (
              <small className="admin-muted">
                Ses {modal.aliasCount} variante(s) suivront la nouvelle date.
              </small>
            )}
          </div>
        )}

        {error && <p className="admin-error">{error}</p>}

        <div className="admin-modal-actions">
          <button
            type="submit"
            className="admin-btn-success"
            disabled={saving || !name.trim() || (!isAlias && !date)}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Report sur les contacts existants ──────────────────────────────────────
const ImpactModal = ({ impact, onClose, onApplied }) => {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const apply = async () => {
    setApplying(true);
    try {
      const res = await apiHandler.post("/admin/namedays/apply", {
        names: impact.names,
        dryRun: false,
      });
      onApplied(res.data.count);
    } catch (err) {
      setError(errorOf(err));
      setApplying(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-modal-close" onClick={onClose}>
          ✕
        </button>
        <h2>Contacts existants concernés</h2>
        <p className="admin-muted">
          {impact.count} fête(s) automatique(s) changeraient. Les fêtes choisies
          à la main par les utilisateurs ne sont jamais modifiées.
        </p>

        <div className="admin-table-wrapper nd-impact-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Prénom</th>
                <th>Avant</th>
                <th>Après</th>
              </tr>
            </thead>
            <tbody>
              {impact.changes.map((c, i) => (
                <tr key={i}>
                  <td>
                    <span className="admin-tag">{c.type}</span>
                  </td>
                  <td>{c.name}</td>
                  <td className="admin-muted">{formatDate(c.from)}</td>
                  <td>{c.to ? formatDate(c.to) : "pas de fête"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {impact.count > impact.changes.length && (
          <p className="admin-muted">
            … et {impact.count - impact.changes.length} autre(s).
          </p>
        )}

        {error && <p className="admin-error">{error}</p>}

        <div className="admin-modal-actions">
          <button className="admin-btn-success" onClick={apply} disabled={applying}>
            {applying ? "Application…" : `Appliquer aux ${impact.count} contact(s)`}
          </button>
          <button onClick={onClose}>Plus tard</button>
        </div>
      </div>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────
const AdminNamedays = () => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState("calendar");
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [missing, setMissing] = useState([]);
  const [compounds, setCompounds] = useState([]);
  const [pending, setPending] = useState([]);
  const [applyingPending, setApplyingPending] = useState(false);
  const [search, setSearch] = useState(params.get("q") || "");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [impact, setImpact] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    apiHandler
      .get("/admin/namedays")
      .then((res) => {
        setEntries(res.data.entries);
        setTotal(res.data.total);
      })
      .catch((err) => setError(errorOf(err)));
    apiHandler
      .get("/admin/namedays/missing")
      .then((res) => setMissing(res.data.missing))
      .catch(() => {});
    apiHandler
      .get("/admin/namedays/compounds")
      .then((res) => setCompounds(res.data.compounds))
      .catch(() => {});
    apiHandler
      .get("/admin/namedays/pending")
      .then((res) => setPending(res.data.changes))
      .catch(() => {});
  }, []);

  // ids absent = tout appliquer
  const applyPending = async (ids) => {
    if (!ids && !window.confirm(`Mettre à jour la fête de ${pending.length} contact(s) ?`)) return;
    setApplyingPending(true);
    try {
      const res = await apiHandler.post("/admin/namedays/pending/apply", ids ? { ids } : {});
      setNotice(`${res.data.count} contact(s) mis à jour.`);
      load();
    } catch (err) {
      setNotice(errorOf(err));
    } finally {
      setApplyingPending(false);
    }
  };

  useEffect(load, [load]);

  // Nouvel onglet ou nouveau filtre → retour en page 1
  useEffect(() => setPage(1), [tab, search, month]);

  // Après une modification : recharge, puis montre l'impact sur les contacts
  const afterChange = async (names) => {
    setModal(null);
    load();
    try {
      const res = await apiHandler.post("/admin/namedays/apply", {
        names,
        dryRun: true,
      });
      if (res.data.count > 0) setImpact({ ...res.data, names });
      else setNotice("Enregistré. Aucun contact existant n'est concerné.");
    } catch (err) {
      setNotice(`Enregistré, mais impossible de calculer l'impact : ${errorOf(err)}`);
    }
  };

  const remove = async (item, label) => {
    const warning = item.aliases?.length
      ? `Supprimer ${label} et ses ${item.aliases.length} variante(s) ?`
      : `Supprimer ${label} ?`;
    if (!window.confirm(warning)) return;
    try {
      const res = await apiHandler.delete(`/admin/namedays/${item._id}`);
      afterChange(res.data.affected);
    } catch (err) {
      setNotice(errorOf(err));
    }
  };

  const exportJson = async () => {
    try {
      const res = await apiHandler.get("/admin/namedays/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2) + "\n"], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fr.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice(errorOf(err));
    }
  };

  const q = strip(search);
  const matchesQ = (name) => !q || strip(name).includes(q);

  // Onglet « Par date »
  const byDate = useMemo(
    () =>
      entries.filter((e) => {
        if (month && !e.date.startsWith(`${month}-`)) return false;
        return matchesQ(e.name) || e.aliases.some((a) => matchesQ(a.name));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, q, month],
  );

  // Onglet « Liste complète » : principaux + variantes, A → Z
  const allNames = useMemo(() => {
    const rows = [];
    for (const e of entries) {
      rows.push({ id: e._id, name: e.name, date: e.date, entry: e, aliasOf: null });
      for (const a of e.aliases) {
        rows.push({ id: a._id, name: a.name, date: e.date, entry: e, alias: a, aliasOf: e.name });
      }
    }
    return rows
      .filter((r) => matchesQ(r.name) && (!month || r.date.startsWith(`${month}-`)))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, q, month]);

  const compoundsFiltered = useMemo(
    () => compounds.filter((c) => matchesQ(c.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compounds, q],
  );
  const pendingFiltered = useMemo(
    () => pending.filter((c) => matchesQ(c.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, q],
  );
  const missingFiltered = useMemo(
    () => missing.filter((m) => matchesQ(m.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missing, q],
  );
  const toReview = compounds.filter((c) => !c.exact).length;

  // Prénom composé absent du calendrier (« Jean-Luc ») : le serveur le fête
  // quand même, via le deuxième prénom pour « Jean-… », sinon le premier.
  // On le dit, sinon on croit qu'il n'a pas de fête.
  const compoundHint = useMemo(() => {
    if (!q.includes("-") || byDate.length) return null;
    const [first, second] = q.split("-");
    const tries = first === "jean" && second ? [second, first] : [first];
    for (const t of tries) {
      const match = entries.find(
        (e) => strip(e.name) === t || e.aliases.some((a) => strip(a.name) === t),
      );
      if (match) return { first: match.name, date: match.date };
    }
    return null;
  }, [q, byDate, entries]);

  const editEntry = (e) =>
    setModal({
      mode: "edit",
      id: e._id,
      name: e.name,
      date: e.date,
      aliasCount: e.aliases.length,
    });

  const editAlias = (a, canonicalName) =>
    setModal({ mode: "edit-alias", id: a._id, name: a.name, aliasOf: canonicalName });

  if (error) return <p className="admin-error">{error}</p>;

  const TABS = [
    { id: "calendar", label: "Par date" },
    { id: "all", label: "Liste complète" },
    { id: "compounds", label: "Composés", badge: toReview },
    { id: "missing", label: "Sans fête", badge: missing.length },
    { id: "pending", label: "À appliquer", badge: pending.length },
  ];

  return (
    <div className="admin-page">
      <div className="nd-header">
        <h1>Fêtes ({total} prénoms)</h1>
        <div className="nd-header-actions">
          <button className="admin-btn-small" onClick={exportJson} title="Pour mettre à jour data/namedays/fr.json dans le repo">
            <Download size={14} /> Exporter JSON
          </button>
          <button
            className="admin-btn-small admin-btn-success"
            onClick={() => setModal({ mode: "add" })}
          >
            <Plus size={14} /> Ajouter un prénom
          </button>
        </div>
      </div>

      <div className="nd-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge > 0 && <span className="admin-nav-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {notice && (
        <p className="nd-notice" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Chercher un prénom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(tab === "calendar" || tab === "all") && (
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Tous les mois</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Par date ── */}
      {tab === "calendar" && (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prénom</th>
                  <th>Variantes</th>
                  <th>Modifié</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginate(byDate, page).map((e) => (
                  <tr key={e._id}>
                    <td className="nd-date">{formatDate(e.date)}</td>
                    <td>
                      <strong>{e.name}</strong>
                    </td>
                    <td>
                      <div className="nd-aliases">
                        {e.aliases.map((a) => (
                          <span key={a._id} className="admin-tag nd-alias">
                            <button
                              className="nd-alias-name"
                              title="Modifier la variante"
                              onClick={() => editAlias(a, e.name)}
                            >
                              {a.name}
                            </button>
                            <button
                              className="nd-alias-remove"
                              title="Supprimer la variante"
                              onClick={() => remove(a, `la variante ${a.name}`)}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <button
                          className="nd-alias-add"
                          title="Ajouter une variante"
                          onClick={() => setModal({ mode: "alias", aliasOf: e.name })}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="admin-muted">
                      {e.updatedBy
                        ? `${e.updatedBy}, ${new Date(e.updatedAt).toLocaleDateString("fr-FR")}`
                        : "—"}
                    </td>
                    <td className="nd-actions">
                      <button className="admin-btn-small" onClick={() => editEntry(e)}>
                        Modifier
                      </button>
                      <button
                        className="admin-btn-small admin-btn-danger"
                        onClick={() => remove(e, e.name)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compoundHint && (
              <p className="nd-empty nd-hint">
                « {search.trim()} » n'est pas dans le calendrier, mais il est
                déjà fêté le <strong>{formatDate(compoundHint.date)}</strong>{" "}
                grâce à la règle des prénoms composés ({compoundHint.first}).
                Ajoutez-le seulement s'il doit avoir une autre date.
              </p>
            )}
            {byDate.length === 0 && (
              <p className="admin-muted nd-empty">
                Aucun prénom.{" "}
                {search && (
                  <button
                    className="admin-btn-small"
                    onClick={() => setModal({ mode: "add", name: search.trim() })}
                  >
                    Ajouter « {search.trim()} »
                  </button>
                )}
              </p>
            )}
          </div>
          <Pager page={page} total={byDate.length} onChange={setPage} />
        </>
      )}

      {/* ── Liste complète ── */}
      {tab === "all" && (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Fête</th>
                  <th>Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginate(allNames, page).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td className="nd-date">{formatDate(r.date)}</td>
                    <td>
                      {r.aliasOf ? (
                        <span className="admin-muted">Variante de {r.aliasOf}</span>
                      ) : (
                        <span className="admin-tag admin-tag-primary">Principal</span>
                      )}
                    </td>
                    <td className="nd-actions">
                      <button
                        className="admin-btn-small"
                        onClick={() =>
                          r.aliasOf ? editAlias(r.alias, r.aliasOf) : editEntry(r.entry)
                        }
                      >
                        Modifier
                      </button>
                      <button
                        className="admin-btn-small admin-btn-danger"
                        onClick={() =>
                          r.aliasOf
                            ? remove(r.alias, `la variante ${r.name}`)
                            : remove(r.entry, r.name)
                        }
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allNames.length === 0 && <p className="admin-muted nd-empty">Aucun prénom.</p>}
          </div>
          <Pager page={page} total={allNames.length} onChange={setPage} />
        </>
      )}

      {/* ── Composés ── */}
      {tab === "compounds" && (
        <>
          <p className="admin-muted">
            Prénoms composés présents dans les répertoires. Sans ligne à eux, ils
            prennent la fête du deuxième prénom pour « Jean-… » (Jean-Luc → Luc),
            sinon du premier (Paul-Henri → Paul). Vérifiez la date une fois, et
            donnez leur propre date aux exceptions.
          </p>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Cartes</th>
                  <th>Comptes</th>
                  <th>Fête actuelle</th>
                  <th>D'où vient la date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginate(compoundsFiltered, page).map((c) => (
                  <tr key={c.key}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.cards}</td>
                    <td>{c.users}</td>
                    <td className="nd-date">{c.date ? formatDate(c.date) : "pas de fête"}</td>
                    <td>
                      {c.exact ? (
                        <span className="admin-tag admin-tag-success">✓ Sa propre ligne</span>
                      ) : c.via ? (
                        <span className="admin-muted">Règle : {c.via}</span>
                      ) : (
                        <span className="admin-tag admin-tag-warning">Aucune</span>
                      )}
                    </td>
                    <td className="nd-actions">
                      {!c.exact && (
                        <button
                          className="admin-btn-small admin-btn-success"
                          onClick={() =>
                            setModal({
                              mode: "add",
                              name: c.name,
                              date: c.date || "",
                              hint: c.date
                                ? `Aujourd'hui : ${formatDate(c.date)} (règle : ${c.via}). Choisissez la bonne date.`
                                : null,
                            })
                          }
                        >
                          Donner sa propre date
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compoundsFiltered.length === 0 && (
              <p className="admin-muted nd-empty">Aucun prénom composé.</p>
            )}
          </div>
          <Pager page={page} total={compoundsFiltered.length} onChange={setPage} />
        </>
      )}

      {/* ── Sans fête ── */}
      {tab === "missing" && (
        <>
          <p className="admin-muted">
            Prénoms des répertoires qui n'ont aucune fête (fêtes choisies à la
            main exclues). Donnez-leur une date, ou rattachez-les à un prénom
            existant.
          </p>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Cartes</th>
                  <th>Comptes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginate(missingFiltered, page).map((m) => (
                  <tr key={m.key}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.cards}</td>
                    <td>{m.users}</td>
                    <td className="nd-actions">
                      <button
                        className="admin-btn-small admin-btn-success"
                        onClick={() => setModal({ mode: "add", name: m.name })}
                      >
                        Donner une date
                      </button>
                      <button
                        className="admin-btn-small"
                        onClick={() => setModal({ mode: "alias", name: m.name })}
                      >
                        Variante de…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missingFiltered.length === 0 && (
              <p className="admin-muted nd-empty">Tous les prénoms ont une fête.</p>
            )}
          </div>
          <Pager page={page} total={missingFiltered.length} onChange={setPage} />
        </>
      )}

      {/* ── À appliquer ── */}
      {tab === "pending" && (
        <>
          <div className="nd-pending-head">
            <p className="admin-muted">
              Cartes et comptes dont la fête automatique ne correspond plus au
              calendrier : modifications laissées « Plus tard », ou nouvelle règle
              après un déploiement. Les fêtes choisies à la main n'apparaissent
              jamais ici.
            </p>
            {pending.length > 0 && (
              <button
                className="admin-btn-small admin-btn-success"
                onClick={() => applyPending()}
                disabled={applyingPending}
              >
                {applyingPending ? "Application…" : `Tout appliquer (${pending.length})`}
              </button>
            )}
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Prénom</th>
                  <th>Fête actuelle</th>
                  <th>Nouvelle fête</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginate(pendingFiltered, page).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="admin-tag">{c.type}</span>
                    </td>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td className="admin-muted">{c.from ? formatDate(c.from) : "pas de fête"}</td>
                    <td>{c.to ? formatDate(c.to) : "pas de fête"}</td>
                    <td className="nd-actions">
                      <button
                        className="admin-btn-small"
                        onClick={() => applyPending([c.id])}
                        disabled={applyingPending}
                      >
                        Appliquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pendingFiltered.length === 0 && (
              <p className="admin-muted nd-empty">
                Tout est à jour : chaque fête automatique correspond au calendrier.
              </p>
            )}
          </div>
          <Pager page={page} total={pendingFiltered.length} onChange={setPage} />
        </>
      )}

      {modal && (
        <EntryModal
          modal={modal}
          entries={entries}
          onClose={() => setModal(null)}
          onSaved={afterChange}
        />
      )}

      {impact && (
        <ImpactModal
          impact={impact}
          onClose={() => {
            setImpact(null);
            setNotice("Pas appliqué pour l'instant : retrouvez ces contacts dans l'onglet « À appliquer ».");
            load();
          }}
          onApplied={(count) => {
            setImpact(null);
            setNotice(`${count} contact(s) mis à jour.`);
            load();
          }}
        />
      )}
    </div>
  );
};

export default AdminNamedays;

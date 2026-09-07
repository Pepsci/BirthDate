import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiHandler from "../../api/apiHandler";
import "./css/attachSharedList.css";

/**
 * Rattacher une liste commune reçue à une de mes cartes.
 *
 * ⚠️ Cet écran n'existait pas côté web, alors que le serveur envoie TOUTES les
 * notifications de partage vers `/shared-list/:id/attach`
 * (server/routes/sharedGifts.js). Un utilisateur web qui recevait « X t'a
 * partagé sa liste de cadeaux » et cliquait dessus atterrissait sur une route
 * absente d'App.jsx : page morte. C'était la cause principale du « je ne reçois
 * aucune notification sur le web » — elles arrivaient, mais ne menaient nulle
 * part.
 *
 * Une liste commune ne s'affiche que posée sur une carte : c'est l'étape
 * manquante entre « on t'a partagé une liste » et « je la vois ». Deux chemins,
 * comme sur mobile — la poser sur une carte existante, ou créer la carte au
 * passage pour quelqu'un qu'on n'a pas encore enregistré.
 */
export default function AttachSharedList() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dates, setDates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Identité de la personne dont la liste parle, déduite par le serveur d'une
  // carte déjà rattachée chez un membre. C'est ce qui permet de proposer la
  // création en un geste plutôt qu'un formulaire vide.
  const [suggested, setSuggested] = useState(null);

  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState("");
  const [form, setForm] = useState({ name: "", surname: "", date: "" });

  useEffect(() => {
    Promise.all([
      apiHandler.get("/date"),
      apiHandler.get(`/shared-gifts/${id}`).catch(() => null),
    ])
      .then(([resDates, resList]) => {
        const list = resDates.data || [];
        setDates(list);
        const sc = resList?.data?.suggestedCard || null;
        setSuggested(sc);
        // Sans aucune carte, le seul chemin possible est la création : on
        // l'ouvre d'emblée plutôt que de laisser l'utilisateur devant un
        // cul-de-sac où rien n'est cliquable.
        if (list.length === 0) setCreating(true);
        // Formulaire prérempli, pour qu'il reste corrigeable avant validation.
        if (sc) {
          setForm({
            name: sc.name || "",
            surname: sc.surname || "",
            date: sc.date ? String(sc.date).slice(0, 10) : "",
          });
        }
      })
      .catch(() => setError("Impossible de charger vos cartes."));
  }, [id]);

  const attach = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiHandler.post(
        `/shared-gifts/${id}/attach`,
        payload,
      );
      navigate(`/home?tab=date&dateId=${res.data.dateId}`, { replace: true });
    } catch (err) {
      // 409 : la carte porte déjà une AUTRE liste commune. On ne remplace
      // jamais en silence — l'ancienne disparaîtrait de cette carte sans que
      // personne l'ait décidé.
      if (err?.response?.data?.code === "ALREADY_HAS_LIST") {
        if (
          window.confirm(
            `${err.response.data.message}\n\nRemplacer la liste actuelle par celle-ci ?`,
          )
        ) {
          return attach({ ...payload, replace: true });
        }
      } else {
        setError(
          err?.response?.data?.message || "Impossible de rattacher la liste.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const submitNew = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Le prénom est obligatoire.");
      return;
    }
    if (!form.date) {
      setError("La date de naissance est obligatoire.");
      return;
    }
    attach({
      newDate: {
        name: form.name.trim(),
        surname: form.surname.trim(),
        date: form.date,
      },
    });
  };

  const sortedDates = [...dates].sort((a, b) =>
    `${a.name ?? ""} ${a.surname ?? ""}`.localeCompare(
      `${b.name ?? ""} ${b.surname ?? ""}`,
      "fr",
      { sensitivity: "base" },
    ),
  );

  const suggestedName = suggested
    ? [suggested.name, suggested.surname].filter(Boolean).join(" ")
    : null;

  if (!dates) {
    return (
      <div className="asl">
        <p className="asl-muted">{error || "Chargement…"}</p>
      </div>
    );
  }

  return (
    <div className="asl">
      <h1 className="asl-title">🎁 Rattacher la liste partagée</h1>
      <p className="asl-muted">
        Une liste d'idées vous a été partagée. Choisissez la carte de la
        personne concernée : c'est là qu'elle s'affichera.
      </p>

      {error && <p className="asl-error">{error}</p>}

      {/* Création en un geste, quand le serveur sait de qui il s'agit. Sans
          elle, l'utilisateur devait ressaisir un nom et une date de naissance
          qu'il ne connaît parfois même pas — c'est justement pour ça qu'il n'a
          pas encore la carte. */}
      {suggestedName && (
        <section className="asl-section asl-section--suggested">
          <h2 className="asl-section-title">🎁 Liste de cadeaux pour</h2>
          <p className="asl-muted">
            {suggestedName}
            {suggested?.date
              ? ` · né(e) le ${new Date(suggested.date).toLocaleDateString("fr-FR")}`
              : ""}
          </p>
          <button
            className="asl-btn"
            disabled={busy}
            onClick={() => attach({ newDate: {} })}
          >
            ➕ Créer sa carte et rattacher
          </button>
          <p className="asl-muted">
            Les informations viennent du carnet de la personne qui partage. Vous
            pourrez les corriger ensuite depuis la carte.
          </p>
        </section>
      )}

      <section className="asl-section">
        <h2 className="asl-section-title">Une carte existante</h2>
        {dates.length === 0 ? (
          <p className="asl-muted">
            Vous n'avez encore aucune carte — créez-en une ci-dessous.
          </p>
        ) : (
          /* ⚠️ Menu déroulant, et non la liste complète : ce sont TOUTES les
             cartes du carnet. Au-delà de quelques-unes, les afficher en entier
             noie le reste de l'écran — dont le bouton « créer la carte », qui
             est souvent le bon choix quand on reçoit une liste. */
          <div className="asl-picker">
            <select
              className="asl-input"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">Choisir une carte…</option>
              {sortedDates.map((d) => (
                <option key={d._id} value={d._id}>
                  {[d.name, d.surname].filter(Boolean).join(" ")}
                  {d.sharedGiftList ? " · a déjà une liste commune" : ""}
                </option>
              ))}
            </select>
            <button
              className="asl-btn asl-btn--sm"
              disabled={busy || !picked}
              onClick={() => attach({ dateId: picked })}
            >
              Rattacher
            </button>
          </div>
        )}
      </section>

      <section className="asl-section">
        <button
          className="asl-toggle"
          onClick={() => setCreating((v) => !v)}
          aria-expanded={creating}
        >
          <span>➕ Créer une carte</span>
          <span>{creating ? "▾" : "▸"}</span>
        </button>

        {creating && (
          <form className="asl-form" onSubmit={submitNew}>
            <input
              className="asl-input"
              placeholder="Prénom *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="asl-input"
              placeholder="Nom"
              value={form.surname}
              onChange={(e) => setForm({ ...form, surname: e.target.value })}
            />
            <label className="asl-label">
              Date de naissance *
              {/* input type="date" plutôt qu'une saisie AAAA-MM-JJ à la main :
                  le navigateur gère le format et le calendrier, et il n'y a
                  plus de message d'erreur après coup. */}
              <input
                className="asl-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <button className="asl-btn" type="submit" disabled={busy}>
              {busy ? "Création…" : "Créer et rattacher"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

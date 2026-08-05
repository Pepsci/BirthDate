import React, { useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/dateShareCard.css";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const formatFullDate = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
};

const formatNameday = (mmdd) => {
  const [mm, dd] = String(mmdd).split("-").map(Number);
  if (!mm || !dd) return "";
  return `${dd} ${MONTHS_FR[mm - 1]}`;
};

/**
 * DateShareCard
 * Rendu inline dans ChatWindow pour les messages de type "date_share".
 *
 * Le destinataire peut ajouter la carte à ses propres anniversaires. Les idées
 * cadeaux ne sont jamais transmises — c'est la différence avec gift_share.
 *
 * Props :
 *   - message : message avec metadata { personName, name, surname, birthDate, nameday }
 *   - isOwn   : booléen (côté droit si true)
 */
const DateShareCard = ({ message, isOwn }) => {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const {
    personName,
    name = "",
    surname = "",
    birthDate = null,
    nameday = null,
    linkedUserId = null,
  } = message.metadata || {};

  const fullName = `${name}${surname ? ` ${surname}` : ""}`.trim() || personName;

  // Demande d'ami : la personne doit accepter. Si elle accepte, le serveur
  // crée les cartes liées des deux côtés (createFriendDates) — inutile donc de
  // créer une carte manuelle en parallèle, ce serait un doublon.
  const handleFriendRequest = async () => {
    if (requesting || !linkedUserId) return;
    setRequesting(true);
    setError(null);
    try {
      await apiHandler.post("/friends/request-by-id", {
        userId: linkedUserId,
      });
      setRequested(true);
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ?? "Impossible d'envoyer la demande.",
      );
    } finally {
      setRequesting(false);
    }
  };

  const handleAdd = async () => {
    if (saving || !birthDate || !name) return;
    setSaving(true);
    setError(null);
    try {
      // Doublon = même prénom/nom et même jour d'anniversaire.
      const { data: mine } = await apiHandler.get("/date");
      const shared = new Date(birthDate);
      const exists = (mine || []).some((d) => {
        const dd = new Date(d.date);
        return (
          (d.name || "").toLowerCase() === name.toLowerCase() &&
          (d.surname || "").toLowerCase() === surname.toLowerCase() &&
          dd.getMonth() === shared.getMonth() &&
          dd.getDate() === shared.getDate()
        );
      });
      if (exists) {
        setError("Déjà dans vos anniversaires.");
        return;
      }
      await apiHandler.post("/date", {
        name,
        surname: surname || undefined,
        date: birthDate,
        nameday: nameday || undefined,
      });
      setAdded(true);
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ?? "Impossible d'ajouter cette date.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`dsc-card ${isOwn ? "dsc-card--own" : "dsc-card--other"}`}>
      <div className="dsc-header">
        <span className="dsc-header-icon">🎂</span>
        <p className="dsc-label">Carte anniversaire</p>
      </div>

      <div className="dsc-body">
        <p className="dsc-person">{fullName || "Sans nom"}</p>
        {birthDate && (
          <p className="dsc-line">Né(e) le {formatFullDate(birthDate)}</p>
        )}
        {nameday && (
          <p className="dsc-line">🎉 Fête le {formatNameday(nameday)}</p>
        )}
        <p className="dsc-note">Les idées cadeaux ne sont pas partagées.</p>

        {!isOwn && linkedUserId && !requested && !added && (
          <button
            className="dsc-add-btn"
            onClick={handleFriendRequest}
            disabled={requesting}
          >
            {requesting ? "Envoi…" : "👥 Ajouter en ami"}
          </button>
        )}
        {requested && (
          <p className="dsc-added">
            ✅ Demande envoyée — sa carte se créera s'il accepte
          </p>
        )}

        {!isOwn && !added && !requested && (
          <button
            className={`dsc-add-btn ${linkedUserId ? "dsc-add-btn--secondary" : ""}`}
            onClick={handleAdd}
            disabled={saving}
          >
            {saving
              ? "Ajout…"
              : linkedUserId
                ? "🎂 Juste créer la carte"
                : "＋ Ajouter à mes anniversaires"}
          </button>
        )}
        {added && <p className="dsc-added">✅ Ajouté à vos anniversaires</p>}
        {error && <p className="dsc-error">{error}</p>}
      </div>
    </div>
  );
};

export default DateShareCard;

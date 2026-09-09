import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";

const PREFS = [
  {
    key: "rsvp",
    label: "Réponses de présence",
    description: "Quand un invité confirme, décline ou hésite",
    icon: "fa-circle-check",
  },
  {
    key: "dateVote",
    label: "Votes pour la date",
    description: "Quand un invité vote pour une date proposée",
    icon: "fa-calendar-check",
  },
  {
    key: "locationVote",
    label: "Votes pour le lieu",
    description: "Quand un invité vote pour un lieu proposé",
    icon: "fa-location-dot",
  },
  {
    key: "giftProposed",
    label: "Propositions de cadeaux",
    description: "Quand un invité propose une idée cadeau",
    icon: "fa-gift",
  },
  {
    key: "giftVote",
    label: "Votes sur les cadeaux",
    description: "Quand un invité vote pour une idée cadeau",
    icon: "fa-heart",
  },
  {
    key: "chatMessage",
    label: "Messages du chat",
    description:
      "Quand un participant envoie un message dans le chat de l'événement",
    icon: "fa-comment",
  },
  {
    key: "eventUpdates",
    label: "Mises à jour de l'événement",
    description: "Lieu retenu, informations modifiées",
    icon: "fa-pen",
  },
  {
    key: "poolContribution",
    label: "Contributions à la cagnotte",
    description: "Quand un participant verse de l'argent dans la cagnotte",
    icon: "fa-piggy-bank",
  },
];

/**
 * Notifications de CET événement, pour la personne qui consulte.
 *
 * ⚠️ Les catégories dépendent du rôle, et c'est voulu. Les réponses, les
 * votes, les cadeaux proposés et les contributions ne partent qu'à
 * l'organisateur : les proposer à un invité afficherait des interrupteurs sans
 * effet. Le serveur renvoie donc les clés qui concernent le demandeur, et
 * n'accepte que celles-là — on n'affiche que ce qu'il envoie.
 *
 * L'écran servait auparavant `/notification-prefs`, réservée à
 * l'organisateur : un invité n'avait aucun moyen de régler ses propres
 * notifications, et devait couper la catégorie « Événements » en entier.
 */
const EventNotifPrefs = ({ shortId }) => {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let alive = true;
    apiHandler
      .get(`/events/${shortId}/my-notifications`)
      .then((res) => alive && setPrefs(res.data?.prefs || {}))
      .catch(() => alive && setPrefs({}));
    return () => {
      alive = false;
    };
  }, [shortId]);

  const handleToggle = async (key) => {
    const newValue = !prefs[key];
    // Bascule optimiste : un interrupteur qui attend le réseau donne
    // l'impression de ne pas répondre.
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    setSaving(key);

    try {
      const res = await apiHandler.put(
        `/events/${shortId}/my-notifications`,
        { [key]: newValue },
      );
      setPrefs(res.data?.prefs || {});
    } catch (err) {
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      console.error("Error updating notification prefs", err);
    } finally {
      setSaving(null);
    }
  };

  if (!prefs) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          margin: "0 0 8px 0",
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
        }}
      >
        Choisissez les actions qui vous envoient une notification.
      </p>

      {PREFS.filter((pref) => pref.key in prefs).map((pref) => (
        <div
          key={pref.key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "var(--bg-primary)",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flex: 1,
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: prefs[pref.key]
                  ? "rgba(59,130,246,0.12)"
                  : "var(--bg-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              <i
                className={`fa-solid ${pref.icon}`}
                style={{
                  fontSize: "14px",
                  color: prefs[pref.key]
                    ? "var(--primary)"
                    : "var(--text-tertiary)",
                }}
              />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  color: "var(--text-primary)",
                }}
              >
                {pref.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                }}
              >
                {pref.description}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleToggle(pref.key)}
            disabled={saving === pref.key}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              border: "none",
              cursor: saving === pref.key ? "wait" : "pointer",
              background: prefs[pref.key]
                ? "var(--primary)"
                : "var(--bg-tertiary)",
              position: "relative",
              flexShrink: 0,
              transition: "background 0.2s",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "3px",
                left: prefs[pref.key] ? "23px" : "3px",
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
      ))}
    </div>
  );
};

export default EventNotifPrefs;

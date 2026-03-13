import React, { useState, useEffect, useRef } from "react";
import apiHandler from "../../../api/apiHandler";
import PrefToggle from "./PrefToggle";

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

function getPermissionState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

const TIMING_OPTIONS = [
  { value: 30, label: "1 mois avant" },
  { value: 14, label: "2 semaines avant" },
  { value: 7, label: "1 semaine avant" },
  { value: 3, label: "3 jours avant" },
  { value: 1, label: "1 jour avant" },
  { value: 0, label: "Le jour même" },
];

// ── Composant ─────────────────────────────────────────────────────────────────

const PushTab = () => {
  const [permState, setPermState] = useState(getPermissionState());
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saved' | 'error'
  const isSubscribing = useRef(false); // protection double render

  // Préférences chargées depuis la DB
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushEvents, setPushEvents] = useState({
    birthdays: true,
    chat: true,
    friends: true,
    gifts: true,
  });
  const [pushTimings, setPushTimings] = useState([1, 0]);

  // ── Chargement des préférences ──────────────────────────────────────────────
  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const res = await apiHandler.get("/users/me");
      const u = res.data;

      if (u.pushEvents) setPushEvents(u.pushEvents);
      if (u.pushBirthdayTimings) setPushTimings(u.pushBirthdayTimings);

      // Source de vérité : la subscription navigateur prime sur la DB
      let isActuallySubscribed = false;
      if (
        Notification.permission === "granted" &&
        "serviceWorker" in navigator
      ) {
        const registration =
          await navigator.serviceWorker.getRegistration("/sw.js");
        if (registration) {
          const sub = await registration.pushManager.getSubscription();
          isActuallySubscribed = !!sub;
        }
      }

      setPushEnabled(isActuallySubscribed);

      // Resync DB si désynchronisé
      if (isActuallySubscribed && !u.pushEnabled) {
        await apiHandler.patch("/users/me", { pushEnabled: true });
      }
    } catch (err) {
      console.error("[PushTab] Erreur chargement préfs:", err);
    }
  };

  // ── Activer les push ────────────────────────────────────────────────────────
  const handleActivate = async () => {
    if (isSubscribing.current) return;
    isSubscribing.current = true;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const res = await apiHandler.get("/push/vapid-public-key");
      const convertedKey = urlBase64ToUint8Array(res.data.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      await apiHandler.post("/push/subscribe", {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      await apiHandler.patch("/users/me", { pushEnabled: true });

      setPushEnabled(true);
      setPermState("granted");
    } catch (err) {
      console.error("[PushTab] Erreur activation:", err);
      setPermState(getPermissionState());
    } finally {
      setLoading(false);
      isSubscribing.current = false;
    }
  };

  // ── Désactiver les push ─────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    console.trace("🔴 handleDeactivate appelé depuis :");
    setLoading(true);
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await apiHandler.delete("/push/unsubscribe", {
            data: { endpoint: subscription.endpoint },
          });
          await subscription.unsubscribe();
        }
      }
      await apiHandler.patch("/users/me", { pushEnabled: false });
      setPushEnabled(false);
    } catch (err) {
      console.error("[PushTab] Erreur désactivation:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Sauvegarder les préférences événements + timings ───────────────────────
  const handleSave = async () => {
    setSaveLoading(true);
    setSaveStatus(null);
    try {
      await apiHandler.patch("/users/me", {
        pushEvents,
        pushBirthdayTimings: pushTimings,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("[PushTab] Erreur sauvegarde:", err);
      setSaveStatus("error");
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleTiming = (value) => {
    setPushTimings((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  // ── Rendu selon l'état de permission ───────────────────────────────────────

  if (permState === "unsupported") {
    return (
      <div className="tab-content-inner">
        <div className="push-unsupported">
          <span className="push-icon">🔔</span>
          <h3>Notifications push non supportées</h3>
          <p>
            Votre navigateur ne supporte pas les notifications push. Essayez
            Chrome, Firefox ou Edge.
          </p>
        </div>
      </div>
    );
  }

  if (permState === "denied") {
    return (
      <div className="tab-content-inner">
        <div className="push-denied">
          <span className="push-icon">🚫</span>
          <h3>Notifications bloquées par le navigateur</h3>
          <p>Vous avez bloqué les notifications. Pour les réactiver :</p>
          <ul className="push-instructions">
            <li>
              <strong>Chrome</strong> — Cliquez sur le 🔒 dans la barre
              d'adresse → "Notifications" → "Autoriser"
            </li>
            <li>
              <strong>Firefox</strong> — Cliquez sur le 🛡️ → "Plus
              d'informations" → onglet "Permissions" → décochez "Bloquer"
            </li>
            <li>
              <strong>Safari iOS</strong> — Réglages → Apps → Safari →
              Notifications → Autoriser
            </li>
          </ul>
          <p className="push-reload-hint">
            Après avoir modifié les réglages, rechargez la page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content-inner">
      {/* ── Section A : Activation ── */}
      <div className="push-activation-section">
        <div className="push-status-row">
          <div className="push-status-info">
            <span
              className={`push-status-dot ${pushEnabled && permState === "granted" ? "active" : "inactive"}`}
            />
            <span className="push-status-label">
              {pushEnabled && permState === "granted"
                ? "Notifications push activées"
                : "Notifications push désactivées"}
            </span>
          </div>

          {permState !== "granted" || !pushEnabled ? (
            <button
              className="push-btn push-btn--activate"
              onClick={handleActivate}
              disabled={loading}
            >
              {loading ? "Activation..." : "🔔 Activer"}
            </button>
          ) : (
            <button
              className="push-btn push-btn--deactivate"
              onClick={handleDeactivate}
              disabled={loading}
            >
              {loading ? "Désactivation..." : "Désactiver"}
            </button>
          )}
        </div>

        {permState === "default" && (
          <p className="push-hint">
            💡 Une demande d'autorisation apparaîtra dans votre navigateur.
          </p>
        )}
      </div>

      {/* ── Sections B & C visibles seulement si push actif ── */}
      {pushEnabled && permState === "granted" && (
        <>
          {/* ── Section B : Événements ── */}
          <div className="push-section">
            <h3 className="push-section-title">
              Recevoir des notifications pour
            </h3>
            <div className="user-email-preferences-simple">
              <PrefToggle
                label="🎂 Rappels d'anniversaires"
                checked={pushEvents.birthdays}
                onChange={(v) =>
                  setPushEvents((prev) => ({ ...prev, birthdays: v }))
                }
              />
              <PrefToggle
                label="💬 Nouveaux messages chat"
                checked={pushEvents.chat}
                onChange={(v) =>
                  setPushEvents((prev) => ({ ...prev, chat: v }))
                }
              />
              <PrefToggle
                label="👥 Demandes d'amis / acceptations"
                checked={pushEvents.friends}
                onChange={(v) =>
                  setPushEvents((prev) => ({ ...prev, friends: v }))
                }
              />
              <PrefToggle
                label="🎁 Nouveaux vœux sur ma liste cadeaux"
                checked={pushEvents.gifts}
                onChange={(v) =>
                  setPushEvents((prev) => ({ ...prev, gifts: v }))
                }
              />
            </div>
          </div>

          {/* ── Section C : Timing anniversaires ── */}
          {pushEvents.birthdays && (
            <div className="push-section">
              <h3 className="push-section-title">
                Quand être notifié pour les anniversaires ?
              </h3>
              <div className="push-timings">
                {TIMING_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="push-timing-option">
                    <input
                      type="checkbox"
                      checked={pushTimings.includes(value)}
                      onChange={() => toggleTiming(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Bouton sauvegarder ── */}
          <div className="push-save-row">
            <button
              className="push-btn push-btn--save"
              onClick={handleSave}
              disabled={saveLoading}
            >
              {saveLoading ? "Sauvegarde..." : "Sauvegarder les préférences"}
            </button>
            {saveStatus === "saved" && (
              <span className="push-save-status success">✓ Sauvegardé</span>
            )}
            {saveStatus === "error" && (
              <span className="push-save-status error">✗ Erreur</span>
            )}
          </div>
        </>
      )}

      <div className="notification-footer">
        <p className="info-text">
          Les notifications push arrivent même quand l'onglet est fermé.{" "}
          <strong>iOS</strong> : installez BirthReminder sur votre écran
          d'accueil via Safari pour les recevoir.
        </p>
      </div>
    </div>
  );
};

export default PushTab;

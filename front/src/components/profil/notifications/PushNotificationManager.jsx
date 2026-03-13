import { useEffect, useState } from "react";
import service from "../../../api/apiHandler";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationManager() {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setStatus("granted");
    }
  }, []);

  const handleSubscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    setStatus("loading");

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const res = await service.get("/push/vapid-public-key");
      const convertedKey = urlBase64ToUint8Array(res.data.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });

      await service.post("/push/subscribe", {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      setStatus("granted");
    } catch (err) {
      console.error("[Push] Erreur:", err);
      setStatus(Notification.permission === "denied" ? "denied" : "idle");
    }
  };

  if (status === "granted" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <div className="push-banner push-banner--denied">
        🔔 Notifications bloquées — autorise-les dans les réglages de ton
        navigateur
      </div>
    );
  }

  return (
    <div className="push-banner">
      <span>
        🎂 Active les notifications pour ne jamais rater un anniversaire !
      </span>
      <button
        onClick={handleSubscribe}
        disabled={status === "loading"}
        className="push-banner__btn"
      >
        {status === "loading" ? "Activation..." : "Activer"}
      </button>
    </div>
  );
}

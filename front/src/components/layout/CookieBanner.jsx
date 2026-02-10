import CookieConsent from "react-cookie-consent";
import "./css/cookieBanner.css";

export default function CookieBanner() {
  const handleAcceptAll = () => {
    localStorage.setItem(
      "cookie-preferences",
      JSON.stringify({
        necessary: true,
        analytics: true,
        functional: true,
      }),
    );
    console.log("Tous les cookies acceptés");
  };

  const handleDeclineAll = () => {
    localStorage.setItem(
      "cookie-preferences",
      JSON.stringify({
        necessary: true,
        analytics: false,
        functional: false,
      }),
    );
    console.log("Cookies refusés (sauf nécessaires)");
  };

  return (
    <CookieConsent
      location="bottom"
      buttonText="J'accepte"
      declineButtonText="Refuser"
      enableDeclineButton
      cookieName="birthreminder-cookie-consent"
      containerClasses="cookie-banner-container"
      contentClasses="cookie-banner-content"
      buttonClasses="cookie-accept-btn"
      declineButtonClasses="cookie-decline-btn"
      expires={365}
      onAccept={handleAcceptAll}
      onDecline={handleDeclineAll}
    >
      <div className="cookie-message">
        🍪 Nous utilisons des cookies pour améliorer votre expérience.{" "}
        <a
          href="/cookies"
          className="cookie-link"
          onClick={(e) => e.stopPropagation()}
        >
          En savoir plus
        </a>
      </div>
    </CookieConsent>
  );
}

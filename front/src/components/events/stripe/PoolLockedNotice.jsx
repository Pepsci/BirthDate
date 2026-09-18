// PoolLockedNotice.jsx
//
// Affiché à la place des outils de cagnotte (Stripe, RIB, PayPal, cagnotte
// externe) quand l'organisateur ne peut pas collecter d'argent :
//   - "minor"             : moins de 18 ans
//   - "birthdate_missing" : date de naissance absente du profil
//   - "birthdate_cooldown": date de naissance modifiée il y a moins de 30 j
//   - "admin_blocked"     : bloqué par un admin
// Le serveur bloque de toute façon (middleware requireAdultForPool) : ce
// composant évite juste de proposer un bouton qui échouerait.

import "../css/poolLocked.css";

function messagesFor(until) {
  const date = until ? new Date(until).toLocaleDateString("fr-FR") : null;
  return {
    minor: {
      title: "Cagnotte réservée aux majeurs",
      text: "Tu pourras ouvrir une cagnotte ou partager un moyen de paiement à partir de tes 18 ans. Tout le reste de l'événement reste accessible.",
    },
    birthdate_missing: {
      title: "Date de naissance manquante",
      text: "Renseigne ta date de naissance dans ton profil pour pouvoir ouvrir une cagnotte.",
    },
    birthdate_cooldown: {
      title: "Cagnotte disponible bientôt",
      text: `Ta date de naissance a été modifiée récemment. Par sécurité, tu pourras ouvrir une cagnotte à partir du ${date}.`,
    },
    admin_blocked: {
      title: "Cagnottes suspendues",
      text: "L'ouverture de cagnottes est suspendue pour ton compte. Contacte le support pour en savoir plus.",
    },
  };
}

export default function PoolLockedNotice({ reason, until, compact = false }) {
  const messages = messagesFor(until);
  const { title, text } = messages[reason] || messages.minor;
  return (
    <div className={`pool-locked${compact ? " pool-locked--compact" : ""}`}>
      <i className="fa-solid fa-lock pool-locked-icon" aria-hidden="true"></i>
      <div>
        <p className="pool-locked-title">{title}</p>
        <p className="pool-locked-text">{text}</p>
      </div>
    </div>
  );
}

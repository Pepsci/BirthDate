import React, { useEffect, useState } from "react";
import apiHandler from "../../api/apiHandler";
import "./css/myContributions.css";

/*
 * Historique des contributions de l'utilisateur.
 *
 * ⚠️ Cet écran n'est pas décoratif : c'est une PREUVE.
 *
 * En charges directes, l'argent d'une contribution part directement chez
 * l'organisateur. BirthReminder ne le détient jamais et ne peut pas rembourser
 * à sa place. Le contributeur n'a donc qu'un interlocuteur — et jusqu'ici, plus
 * aucune trace de ce qu'il avait versé une fois la page fermée : ni montant, ni
 * date, ni référence. Réclamer devenait très difficile.
 *
 * D'où la référence de paiement affichée et copiable : c'est elle qu'on cite à
 * l'organisateur ou au support pour identifier la contribution sans ambiguïté.
 */

const euros = (cents) =>
  ((cents || 0) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

const formatDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const MyContributions = () => {
  const [contributions, setContributions] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    apiHandler
      .get("/events/mine/contributions")
      .then((res) => setContributions(res.data.contributions))
      .catch(() =>
        setError("Impossible de charger vos contributions pour le moment."),
      );
  }, []);

  /*
   * On copie un RÉCAPITULATIF, pas la référence seule.
   *
   * Un `pi_3ToKuh3ZbPfimmX51j8TUNlk` collé tout nu dans un message ne dit rien
   * à personne : l'organisateur ne reconnaît pas ce code, il reconnaît « 25 €
   * le 19 juin pour l'anniversaire de Marie ». La référence reste dedans parce
   * qu'elle est le seul identifiant sans ambiguïté — c'est ce que le support
   * recherche, et ce que l'organisateur retrouvera dans son tableau de bord
   * Stripe si le doute persiste. Mais elle accompagne le message, elle ne le
   * remplace pas.
   */
  const copySummary = async (c) => {
    const lines = [
      `Contribution de ${euros(c.amount)}`,
      c.event ? `Événement : ${c.event.title}` : null,
      `Date : ${formatDate(c.createdAt)}`,
      c.event?.organizer ? `Encaissée par : ${c.event.organizer}` : null,
      `Référence de paiement : ${c.reference}`,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : la
      // référence reste sélectionnable à la main, on ne bloque rien.
    }
  };

  if (error) return <p className="mycontrib-error">{error}</p>;
  if (!contributions) return <p className="mycontrib-loading">Chargement…</p>;

  const total = contributions
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="mycontrib">
      <h2 className="mycontrib-title">Mes contributions</h2>

      {contributions.length === 0 ? (
        <p className="mycontrib-empty">
          Vous n'avez encore participé à aucune cagnotte. Vos contributions
          apparaîtront ici, avec leur reçu.
        </p>
      ) : (
        <>
          <p className="mycontrib-total">
            {contributions.length} contribution
            {contributions.length > 1 ? "s" : ""} · {euros(total)} versés
          </p>

          <ul className="mycontrib-list">
            {contributions.map((c) => (
              <li
                key={c.id}
                className={
                  "mycontrib-item" +
                  (c.status === "refunded" ? " mycontrib-item--refunded" : "")
                }
              >
                <div className="mycontrib-head">
                  <span className="mycontrib-amount">{euros(c.amount)}</span>
                  <span
                    className={
                      "mycontrib-tag " +
                      (c.status === "refunded"
                        ? "mycontrib-tag--refunded"
                        : "mycontrib-tag--ok")
                    }
                  >
                    {c.status === "refunded" ? "Remboursée" : "Versée"}
                  </span>
                </div>

                <p className="mycontrib-event">
                  {c.event ? (
                    <a href={`/event/${c.event.shortId}`}>{c.event.title}</a>
                  ) : (
                    <em>Événement supprimé</em>
                  )}
                </p>

                <p className="mycontrib-meta">
                  {formatDate(c.createdAt)}
                  {c.event?.organizer && <> · encaissé par {c.event.organizer}</>}
                  {c.status === "refunded" && c.refundedAt && (
                    <> · remboursée le {formatDate(c.refundedAt)}</>
                  )}
                </p>

                <button
                  type="button"
                  className="mycontrib-ref"
                  onClick={() => copySummary(c)}
                  title="Copier le récapitulatif à envoyer à l'organisateur"
                >
                  <span>
                    <small>Référence de paiement</small>
                    {c.reference}
                  </span>
                  <em>
                    {copied === c.id ? "copié ✓" : "copier le récapitulatif"}
                  </em>
                </button>
              </li>
            ))}
          </ul>

          {/* Dire une fois, clairement, qui détient l'argent — c'est ce qui
              évite qu'on nous réclame un remboursement qu'on ne peut pas
              faire, et ce qui oriente vers le bon interlocuteur. */}
          <div className="mycontrib-note">
            <p>
              Les contributions sont encaissées <strong>directement par
              l'organisateur</strong> de chaque événement. BirthReminder ne
              détient jamais les fonds et ne peut donc pas rembourser à sa
              place.
            </p>
            <p>
              Si un événement est annulé ou si le cadeau n'est pas acheté,
              contactez l'organisateur : le bouton « copier le récapitulatif »
              prépare un message tout fait avec le montant, la date et la
              référence. Sans réponse de sa part,{" "}
              <a href="/contact">écrivez-nous</a> en joignant ce récapitulatif :
              nous ne pouvons pas trancher un désaccord, mais la référence nous
              permet de retrouver le paiement et de confirmer qu'il a bien eu
              lieu.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default MyContributions;

import ReactionIcon, { REACTIONS, REACTION_LABELS } from "./ReactionIcon";
import "./css/reactions.css";

/**
 * Rangée de réactions proposées au-dessus du menu contextuel.
 *
 * ⚠️ Toujours les six, dans un ordre fixe : on apprend la position avant
 * d'apprendre le dessin. Un ordre « intelligent » (par fréquence) ferait rater
 * la cible à chaque fois.
 *
 * `mine` entoure celle qu'on a déjà posée — recliquer dessus la retire, ce que
 * le serveur gère déjà en bascule.
 */
export default function ReactionPicker({ mine, onPick }) {
  return (
    <div className="reaction-picker">
      {REACTIONS.map((name) => (
        <button
          key={name}
          type="button"
          className={`reaction-choice ${mine === name ? "mine" : ""}`}
          title={REACTION_LABELS[name]}
          aria-label={REACTION_LABELS[name]}
          onClick={(e) => {
            e.stopPropagation();
            onPick(name);
          }}
        >
          <ReactionIcon name={name} size={22} />
        </button>
      ))}
    </div>
  );
}

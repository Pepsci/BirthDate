import ReactionIcon, { REACTION_LABELS } from "./ReactionIcon";
import "./css/reactions.css";

/**
 * Pastilles de réactions affichées sous une bulle — pendant web de
 * mobile/src/components/ReactionPills.tsx.
 *
 * ⚠️ Regroupées par type avec un compteur, jamais une pastille par personne :
 * sur un message d'événement à douze participants, l'affichage individuel
 * déborderait de la colonne et noierait le message lui-même.
 *
 * Le compteur n'apparaît qu'à partir de deux — « ❤️ 1 » est du bruit, la
 * présence de la pastille dit déjà « une personne ».
 *
 * Cliquer une pastille bascule sa propre réaction : c'est le raccourci qu'on
 * cherche instinctivement pour se joindre à ce qui est déjà là, sans repasser
 * par le menu.
 */
export default function ReactionPills({ reactions, myUserId, onToggle }) {
  if (!reactions || reactions.length === 0) return null;

  const grouped = new Map();
  for (const r of reactions) {
    const entry = grouped.get(r.reaction) || { count: 0, mine: false };
    entry.count += 1;
    if (myUserId && String(r.user) === String(myUserId)) entry.mine = true;
    grouped.set(r.reaction, entry);
  }

  return (
    <div className="reaction-pills">
      {[...grouped.entries()].map(([name, { count, mine }]) => (
        <button
          key={name}
          type="button"
          className={`reaction-pill ${mine ? "mine" : ""}`}
          title={REACTION_LABELS[name] || name}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(name);
          }}
        >
          <ReactionIcon name={name} size={14} />
          {count > 1 && <span className="reaction-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}

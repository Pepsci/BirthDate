import { useMemo, useState } from "react";
import { FAQ_SECTIONS } from "../../data/faqData";
import "./css/helpCenter.css";

// Retire les accents pour que "evenement" retrouve "événement".
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// À plat, une seule fois : toutes les questions avec leur catégorie
// d'origine, pour la recherche libre en haut du centre d'aide.
const FLAT_ITEMS = FAQ_SECTIONS.flatMap((section) =>
  section.items.map((item, itemIndex) => ({
    ...item,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionEmoji: section.emoji,
    itemIndex,
  })),
);

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 6;

/**
 * Centre d'aide affiché sur la page Contact : recherche + navigation par
 * catégorie (façon Ubisoft/EA Help), avec la réponse affichée directement
 * plutôt qu'un simple lien vers le Guide.
 *
 * `onNeedHelp(context)` est appelé quand l'utilisateur indique que rien ne
 * répond à sa question. `context` est soit une chaîne décrivant la question
 * consultée en dernier (pour pré-remplir l'objet du formulaire), soit
 * `null` si l'utilisateur saute directement au formulaire sans avoir
 * consulté de réponse précise. Ce bouton reste TOUJOURS visible, à chaque
 * étape : le centre d'aide guide, il ne bloque jamais l'accès au formulaire.
 */
export default function HelpCenter({ onNeedHelp }) {
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const needle = normalize(trimmedQuery);
    return FLAT_ITEMS.filter(
      (item) =>
        normalize(item.q).includes(needle) ||
        normalize(item.sectionTitle).includes(needle),
    ).slice(0, MAX_RESULTS);
  }, [isSearching, trimmedQuery]);

  const activeSection = FAQ_SECTIONS.find((s) => s.id === activeSectionId) || null;
  const activeItem =
    activeSection && activeItemIndex !== null
      ? activeSection.items[activeItemIndex]
      : null;

  const openItem = (sectionId, itemIndex) => {
    setQuery("");
    setActiveSectionId(sectionId);
    setActiveItemIndex(itemIndex);
  };

  const backToCategories = () => {
    setActiveSectionId(null);
    setActiveItemIndex(null);
  };

  const backToQuestions = () => {
    setActiveItemIndex(null);
  };

  const currentContext = activeItem
    ? `${activeSection.title} — ${activeItem.q}`
    : null;

  return (
    <div className="helpcenter">
      <div className="helpcenter-search">
        <input
          type="text"
          className="helpcenter-search-input"
          placeholder="Cherche une réponse (ex : annuler un événement, wishlist…)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveSectionId(null);
            setActiveItemIndex(null);
          }}
        />
      </div>

      {isSearching ? (
        <div className="helpcenter-results">
          {searchResults.length === 0 ? (
            <p className="helpcenter-empty">
              Aucune réponse trouvée pour « {trimmedQuery} ».
            </p>
          ) : (
            searchResults.map((item) => (
              <button
                key={`${item.sectionId}-${item.itemIndex}`}
                type="button"
                className="helpcenter-result"
                onClick={() => openItem(item.sectionId, item.itemIndex)}
              >
                <span className="helpcenter-result-emoji">{item.sectionEmoji}</span>
                <span className="helpcenter-result-text">
                  <span className="helpcenter-result-q">{item.q}</span>
                  <span className="helpcenter-result-section">{item.sectionTitle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : !activeSection ? (
        <div className="helpcenter-categories">
          {FAQ_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="helpcenter-category"
              onClick={() => {
                setActiveSectionId(section.id);
                setActiveItemIndex(null);
              }}
            >
              <span className="helpcenter-category-emoji">{section.emoji}</span>
              <span className="helpcenter-category-title">{section.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="helpcenter-section">
          <button
            type="button"
            className="helpcenter-breadcrumb"
            onClick={activeItem ? backToQuestions : backToCategories}
          >
            ← {activeItem ? activeSection.title : "Toutes les catégories"}
          </button>

          {activeItem && (
            <div className="helpcenter-answer">
              <p className="helpcenter-answer-q">{activeItem.q}</p>
              <p className="helpcenter-answer-a">{activeItem.a}</p>
            </div>
          )}

          <div className="helpcenter-questions">
            {activeSection.items.map((item, i) => (
              <button
                key={i}
                type="button"
                className={
                  "helpcenter-question" +
                  (i === activeItemIndex ? " helpcenter-question--active" : "")
                }
                onClick={() => setActiveItemIndex(i)}
              >
                {item.q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="helpcenter-cta">
        <p>
          {activeItem
            ? "Cette réponse ne résout pas ton problème ?"
            : "Toujours besoin d'aide ?"}
        </p>
        <button
          type="button"
          className="helpcenter-cta-btn"
          onClick={() => onNeedHelp(currentContext)}
        >
          Contacter le support
        </button>
      </div>
    </div>
  );
}

/**
 * Largeurs de lecture.
 *
 * Sur iPad (et sur un pliable déplié), un formulaire ou une liste étirés sur
 * toute la largeur sont désagréables : l'œil fait des allers-retours de 1 300
 * points entre l'étiquette et le champ. On borne donc le contenu et on le
 * centre. Sur téléphone, ces valeurs sont plus grandes que l'écran : rien ne
 * change.
 *
 * Usage — dans le style passé en `contentContainerStyle` (ou sur le conteneur
 * d'un écran sans défilement) :
 *
 *   content: { padding: 16, gap: 8, ...formPane },
 */

/** Formulaires et écrans de saisie : une colonne confortable. */
export const FORM_MAX_WIDTH = 560;

/** Listes et textes longs : un peu plus large, ça reste lisible. */
export const READING_MAX_WIDTH = 760;

/** Panneaux d'authentification : plus étroit, le contenu est court. */
export const AUTH_MAX_WIDTH = 480;

export const formPane = {
  width: "100%",
  maxWidth: FORM_MAX_WIDTH,
  alignSelf: "center",
} as const;

export const readingPane = {
  width: "100%",
  maxWidth: READING_MAX_WIDTH,
  alignSelf: "center",
} as const;

export const authPane = {
  width: "100%",
  maxWidth: AUTH_MAX_WIDTH,
  alignSelf: "center",
} as const;

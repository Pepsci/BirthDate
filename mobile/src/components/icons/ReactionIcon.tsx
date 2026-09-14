import Svg, { Circle, Path } from "react-native-svg";

/**
 * Jeu de réactions dessinées en SVG, dans le même repère que Icon.tsx :
 * viewBox 24×24, emprise centrée sur (12, 12).
 *
 * ⚠️ Traitement différent des icônes d'en-tête, et c'est délibéré.
 *
 * Les icônes de Icon.tsx sont en TRAIT parce que ce sont des affordances : on
 * doit les comprendre, pas les ressentir. Une réaction est l'inverse — un
 * tampon émotionnel, affiché à 14-16 px sous une bulle. En trait fin et gris à
 * cette taille, un cœur devient une tache illisible. D'où des APLATS COLORÉS,
 * lisibles au premier coup d'œil et reconnaissables de loin.
 *
 * ⚠️ Les couleurs sont FIXES, pas issues du thème. Une réaction garde le même
 * sens en clair comme en sombre : un cœur rouge est un cœur rouge. Les teintes
 * sont choisies assez soutenues pour tenir sur les deux fonds.
 *
 * Le stockage, lui, ne connaît que la clé ("love") — jamais le dessin. On peut
 * donc tout redessiner sans toucher à une seule ligne de la base.
 */

export type ReactionName = "like" | "love" | "laugh" | "wow" | "sad" | "party";

/** Ordre d'affichage dans le sélecteur. Le plus utilisé en premier. */
export const REACTIONS: ReactionName[] = [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "party",
];

/** Libellés pour l'accessibilité — un dessin seul n'est pas annonçable. */
export const REACTION_LABELS: Record<ReactionName, string> = {
  like: "J'aime",
  love: "J'adore",
  laugh: "Ça me fait rire",
  wow: "Ça m'étonne",
  sad: "Ça me rend triste",
  party: "On fête ça",
};

const FACE = "#F5B301"; // jaune des visages
const FACE_INK = "#7A5600"; // traits des visages, lisibles sur le jaune

export default function ReactionIcon({
  name,
  size = 18,
}: {
  name: ReactionName;
  size?: number;
}) {
  switch (name) {
    case "love":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Cœur : emprise x 3→21, y 5→20,5 — centrée sur (12, 12,75). */}
          <Path
            d="M12 20.5 C12 20.5 3 15.2 3 9.8 C3 6.9 5.2 5 7.6 5 C9.4 5 11.1 6 12 7.6 C12.9 6 14.6 5 16.4 5 C18.8 5 21 6.9 21 9.8 C21 15.2 12 20.5 12 20.5 Z"
            fill="#E8385A"
          />
        </Svg>
      );

    case "like":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Pouce levé, main simplifiée. */}
          <Path
            d="M8.5 21 H6.2 C5.3 21 4.6 20.3 4.6 19.4 V12.6 C4.6 11.7 5.3 11 6.2 11 H8.5 Z"
            fill="#2E7BE8"
          />
          <Path
            d="M10 11 L13.4 3.6 C13.7 3 14.4 2.8 15 3 C15.9 3.4 16.4 4.4 16.2 5.4 L15.5 8.8 H19 C20.2 8.8 21.1 9.9 20.8 11.1 L19.4 18.4 C19.2 19.6 18.2 20.5 17 20.5 H10 Z"
            fill="#3D8DF5"
          />
        </Svg>
      );

    case "laugh":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" fill={FACE} />
          {/* Yeux plissés : deux arcs vers le haut. */}
          <Path
            d="M7 10.6 C7.9 9.3 9.5 9.3 10.4 10.6"
            stroke={FACE_INK}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M13.6 10.6 C14.5 9.3 16.1 9.3 17 10.6"
            stroke={FACE_INK}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Bouche grande ouverte, pleine : c'est ce qui dit « rire ». */}
          <Path d="M6.6 13.6 H17.4 C17.4 17 15 19 12 19 C9 19 6.6 17 6.6 13.6 Z" fill={FACE_INK} />
        </Svg>
      );

    case "wow":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" fill={FACE} />
          <Circle cx="8.7" cy="10" r="1.4" fill={FACE_INK} />
          <Circle cx="15.3" cy="10" r="1.4" fill={FACE_INK} />
          {/* Bouche ronde : la surprise tient entièrement dans cette forme. */}
          <Circle cx="12" cy="15.6" r="2.6" fill={FACE_INK} />
        </Svg>
      );

    case "sad":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="9" fill={FACE} />
          <Circle cx="8.7" cy="10.2" r="1.3" fill={FACE_INK} />
          <Circle cx="15.3" cy="10.2" r="1.3" fill={FACE_INK} />
          {/* Bouche inversée — arc vers le bas. */}
          <Path
            d="M8.2 17 C9.3 15.2 14.7 15.2 15.8 17"
            stroke={FACE_INK}
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
          {/* Larme : le détail qui lève l'ambiguïté avec « déçu ». */}
          <Path d="M17 12.4 C17 12.4 18.6 14.3 18.6 15.4 C18.6 16.3 17.9 17 17 17 C16.1 17 15.4 16.3 15.4 15.4 C15.4 14.3 17 12.4 17 12.4 Z" fill="#4AA3F0" />
        </Svg>
      );

    case "party":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {/* Cornet de confettis, pointe en bas à gauche. */}
          <Path d="M3.4 20.6 L9.2 8.8 L15.2 14.8 Z" fill="#F0932B" />
          <Circle cx="16.4" cy="6.2" r="1.5" fill="#E8385A" />
          <Circle cx="20" cy="9.6" r="1.2" fill="#3D8DF5" />
          <Circle cx="19.2" cy="4" r="1.1" fill="#F5B301" />
          <Circle cx="13.2" cy="3.6" r="1.1" fill="#3BC47D" />
        </Svg>
      );
  }
}

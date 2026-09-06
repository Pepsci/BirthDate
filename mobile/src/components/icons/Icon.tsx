import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * Jeu d'icônes en trait, dessinées en SVG.
 *
 * ⚠️ Pourquoi du SVG plutôt qu'un emoji ou une forme CSS. Les icônes des
 * en-têtes étaient soit des emojis (💬 ✏️ 🗑️), soit un chevron fabriqué avec un
 * carré bordé tourné à 45°. Dans les deux cas, le centrage dépendait de
 * réglages optiques faits à la main :
 *
 *  - un emoji repose sur la ligne de base et sa boîte réserve la place du
 *    jambage descendant, que le glyphe n'occupe pas — d'où un décalage vertical
 *    qu'on compensait par un `top` proportionnel à la taille de police, et dont
 *    la valeur exacte dépend de la police système de l'appareil ;
 *  - le chevron bordé n'a que deux bordures peintes sur quatre, donc son encre
 *    est décentrée dans sa propre boîte après rotation — on la recalait avec un
 *    `left: 2.5` calculé à la main.
 *
 * En SVG, le `viewBox` EST le repère : une forme dont l'emprise est symétrique
 * autour de x=12 dans un viewBox 24×24 est centrée, sur toutes les plateformes
 * et quelle que soit la police du système. Plus rien à régler à l'œil.
 *
 * Chaque tracé ci-dessous est construit pour que son emprise soit centrée sur
 * (12, 12) — c'est la règle à respecter en ajoutant une icône.
 */

export type IconName = "chevron-left" | "chat" | "pencil" | "trash" | "more";

const PATHS: Record<IconName, string[]> = {
  // Emprise x : 8,75 → 15,25 · y : 5 → 19 — symétrique autour de (12, 12).
  "chevron-left": ["M15.25 5 L8.75 12 L15.25 19"],

  // Bulle avec ergot en bas à gauche. Emprise x : 3 → 21 · y : 4 → 20.
  chat: [
    "M21 7v6a3 3 0 0 1-3 3h-6l-5 4v-4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z",
  ],

  // Crayon sur la diagonale. Emprise ≈ 4 → 20 sur les deux axes.
  pencil: [
    "M4 20 L4.9 15.9 L15.9 4.9 a2.9 2.9 0 0 1 3.2 3.2 L8.1 19.1 L4 20 Z",
    "M14.6 6.2 L17.8 9.4",
  ],

  // Trois points. Chaque point est un segment de longueur nulle rendu rond par
  // strokeLinecap="round". Emprise x : 6 → 18, centrée sur 12.
  more: ["M6 12h.01", "M12 12h.01", "M18 12h.01"],

  // Corbeille. Emprise x : 4 → 20, centrée sur 12.
  trash: [
    "M4 7h16",
    "M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7",
    "M6.6 7l.85 12.2a2 2 0 0 0 2 1.8h5.1a2 2 0 0 0 2-1.8L17.4 7",
  ],
};

export default function Icon({
  name,
  size,
  color,
  strokeWidth = 2,
  fill = false,
  inset = 8,
}: {
  name: IconName;
  /** Côté du SVG, en points. Ignoré quand `fill` est vrai. */
  size?: number;
  color: string;
  strokeWidth?: number;
  /**
   * Le SVG couvre exactement son parent au lieu d'être un enfant dimensionné
   * que le parent centre.
   *
   * ⚠️ C'est ce qui règle le dernier demi-pixel de décalage. Un SVG de 20 pt
   * centré par flexbox dans un bouton de 34 pt bordé d'un hairline laisse
   * (34 − 2 × 0,333 − 20) / 2 = 6,67 pt de chaque côté : une valeur
   * fractionnaire que le moteur de rendu arrondit, et pas forcément du même
   * côté à gauche et à droite. En couvrant le parent, il n'y a plus aucun
   * centrage à calculer — la position du tracé ne dépend plus que du viewBox,
   * qui est exact par construction.
   */
  fill?: boolean;
  /**
   * Marge autour du tracé, en unités de viewBox, quand `fill` est vrai. Elle
   * remplace l'écart qu'apportait la différence de taille entre l'icône et son
   * bouton : à 8, le tracé de 24 unités occupe 24/40 du bouton.
   */
  inset?: number;
}) {
  const paths = PATHS[name].map((d, i) => (
    <Path
      key={i}
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));

  if (fill) {
    const span = 24 + inset * 2;
    return (
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`${-inset} ${-inset} ${span} ${span}`}
        fill="none"
      >
        {paths}
      </Svg>
    );
  }

  return (
    <Svg width={size ?? 20} height={size ?? 20} viewBox="0 0 24 24" fill="none">
      {paths}
    </Svg>
  );
}

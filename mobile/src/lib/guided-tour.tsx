/**
 * Tours guidés de première utilisation — overlay "spotlight" générique.
 *
 * Un tour = une suite d'étapes. Chaque étape met en lumière une cible
 * (enregistrée via <TourTarget id="…">) avec une bulle explicative :
 *   - étape informative : la cible est verrouillée, bouton « Suivant » ;
 *   - étape `requirePress` : tout l'écran est bloqué SAUF la cible,
 *     l'utilisateur doit appuyer dessus pour continuer (échappatoire
 *     « Plus tard » pour ne jamais piéger l'utilisateur — ni la review Apple).
 *
 * Chaque tour ne s'affiche qu'une fois (expo-secure-store, clé par tour).
 * Intégration : provider + <TourOverlay /> dans app/(tabs)/_layout.tsx,
 * déclenchement via startTour(TOURS.xxx) dans l'écran concerné.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useThemedStyles, ThemeColors } from "./theme-context";

const KEY_PREFIX = "guidedTour_";
const HOLE_PADDING = 8;
/** Hauteur estimée de la bulle pour décider de l'afficher au-dessus/en dessous. */
const BUBBLE_ESTIMATE = 190;

type Rect = { x: number; y: number; width: number; height: number };

export type TourStep = {
  /** Id de la cible enregistrée par <TourTarget id="…"> */
  targetId: string;
  title: string;
  text: string;
  /** true : l'utilisateur doit appuyer sur la cible pour avancer. */
  requirePress?: boolean;
};

export type TourDef = { id: string; steps: TourStep[] };

// ─── Définition des tours ───────────────────────────────────────────────────

export const TOURS = {
  birthdays: {
    id: "birthdays",
    steps: [
      {
        targetId: "tourAgenda",
        title: "📅 La vue agenda",
        text: "Ce bouton affiche tous les anniversaires, fêtes et événements du mois en un coup d'œil.",
      },
      {
        targetId: "tourAddDate",
        title: "🎂 Ta première date",
        text: "Appuie sur le ＋ pour ajouter ton premier anniversaire — c'est parti !",
        requirePress: true,
      },
    ],
  },
  events: {
    id: "events",
    steps: [
      {
        targetId: "tourAddEvent",
        title: "🎉 Ton premier événement",
        text: "Appuie sur le ＋ pour organiser une fête : fais voter la date et le lieu, invite tes amis, propose des cadeaux et lance une cagnotte.",
        requirePress: true,
      },
    ],
  },
  profile: {
    id: "profile",
    steps: [
      {
        targetId: "tourFriends",
        title: "👥 Tes amis",
        text: "Tout commence ici : ajoute tes amis pour voir automatiquement leurs anniversaires, discuter avec eux et les inviter à tes événements.",
      },
      {
        targetId: "tourNotifs",
        title: "🔔 Notifications",
        text: "Choisis ce que tu veux recevoir : notifications push sur ce téléphone (anniversaires, messages, événements…) et rappels par email.",
      },
      {
        targetId: "tourWishlist",
        title: "🎀 Ta wishlist",
        text: "Liste tes envies de cadeaux : tes amis la consultent pour ne jamais se tromper — et toi la leur !",
      },
      {
        targetId: "tourE2E",
        title: "🔐 Chiffrement & sécurité",
        text: "Tes messages sont chiffrés de bout en bout. Cette section te permet de gérer tes clés de chiffrement.",
      },
    ],
  },
} satisfies Record<string, TourDef>;

// ─── Contexte ───────────────────────────────────────────────────────────────

type TourContextValue = {
  activeTour: TourDef | null;
  stepIndex: number;
  startTour: (tour: TourDef) => void;
  next: () => void;
  finish: () => void;
  /** À appeler depuis le onPress d'une cible : avance si l'étape l'exige. */
  notifyTargetPress: (targetId: string) => void;
  setTarget: (id: string, rect: Rect) => void;
  targets: Record<string, Rect>;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useGuidedTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useGuidedTour doit être utilisé sous GuidedTourProvider");
  }
  return ctx;
}

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourDef | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targets, setTargets] = useState<Record<string, Rect>>({});
  const checkedRef = useRef<Set<string>>(new Set());
  const activeRef = useRef<TourDef | null>(null);
  activeRef.current = activeTour;

  const startTour = useCallback((tour: TourDef) => {
    if (activeRef.current) return; // un tour à la fois
    if (checkedRef.current.has(tour.id)) return;
    checkedRef.current.add(tour.id);
    SecureStore.getItemAsync(KEY_PREFIX + tour.id)
      .then((v) => {
        if (v !== "1" && !activeRef.current) {
          setStepIndex(0);
          setActiveTour(tour);
        }
      })
      .catch(() => {
        // en cas de doute, ne pas lancer le tour
      });
  }, []);

  const finish = useCallback(() => {
    const tour = activeRef.current;
    if (tour) {
      SecureStore.setItemAsync(KEY_PREFIX + tour.id, "1").catch(() => {});
    }
    setActiveTour(null);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    const tour = activeRef.current;
    if (!tour) return;
    setStepIndex((i) => {
      if (i + 1 >= tour.steps.length) {
        // dernière étape → terminer (hors du setState pour le SecureStore)
        setTimeout(finish, 0);
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const notifyTargetPress = useCallback(
    (targetId: string) => {
      const tour = activeRef.current;
      if (!tour) return;
      setStepIndex((i) => {
        const step = tour.steps[i];
        if (step?.requirePress && step.targetId === targetId) {
          if (i + 1 >= tour.steps.length) {
            setTimeout(finish, 0);
            return i;
          }
          return i + 1;
        }
        return i;
      });
    },
    [finish],
  );

  const setTarget = useCallback((id: string, rect: Rect) => {
    setTargets((t) => ({ ...t, [id]: rect }));
  }, []);

  return (
    <TourContext.Provider
      value={{
        activeTour,
        stepIndex,
        startTour,
        next,
        finish,
        notifyTargetPress,
        setTarget,
        targets,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

/**
 * Enveloppe un élément à mettre en lumière : mesure sa position à l'écran
 * (coordonnées fenêtre) et l'enregistre sous `id`.
 */
export function TourTarget({
  id,
  style,
  children,
}: {
  id: string;
  style?: object;
  children: ReactNode;
}) {
  const { setTarget } = useGuidedTour();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    // requestAnimationFrame : sur Android la mesure peut être nulle
    // si elle est faite avant la fin du layout.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) setTarget(id, { x, y, width, height });
      });
    });
  }, [id, setTarget]);

  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style}>
      {children}
    </View>
  );
}

/** Bloque les touches (les vues nues laissent remonter le responder). */
const block = () => true;

/**
 * Overlay du tour — à rendre PAR-DESSUS le navigateur (dernier enfant
 * d'un conteneur en flex:1 qui couvre tout l'écran, header et tab bar inclus).
 */
export function TourOverlay() {
  const { activeTour, stepIndex, next, finish, targets } = useGuidedTour();
  const { width: winW, height: winH } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);

  if (!activeTour) return null;
  const step = activeTour.steps[stepIndex];
  if (!step) return null;
  const rect = targets[step.targetId];
  if (!rect) return null; // cible pas encore mesurée

  const isLast = stepIndex === activeTour.steps.length - 1;

  const hole = {
    x: Math.max(0, rect.x - HOLE_PADDING),
    y: Math.max(0, rect.y - HOLE_PADDING),
    w: rect.width + HOLE_PADDING * 2,
    h: rect.height + HOLE_PADDING * 2,
  };

  // Bulle sous la cible, ou au-dessus si on manque de place en bas
  const below = hole.y + hole.h + 14 + BUBBLE_ESTIMATE < winH;
  const bubblePos = below
    ? { top: hole.y + hole.h + 14 }
    : { bottom: winH - hole.y + 14 };
  const arrowLeft = Math.min(Math.max(hole.x + hole.w / 2 - 8, 24), winW - 40);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4 bandes sombres autour du trou : tout est bloqué sauf la cible */}
      <View
        style={[styles.dim, { left: 0, top: 0, width: winW, height: hole.y }]}
        onStartShouldSetResponder={block}
      />
      <View
        style={[styles.dim, { left: 0, top: hole.y, width: hole.x, height: hole.h }]}
        onStartShouldSetResponder={block}
      />
      <View
        style={[
          styles.dim,
          {
            left: hole.x + hole.w,
            top: hole.y,
            width: winW - hole.x - hole.w,
            height: hole.h,
          },
        ]}
        onStartShouldSetResponder={block}
      />
      <View
        style={[
          styles.dim,
          {
            left: 0,
            top: hole.y + hole.h,
            width: winW,
            height: winH - hole.y - hole.h,
          },
        ]}
        onStartShouldSetResponder={block}
      />

      {/* Anneau autour de la cible */}
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          { left: hole.x, top: hole.y, width: hole.w, height: hole.h },
        ]}
      />

      {/* Étape informative : la cible n'est pas cliquable (vitre transparente) */}
      {!step.requirePress && (
        <View
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y,
            width: hole.w,
            height: hole.h,
          }}
          onStartShouldSetResponder={block}
        />
      )}

      {/* Bulle */}
      <View pointerEvents="box-none" style={[styles.bubbleWrap, bubblePos]}>
        {below && <View style={[styles.arrowUp, { left: arrowLeft }]} />}
        <View style={styles.bubble}>
          <Text style={styles.bubbleTitle}>{step.title}</Text>
          <Text style={styles.bubbleText}>{step.text}</Text>
          {step.requirePress ? (
            <Pressable style={styles.bubbleSkip} onPress={finish} hitSlop={8}>
              <Text style={styles.bubbleSkipText}>Plus tard</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.bubbleButton} onPress={next}>
              <Text style={styles.bubbleButtonText}>
                {isLast ? "Terminer" : "Suivant"}
              </Text>
            </Pressable>
          )}
        </View>
        {!below && <View style={[styles.arrowDown, { left: arrowLeft }]} />}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    dim: { position: "absolute", backgroundColor: "rgba(0,0,0,0.72)" },
    ring: {
      position: "absolute",
      borderRadius: 14,
      borderWidth: 2.5,
      borderColor: "#fff",
    },
    bubbleWrap: { position: "absolute", left: 16, right: 16 },
    arrowUp: {
      position: "absolute",
      top: -8,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderBottomWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderBottomColor: c.inputBg,
    },
    arrowDown: {
      position: "absolute",
      bottom: -8,
      width: 0,
      height: 0,
      borderLeftWidth: 8,
      borderRightWidth: 8,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: c.inputBg,
    },
    bubble: {
      backgroundColor: c.inputBg,
      borderRadius: 14,
      padding: 16,
      gap: 8,
      shadowColor: c.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    bubbleTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    bubbleText: { fontSize: 14, lineHeight: 20, color: c.sub },
    bubbleButton: {
      alignSelf: "flex-end",
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: 4,
    },
    bubbleButtonText: { color: c.white, fontWeight: "700", fontSize: 14 },
    bubbleSkip: { alignSelf: "flex-end", marginTop: 4, padding: 4 },
    bubbleSkipText: { color: c.faint, fontSize: 13 },
  });

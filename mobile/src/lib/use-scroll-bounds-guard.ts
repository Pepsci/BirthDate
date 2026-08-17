import { useCallback, useRef } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";

/**
 * Garde-fou contre les ScrollView bloqués.
 *
 * Symptôme : après avoir défilé loin, le contenu reste « monté trop haut » et
 * ne redescend plus. Le geste ne fait plus rien, et seul un aller-retour vers
 * un autre écran débloque la situation.
 *
 * Cause : ces écrans ont tous du contenu qui RÉTRÉCIT en cours de route —
 * sections repliées dans Profil et sur la page d'un événement, changement
 * d'onglet sur la carte d'une personne, liste de conversations qui se
 * raccourcit après un rafraîchissement. Quand la hauteur du contenu passe
 * sous la position de défilement courante, la ScrollView se retrouve calée
 * au-delà de son propre contenu. iOS ne recale la position qu'à la prochaine
 * passe de layout : s'il n'y en a pas, elle reste coincée là. Changer d'écran
 * la démonte et la recrée, ce qui explique que la navigation « répare ».
 *
 * Correctif : à chaque changement de hauteur du contenu, si la position
 * dépasse le maximum atteignable, on y revient immédiatement.
 *
 * Usage — étaler le retour sur la ScrollView :
 *   const guard = useScrollBoundsGuard();
 *   <ScrollView {...guard}>…</ScrollView>
 *
 * ⚠️ Pour une FlatList, utiliser `useScrollBoundsGuard` ne suffit pas :
 * `scrollTo` n'y existe pas, il faut `scrollToOffset`.
 */
export function useScrollBoundsGuard() {
  const ref = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const viewportH = useRef(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportH.current = e.nativeEvent.layout.height;
  }, []);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    const maxOffset = Math.max(0, h - viewportH.current);
    // Marge d'1 px : les arrondis de layout ne doivent pas déclencher un
    // recalage permanent qui empêcherait le rebond naturel en fin de liste.
    if (offsetY.current > maxOffset + 1) {
      offsetY.current = maxOffset;
      ref.current?.scrollTo({ y: maxOffset, animated: false });
    }
  }, []);

  return {
    ref,
    onScroll,
    onLayout,
    onContentSizeChange,
    // Sans throttle, onScroll n'est appelé qu'une fois par geste sur iOS et la
    // position mémorisée serait périmée au moment du recalage.
    scrollEventThrottle: 16,
  };
}

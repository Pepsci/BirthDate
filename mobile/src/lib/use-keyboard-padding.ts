import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Hauteur du clavier sur Android (0 sur iOS, où KeyboardAvoidingView gère).
 * Contourne le mode edge-to-edge d'Android 15+ qui casse adjustResize.
 */
export function useKeyboardPadding(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * Vrai quand le clavier est visible (les deux plateformes).
 * Sert à réduire la marge de sécurité bas quand le clavier couvre déjà
 * la zone du home indicator.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

import { ReactNode, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useThemedStyles, ThemeColors } from "../lib/theme-context";

const SCREEN_H = Dimensions.get("window").height;

/**
 * Bottom sheet réutilisable : glisser la barre vers le bas ou taper en dehors
 * pour fermer. Le contenu passé en `children` est scrollable.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.7) {
          Animated.timing(translateY, {
            toValue: SCREEN_H,
            duration: 220,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          <View style={styles.handleZone} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <Pressable onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 28,
      maxHeight: "85%",
    },
    handleZone: {
      alignItems: "center",
      paddingTop: 4,
      paddingBottom: 10,
      marginTop: -4,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.borderStrong,
    },
  });

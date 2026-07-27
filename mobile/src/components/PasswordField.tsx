import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps,
} from "react-native";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

/**
 * Champ mot de passe avec bouton Afficher / Masquer.
 *
 * Équivalent mobile du <PasswordInput> web (front/src/components/connect).
 * Toutes les props d'un TextInput sont transmises telles quelles ; on force
 * seulement `secureTextEntry`, `autoCapitalize` et `autoCorrect`.
 */
type Props = Omit<
  TextInputProps,
  "secureTextEntry" | "autoCapitalize" | "autoCorrect"
>;

export default function PasswordField({ style, ...inputProps }: Props) {
  const [show, setShow] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <TextInput
        placeholderTextColor={colors.placeholder}
        {...inputProps}
        style={[styles.input, style]}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setShow((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          show ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
      >
        <Text style={styles.toggleText}>{show ? "Masquer" : "Afficher"}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: "relative", justifyContent: "center" },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 14,
      // Place pour le bouton « Afficher »
      paddingRight: 86,
      fontSize: 16,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    toggle: { position: "absolute", right: 12, padding: 4 },
    toggleText: { color: c.primary, fontSize: 13, fontWeight: "600" },
  });

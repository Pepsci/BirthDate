import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useTheme } from "../lib/theme-context";

/**
 * Avatar réutilisable (mobile) : affiche la photo (uploadée ou DiceBear via
 * expo-image, qui gère WebP + SVG) et bascule sur les initiales si absente.
 */
export default function Avatar({
  uri,
  name = "",
  surname = "",
  size = 40,
}: {
  uri?: string | null;
  name?: string;
  surname?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const initials =
    `${name?.[0] ?? ""}${surname?.[0] ?? ""}`.toUpperCase() || "?";
  const showImg = !!uri && uri.trim().length > 0 && !failed;

  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View
      style={[
        box,
        styles.fallback,
        { backgroundColor: colors.primarySoft },
      ]}
    >
      <Text
        style={[
          styles.initials,
          { color: colors.primaryStrong, fontSize: size * 0.4 },
        ]}
      >
        {initials}
      </Text>
      {showImg && (
        <ExpoImage
          source={{ uri: uri as string }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { justifyContent: "center", alignItems: "center", overflow: "hidden" },
  initials: { fontWeight: "700" },
});

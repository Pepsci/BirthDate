import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { FAQ_SECTIONS as SECTIONS } from "../lib/faqData";

export default function GuideScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Guide d'utilisation" }} />

      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>📖</Text>
        <Text style={styles.heroTitle}>Guide d'utilisation</Text>
        <Text style={styles.heroDesc}>
          Tout ce qu'il faut pour ne plus jamais rater un anniversaire.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {section.emoji}  {section.title}
          </Text>
          {section.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.q}>{item.q}</Text>
              <Text style={styles.a}>{item.a}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Une question sans réponse ?</Text>
        <Pressable
          style={styles.supportBtn}
          onPress={() => router.push("/contact")}
        >
          <Text style={styles.supportBtnText}>✉️ Contacter le support</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { alignItems: "center", gap: 6, paddingVertical: 8 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: c.text },
  heroDesc: {
    color: c.sub,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: c.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.text },
  item: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: 10,
  },
  q: { fontSize: 14, fontWeight: "700", color: c.primaryStrong },
  a: { fontSize: 13, color: c.text, lineHeight: 19 },
  footer: { alignItems: "center", gap: 10, marginTop: 4, paddingBottom: 8 },
  footerText: { color: c.sub, fontSize: 14 },
  supportBtn: {
    backgroundColor: c.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  supportBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
});

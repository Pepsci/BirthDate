import { ScrollView, View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { FAQ_SECTIONS as SECTIONS } from "../lib/faqData";
import { readingPane } from "../lib/layout";
import { useAuth } from "../lib/auth-context";

export default function GuideScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { mode } = useAuth();
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
              {/* Une procédure se lit en étapes numérotées, pas en pavé :
                  l'ordre compte réellement, chaque marche suppose que la
                  précédente a échoué. */}
              {item.steps?.map((step, j) => (
                <View key={j} style={styles.step}>
                  <Text style={styles.stepNum}>{j + 1}.</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Sortie directe propre à la catégorie : un litige qui porte sur de
              l'argent ne doit pas se chercher au milieu des questions. */}
          {section.action?.kind === "poolIssue" && (
            <Pressable
              style={styles.sectionAction}
              /* Vers le support avec le gabarit prêt, et NON vers « Mes
                 contributions » : une contribution faite sans compte, ou dont
                 l'événement a disparu, n'y figure pas — l'utilisateur
                 tomberait sur une liste vide au moment précis où il a besoin
                 d'aide. L'étape 1 lui dit où trouver sa référence. */
              onPress={() =>
                router.push({
                  pathname: "/support",
                  params: {
                    // Sélecteur de cagnotte : le ticket est rattaché à
                    // l'événement, l'admin ouvre directement les
                    // contributions au lieu de deviner.
                    poolPicker: "1",
                    poolSubject: "Problème avec une cagnotte",
                    poolMessage: [
                      "— Ma contribution —",
                      "Montant : ",
                      "Date : ",
                      "Événement : ",
                      "Encaissé par : ",
                      "Référence de paiement : ",
                      "",
                      "— Ce qui se passe —",
                      "",
                      "",
                      "— Ai-je déjà contacté l'organisateur ? —",
                      "(oui, le … / pas encore)",
                      "",
                    ].join("\n"),
                  },
                })
              }
            >
              <Text style={styles.sectionActionText}>
                {section.action.label}
              </Text>
            </Pressable>
          )}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Une question sans réponse ?</Text>
        {/* Sans compte, le formulaire de support (serveur) est indisponible :
            on passe par un email, envoyé par l'utilisateur lui-même. */}
        <Pressable
          style={styles.supportBtn}
          onPress={() =>
            mode === "local"
              ? Linking.openURL("mailto:contact@birthreminder.com?subject=BirthReminder%20(sans%20compte)")
              : router.push("/contact")
          }
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
  content: { padding: 16, paddingBottom: 40, gap: 14, ...readingPane },
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
  step: { flexDirection: "row", gap: 8, marginTop: 8, paddingRight: 4 },
  stepNum: { fontSize: 13.5, fontWeight: "800", color: c.primary, minWidth: 18 },
  stepText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: c.sub },
  sectionAction: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: "center",
  },
  sectionActionText: {
    color: c.primary,
    fontWeight: "700",
    fontSize: 13.5,
    textAlign: "center",
  },
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

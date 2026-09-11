import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { FAQ_SECTIONS, Section } from "../lib/faqData";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

// Retire les accents pour que "evenement" retrouve "événement" — même règle
// que le centre d'aide web (front/src/components/pages/HelpCenter.jsx).
function normalize(str: string) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const FLAT_ITEMS = FAQ_SECTIONS.flatMap((section) =>
  section.items.map((item, itemIndex) => ({
    ...item,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionEmoji: section.emoji,
    itemIndex,
  })),
);

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 6;

/**
 * Porte d'entrée du support côté mobile : recherche + catégories, comme sur
 * le web (voir HelpCenter.jsx). Le bouton "Contacter le support" n'apparaît
 * qu'une fois une réponse consultée — on ne saute plus directement à
 * l'écran d'envoi (/support), sauf depuis ici avec le contexte de la
 * question qui n'a pas résolu le problème.
 */
export default function ContactScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const needle = normalize(trimmedQuery);
    return FLAT_ITEMS.filter(
      (item) =>
        normalize(item.q).includes(needle) ||
        normalize(item.sectionTitle).includes(needle),
    ).slice(0, MAX_RESULTS);
  }, [isSearching, trimmedQuery]);

  const activeSection: Section | null =
    FAQ_SECTIONS.find((s) => s.id === activeSectionId) || null;
  const activeItem =
    activeSection && activeItemIndex !== null
      ? activeSection.items[activeItemIndex]
      : null;

  const openItem = (sectionId: string, itemIndex: number) => {
    setQuery("");
    setActiveSectionId(sectionId);
    setActiveItemIndex(itemIndex);
  };

  const backToCategories = () => {
    setActiveSectionId(null);
    setActiveItemIndex(null);
  };

  const backToQuestions = () => setActiveItemIndex(null);

  const currentContext = activeItem
    ? `${activeSection!.title} — ${activeItem.q}`
    : null;

  const goToSupport = () => {
    router.push({
      pathname: "/support",
      params: currentContext ? { context: currentContext } : {},
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Contacter le support" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Cherche ta réponse ci-dessous — la plupart des questions trouvent
          une réponse immédiate.
        </Text>

        <TextInput
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
          placeholder="Cherche une réponse (ex : annuler un événement, wishlist…)"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setActiveSectionId(null);
            setActiveItemIndex(null);
          }}
        />

        {isSearching ? (
          <View style={styles.list}>
            {searchResults.length === 0 ? (
              <Text style={styles.empty}>
                Aucune réponse trouvée pour « {trimmedQuery} ».
              </Text>
            ) : (
              searchResults.map((item) => (
                <Pressable
                  key={`${item.sectionId}-${item.itemIndex}`}
                  style={styles.resultRow}
                  onPress={() => openItem(item.sectionId, item.itemIndex)}
                >
                  <Text style={styles.resultEmoji}>{item.sectionEmoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultQ}>{item.q}</Text>
                    <Text style={styles.resultSection}>{item.sectionTitle}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : !activeSection ? (
          <View style={styles.categories}>
            {FAQ_SECTIONS.map((section) => (
              <Pressable
                key={section.id}
                style={styles.categoryCard}
                onPress={() => {
                  setActiveSectionId(section.id);
                  setActiveItemIndex(null);
                }}
              >
                <Text style={styles.categoryEmoji}>{section.emoji}</Text>
                <Text style={styles.categoryTitle}>{section.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            {/* Grosse tuile de la catégorie active, épinglée en haut tant
                qu'on y reste — même tuile que la grille de départ, agrandie.
                Change de catégorie en catégorie, disparaît au retour à la
                grille. */}
            <Pressable style={styles.activeCategory} onPress={backToCategories}>
              <Text style={styles.activeCategoryEmoji}>{activeSection.emoji}</Text>
              <Text style={styles.activeCategoryTitle}>{activeSection.title}</Text>
              <Text style={styles.activeCategoryChange}>Changer ↺</Text>
            </Pressable>

            {activeItem && (
              <Pressable onPress={backToQuestions}>
                <Text style={styles.breadcrumb}>← Toutes les questions</Text>
              </Pressable>
            )}

            {activeItem && (
              <View style={styles.answer}>
                <Text style={styles.answerQ}>{activeItem.q}</Text>
                <Text style={styles.answerA}>{activeItem.a}</Text>
              </View>
            )}

            <View style={styles.questions}>
              {activeSection.items.map((item, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.questionRow,
                    i === activeItemIndex && styles.questionRowActive,
                  ]}
                  onPress={() => setActiveItemIndex(i)}
                >
                  <Text style={styles.questionText}>{item.q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {activeItem && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>
              Cette réponse ne résout pas ton problème ?
            </Text>
            <Pressable style={styles.ctaBtn} onPress={goToSupport}>
              <Text style={styles.ctaBtnText}>Contacter le support</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    intro: { color: c.sub, fontSize: 14, lineHeight: 20 },
    searchInput: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    list: { gap: 8 },
    empty: {
      color: c.sub,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 12,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 12,
    },
    resultEmoji: { fontSize: 20 },
    resultQ: { fontSize: 14, fontWeight: "700", color: c.text },
    resultSection: { fontSize: 12, color: c.faint, marginTop: 2 },
    categories: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    categoryCard: {
      flexBasis: "47%",
      flexGrow: 1,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    categoryEmoji: { fontSize: 26 },
    categoryTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.text,
      textAlign: "center",
    },
    section: { gap: 10 },
    activeCategory: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      padding: 12,
    },
    activeCategoryEmoji: { fontSize: 24 },
    activeCategoryTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "800",
      color: c.text,
    },
    activeCategoryChange: {
      fontSize: 12,
      fontWeight: "700",
      color: c.primaryStrong,
    },
    breadcrumb: { color: c.sub, fontSize: 13 },
    answer: {
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    answerQ: { fontSize: 15, fontWeight: "800", color: c.text },
    answerA: { fontSize: 13, color: c.sub, lineHeight: 19 },
    questions: { gap: 8 },
    questionRow: {
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 12,
    },
    questionRowActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    questionText: { fontSize: 13, color: c.text, fontWeight: "600" },
    cta: {
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    ctaText: { color: c.sub, fontSize: 14 },
    ctaBtn: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    ctaBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
  });

import {
  t,
  tn,
  AppLanguage,
  SUPPORTED_LANGUAGES,
  changeLanguage,
  getStoredLanguage,
} from "@/i18n";
import { syncLanguageWithServer } from "../../lib/language";
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  Linking,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { countLocalDates } from "../../lib/local-store";
import { hasLocalDataToImport } from "../../lib/local-migration";
import { useAuth } from "../../lib/auth-context";
import { pendingCount } from "../../lib/offline-queue";
import { deleteAccount } from "../../lib/users";
import {
  useGuidedTour,
  TourTarget,
  TOURS,
} from "../../lib/guided-tour";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
  ThemeMode,
} from "../../lib/theme-context";
import { readingPane } from "../../lib/layout";
import { legalUrl } from "../../lib/legal";

const LEGAL_LINKS: { emoji: string; label: string; url: string }[] = [
  { emoji: "📄", get label() { return t("profile:legal.terms"); }, get url() { return legalUrl("cgu"); } },
  { emoji: "🔒", get label() { return t("profile:legal.privacy"); }, get url() { return legalUrl("privacy"); } },
  { emoji: "🍪", get label() { return t("profile:legal.cookies"); }, get url() { return legalUrl("cookies"); } },
  { emoji: "⚖️", get label() { return t("profile:legal.notice"); }, get url() { return legalUrl("mentions-legales"); } },
];

const THEME_OPTIONS: { v: ThemeMode; l: string }[] = [
  { v: "system", get l() { return t("profile:theme.system"); } },
  { v: "light", get l() { return t("profile:theme.light"); } },
  { v: "dark", get l() { return t("profile:theme.dark"); } },
];

/** Noms des langues : toujours écrits dans leur propre langue. */
const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  fr: "Français",
  en: "English",
};

/**
 * Choix de la langue. Par défaut l'app suit le téléphone (« Téléphone ») ;
 * choisir une langue la force. Le serveur est prévenu dans la foulée pour que
 * les emails et les notifications suivent (lib/language.ts).
 *
 * Changer de langue remonte le navigateur (voir app/_layout.tsx) : ce
 * composant est donc recréé et relit le choix enregistré.
 */
function LanguageChooser() {
  const styles = useThemedStyles(makeStyles);
  const [choice, setChoice] = useState<AppLanguage | null>(() =>
    getStoredLanguage(),
  );
  const options: { v: AppLanguage | null; l: string }[] = [
    { v: null, l: t("profile:language.auto") },
    ...SUPPORTED_LANGUAGES.map((v) => ({ v, l: LANGUAGE_NAMES[v] })),
  ];
  const pick = async (v: AppLanguage | null) => {
    if (v === choice) return;
    setChoice(v);
    await changeLanguage(v);
    syncLanguageWithServer();
  };
  return (
    <>
      <Text style={styles.sectionLabel}>{t("profile:language.title")}</Text>
      <View style={styles.themeRow}>
        {options.map(({ v, l }) => (
          <Pressable
            key={v ?? "auto"}
            style={[styles.themeChip, choice === v && styles.themeChipActive]}
            onPress={() => pick(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === v }}
          >
            <Text
              style={[
                styles.themeChipText,
                choice === v && styles.themeChipTextActive,
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.languageHint}>{t("profile:language.hint")}</Text>
    </>
  );
}

/**
 * Deux profils distincts : compte ou mode local. Composants séparés plutôt
 * qu'un `return` anticipé : le profil compte lance des hooks (tour guidé…)
 * qu'on ne peut pas sauter conditionnellement sans faire planter React au
 * changement de mode.
 */
export default function ProfileScreen() {
  const { mode } = useAuth();
  return mode === "local" ? <LocalProfile /> : <AccountProfile />;
}

/**
 * Profil du mode local (docs/MODE_LOCAL.md § 3.2) : ni identité, ni amis,
 * ni sécurité de compte. Rappels (étape 4) et Mes données (étape 5) viendront
 * s'ajouter au menu.
 */
function LocalProfile() {
  const { leaveLocalMode } = useAuth();
  const { mode: themeMode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      countLocalDates()
        .then(setCount)
        .catch(() => setCount(null));
    }, []),
  );

  // Double confirmation : c'est la seule copie des données, sans serveur
  // pour la rattraper. On propose d'abord de faire une sauvegarde.
  const confirmErase = () => {
    Alert.alert(
      t("profile:erase.title"),
      t("profile:erase.text"),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        { text: t("profile:erase.backupFirst"), onPress: () => router.push("/profile/local-data") },
        {
          text: t("common:actions.continue"),
          style: "destructive",
          onPress: () =>
            Alert.alert(
              t("profile:erase.title2"),
              t("profile:erase.text2"),
              [
                { text: t("common:actions.cancel"), style: "cancel" },
                {
                  text: t("profile:erase.action"),
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await leaveLocalMode();
                      router.replace("/welcome");
                    } catch (e: any) {
                      Alert.alert(t("common:errors.title"), e?.message ?? t("profile:erase.error"));
                    }
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.localCard}>
        <Text style={styles.localTitle}>{t("home:localBadge.title")}</Text>
        <Text style={styles.localCount}>
          {count === null
            ? t("profile:local.noAccount")
            : tn("profile:local.noAccountCards", count)}
        </Text>
        <Text style={styles.localText}>
          {t("profile:local.text")}
        </Text>
      </View>

      <View style={styles.menu}>
        <MenuRow
          emoji="🎀"
          label={t("gifts:myWishlist")}
          onPress={() => router.push("/profile/wishlist")}
        />
        <MenuRow
          emoji="💾"
          label={t("profile:menu.localData")}
          onPress={() => router.push("/profile/local-data")}
        />
        <MenuRow
          emoji="🔔"
          label={t("profile:menu.reminders")}
          onPress={() => router.push("/profile/reminders")}
        />
        <MenuRow
          emoji="⚙️"
          label={t("profile:menu.settings")}
          onPress={() => router.push("/profile/settings")}
        />
      </View>

      <Text style={styles.sectionLabel}>{t("profile:menu.appearance")}</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map(({ v, l }) => (
          <Pressable
            key={v}
            style={[styles.themeChip, themeMode === v && styles.themeChipActive]}
            onPress={() => setMode(v)}
          >
            <Text
              style={[
                styles.themeChipText,
                themeMode === v && styles.themeChipTextActive,
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <LanguageChooser />

      <Text style={styles.sectionLabel}>{t("profile:menu.legalHelp")}</Text>
      <View style={styles.menu}>
        <MenuRow
          emoji="📖"
          label={t("profile:menu.guide")}
          onPress={() => router.push("/guide")}
        />
        <MenuRow
          emoji="📝"
          label={t("profile:menu.changelog")}
          onPress={() => router.push("/profile/changelog")}
        />
        {LEGAL_LINKS.map((l) => (
          <MenuRow
            key={l.url}
            emoji={l.emoji}
            label={l.label}
            onPress={() => Linking.openURL(l.url)}
          />
        ))}
      </View>

      {/* ⚠️ Étape 6 : proposer ici l'import des cartes locales dans le compte
          créé. D'ici là, le mode local reste réservé au dev (LOCAL_MODE_READY). */}
      <Pressable
        style={styles.accountBtn}
        onPress={() => router.push("/login?panel=signup")}
      >
        <Text style={styles.accountBtnText}>{t("auth:login.create")}</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.loginLink}>{t("profile:menu.haveAccount")}</Text>
      </Pressable>

      <Pressable onPress={confirmErase}>
        <Text style={styles.deleteText}>{t("profile:menu.eraseAll")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function AccountProfile() {
  const { user, signOut } = useAuth();
  // Cartes du mode sans compte pas encore importées (« Plus tard ») : accès
  // permanent à l'import, pour qu'elles ne restent pas oubliées sur le disque.
  const [hasLocal, setHasLocal] = useState(false);
  useFocusEffect(
    useCallback(() => {
      hasLocalDataToImport().then(setHasLocal).catch(() => setHasLocal(false));
    }, []),
  );
  const { mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { startTour } = useGuidedTour();
  const avatar = (user as { avatar?: string } | null)?.avatar;

  // Tour guidé détaillé du profil : première visite uniquement
  useEffect(() => {
    startTour(TOURS.profile);
  }, [startTour]);

  // Modifications faites hors ligne pas encore envoyées : elles seraient
  // perdues à la déconnexion (le cache du téléphone est vidé).
  const confirmSignOut = () => {
    const pending = pendingCount();
    if (pending === 0) {
      signOut();
      return;
    }
    Alert.alert(
      t("profile:logout.pendingTitle"),
      tn("profile:logout.pendingText", pending),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        { text: t("profile:logout.action"), style: "destructive", onPress: () => signOut() },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      t("profile:deleteAccount.title"),
      t("profile:deleteAccount.text"),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("profile:deleteAccount.action"),
          style: "destructive",
          onPress: async () => {
            try {
              if (user?._id) await deleteAccount(user._id);
              await signOut();
            } catch (e: any) {
              Alert.alert(t("common:errors.title"), e?.message ?? t("chat:list.removeError"));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {avatar ? (
        <ExpoImage
          source={{ uri: avatar }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.initials}>
            {user?.name?.[0]?.toUpperCase()}
            {user?.surname?.[0]?.toUpperCase()}
          </Text>
        </View>
      )}
      <Text style={styles.name}>
        {user?.name} {user?.surname}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.menu}>
        {hasLocal && (
          <MenuRow
            emoji="📱"
            label={t("profile:menu.importLocal")}
            onPress={() => router.push("/local-import")}
          />
        )}
        <TourTarget id="tourFriends">
          <MenuRow
            emoji="👥"
            label={t("profile:menu.friends")}
            onPress={() => router.push("/friends")}
          />
        </TourTarget>
        <MenuRow
          emoji="✏️"
          label={t("profile:menu.info")}
          onPress={() => router.push("/profile/edit")}
        />
        <TourTarget id="tourNotifs">
          <MenuRow
            emoji="🔔"
            label={t("events:notifs.short")}
            onPress={() => router.push("/profile/notifications")}
          />
        </TourTarget>
        <TourTarget id="tourWishlist">
          <MenuRow
            emoji="🎀"
            label={t("gifts:wishlist.title")}
            onPress={() => router.push("/profile/wishlist")}
          />
        </TourTarget>
        {/* ⚠️ Point d'entrée permanent vers les listes communes. L'écran
            n'était atteignable QUE depuis une notification : une invitation
            fermée par erreur, ou une liste partagée dont on n'a pas terminé le
            rattachement, devenaient définitivement introuvables. Une action en
            attente ne doit jamais dépendre d'un message éphémère. */}
        <MenuRow
          emoji="👨‍👩‍👧"
          label={t("gifts:invites.title")}
          onPress={() => router.push("/shared-invites")}
        />
        {/* ⚠️ Trace des sommes versées. En charges directes l'argent part chez
            l'organisateur et l'app n'en gardait aucune vue côté contributeur :
            montant, date et référence disparaissaient dès l'écran fermé. C'est
            pourtant ce qu'il faut produire pour réclamer un remboursement : à
            quelqu'un qui n'est pas nous. */}
        <MenuRow
          emoji="💝"
          label={t("pool:mine.title")}
          onPress={() => router.push("/profile/contributions")}
        />
        <MenuRow
          emoji="🔑"
          label={t("profile:menu.password")}
          onPress={() => router.push("/profile/password")}
        />
        <TourTarget id="tourE2E">
          <MenuRow
            emoji="🔐"
            label={t("profile:menu.e2e")}
            onPress={() => router.push("/profile/e2e")}
          />
        </TourTarget>
        <MenuRow
          emoji="🚫"
          label={t("profile:menu.blocked")}
          onPress={() => router.push("/profile/blocked")}
        />
        <MenuRow
          emoji="⚙️"
          label={t("profile:menu.settings")}
          onPress={() => router.push("/profile/settings")}
        />
        <MenuRow
          emoji="💾"
          label={t("profile:menu.backup")}
          onPress={() => router.push("/profile/backup")}
        />
        <MenuRow
          emoji="📄"
          label={t("profile:menu.export")}
          onPress={() => router.push("/profile/data-export")}
        />
      </View>

      {/* ── Apparence ── */}
      <Text style={styles.sectionLabel}>{t("profile:menu.appearance")}</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map(({ v, l }) => (
          <Pressable
            key={v}
            style={[styles.themeChip, mode === v && styles.themeChipActive]}
            onPress={() => setMode(v)}
          >
            <Text
              style={[
                styles.themeChipText,
                mode === v && styles.themeChipTextActive,
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <LanguageChooser />

      <Text style={styles.sectionLabel}>{t("profile:menu.legalSupport")}</Text>
      <View style={styles.menu}>
        <MenuRow
          emoji="📖"
          label={t("profile:menu.guide")}
          onPress={() => router.push("/guide")}
        />
        <MenuRow
          emoji="📝"
          label={t("profile:menu.changelog")}
          onPress={() => router.push("/profile/changelog")}
        />
        {LEGAL_LINKS.map((l) => (
          <MenuRow
            key={l.url}
            emoji={l.emoji}
            label={l.label}
            onPress={() => Linking.openURL(l.url)}
          />
        ))}
      </View>

      <Pressable style={styles.logout} onPress={confirmSignOut}>
        <Text style={styles.logoutText}>{t("profile:logout.action")}</Text>
      </Pressable>

      <Pressable onPress={confirmDelete}>
        <Text style={styles.deleteText}>{t("profile:deleteAccount.action")}</Text>
      </Pressable>

      <Pressable
        style={styles.contactBtn}
        onPress={() => router.push("/contact")}
      >
        <Text style={styles.contactBtnText}>{t("profile:menu.contact")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { alignItems: "center", padding: 24, gap: 6, paddingBottom: 48, ...readingPane },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primarySoft,
      justifyContent: "center",
      alignItems: "center",
    },
    initials: { fontSize: 30, fontWeight: "700", color: c.primary },
    name: { fontSize: 22, fontWeight: "700", color: c.text, marginTop: 8 },
    email: { color: c.sub },
    menu: {
      alignSelf: "stretch",
      backgroundColor: c.card,
      borderRadius: 14,
      marginTop: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionLabel: {
      alignSelf: "flex-start",
      color: c.sub,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: -8,
    },
    themeRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      gap: 8,
      marginTop: 20,
    },
    themeChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: c.card,
    },
    themeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeChipText: { fontSize: 13, fontWeight: "600", color: c.sub },
    themeChipTextActive: { color: c.white },
    languageHint: {
      fontSize: 12,
      color: c.faint,
      marginHorizontal: 16,
      marginTop: 6,
      lineHeight: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowEmoji: { fontSize: 18 },
    rowLabel: { flex: 1, fontSize: 15, color: c.text, fontWeight: "500" },
    chevron: { fontSize: 20, color: c.faint },
    logout: {
      marginTop: 28,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 28,
    },
    logoutText: { color: c.danger, fontWeight: "600" },
    deleteText: {
      color: c.faint,
      fontSize: 12,
      textDecorationLine: "underline",
      marginTop: 16,
    },
    contactBtn: {
      marginTop: 24,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    contactBtnText: { color: c.primary, fontWeight: "600" },
    // Mode local
    localCard: {
      alignSelf: "stretch",
      backgroundColor: c.primarySoft,
      borderRadius: 14,
      padding: 16,
      gap: 4,
    },
    localTitle: { fontSize: 18, fontWeight: "700", color: c.text },
    localCount: { fontSize: 14, fontWeight: "600", color: c.primaryStrong },
    localText: { fontSize: 13.5, color: c.sub, lineHeight: 19, marginTop: 4 },
    accountBtn: {
      alignSelf: "stretch",
      marginTop: 28,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    accountBtnText: { color: c.white, fontWeight: "700", fontSize: 15 },
    loginLink: { color: c.primary, fontSize: 14, marginTop: 14 },
  });

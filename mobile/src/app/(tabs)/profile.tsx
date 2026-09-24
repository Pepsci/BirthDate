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

const SITE = "https://birthreminder.com";
const LEGAL_LINKS: { emoji: string; label: string; url: string }[] = [
  { emoji: "📄", label: "Conditions d'utilisation (CGU)", url: `${SITE}/cgu` },
  { emoji: "🔒", label: "Politique de confidentialité", url: `${SITE}/privacy` },
  { emoji: "🍪", label: "Cookies", url: `${SITE}/cookies` },
  { emoji: "⚖️", label: "Mentions légales", url: `${SITE}/mentions-legales` },
];

const THEME_OPTIONS: { v: ThemeMode; l: string }[] = [
  { v: "system", l: "⚙️ Système" },
  { v: "light", l: "☀️ Clair" },
  { v: "dark", l: "🌙 Sombre" },
];

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
      "Effacer toutes tes données ?",
      "Tes cartes, idées de cadeaux, photos et ta liste d'envies seront " +
        "supprimées de ce téléphone. Fais une sauvegarde avant si tu veux " +
        "pouvoir les retrouver.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Sauvegarder d'abord", onPress: () => router.push("/profile/local-data") },
        {
          text: "Continuer",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Vraiment tout effacer ?",
              "C'est définitif : sans compte, rien n'est sauvegardé ailleurs.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Tout effacer",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await leaveLocalMode();
                      router.replace("/welcome");
                    } catch (e: any) {
                      Alert.alert("Erreur", e?.message ?? "Effacement impossible.");
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
        <Text style={styles.localTitle}>📱 Sur ce téléphone</Text>
        <Text style={styles.localCount}>
          {count === null
            ? "Sans compte"
            : `Sans compte · ${count} carte${count > 1 ? "s" : ""}`}
        </Text>
        <Text style={styles.localText}>
          Tes données restent sur ce téléphone, rien n'est envoyé. Pas de chat,
          d'amis ni d'événements.
        </Text>
      </View>

      <View style={styles.menu}>
        <MenuRow
          emoji="🎀"
          label="Ma liste d'envies"
          onPress={() => router.push("/profile/wishlist")}
        />
        <MenuRow
          emoji="💾"
          label="Mes données (sauvegarde)"
          onPress={() => router.push("/profile/local-data")}
        />
        <MenuRow
          emoji="🔔"
          label="Rappels"
          onPress={() => router.push("/profile/reminders")}
        />
        <MenuRow
          emoji="⚙️"
          label="Réglages"
          onPress={() => router.push("/profile/settings")}
        />
      </View>

      <Text style={styles.sectionLabel}>Apparence</Text>
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

      <Text style={styles.sectionLabel}>Légal & aide</Text>
      <View style={styles.menu}>
        <MenuRow
          emoji="📖"
          label="Guide d'utilisation"
          onPress={() => router.push("/guide")}
        />
        <MenuRow
          emoji="📝"
          label="Notes de mise à jour"
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
        <Text style={styles.accountBtnText}>Créer un compte</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/login")}>
        <Text style={styles.loginLink}>J'ai déjà un compte</Text>
      </Pressable>

      <Pressable onPress={confirmErase}>
        <Text style={styles.deleteText}>Effacer toutes mes données</Text>
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

  // Tour guidé détaillé du profil — première visite uniquement
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
      "Modifications non envoyées",
      `${pending} modification${pending > 1 ? "s" : ""} faite${pending > 1 ? "s" : ""} hors ligne n'${pending > 1 ? "ont" : "a"} pas encore été envoyée${pending > 1 ? "s" : ""}. Si tu te déconnectes maintenant, ${pending > 1 ? "elles seront perdues" : "elle sera perdue"}.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: () => signOut() },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer ton compte ?",
      "Ton compte sera désactivé puis définitivement supprimé. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer mon compte",
          style: "destructive",
          onPress: async () => {
            try {
              if (user?._id) await deleteAccount(user._id);
              await signOut();
            } catch (e: any) {
              Alert.alert("Erreur", e?.message ?? "Suppression impossible.");
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
            label="Importer mes cartes du mode sans compte"
            onPress={() => router.push("/local-import")}
          />
        )}
        <TourTarget id="tourFriends">
          <MenuRow
            emoji="👥"
            label="Mes amis"
            onPress={() => router.push("/friends")}
          />
        </TourTarget>
        <MenuRow
          emoji="✏️"
          label="Mes informations"
          onPress={() => router.push("/profile/edit")}
        />
        <TourTarget id="tourNotifs">
          <MenuRow
            emoji="🔔"
            label="Notifications"
            onPress={() => router.push("/profile/notifications")}
          />
        </TourTarget>
        <TourTarget id="tourWishlist">
          <MenuRow
            emoji="🎀"
            label="Ma wishlist"
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
          label="Listes communes"
          onPress={() => router.push("/shared-invites")}
        />
        {/* ⚠️ Trace des sommes versées. En charges directes l'argent part chez
            l'organisateur et l'app n'en gardait aucune vue côté contributeur :
            montant, date et référence disparaissaient dès l'écran fermé. C'est
            pourtant ce qu'il faut produire pour réclamer un remboursement — à
            quelqu'un qui n'est pas nous. */}
        <MenuRow
          emoji="💝"
          label="Mes contributions"
          onPress={() => router.push("/profile/contributions")}
        />
        <MenuRow
          emoji="🔑"
          label="Changer mon mot de passe"
          onPress={() => router.push("/profile/password")}
        />
        <TourTarget id="tourE2E">
          <MenuRow
            emoji="🔐"
            label="Chiffrement & sécurité"
            onPress={() => router.push("/profile/e2e")}
          />
        </TourTarget>
        <MenuRow
          emoji="🚫"
          label="Utilisateurs bloqués"
          onPress={() => router.push("/profile/blocked")}
        />
        <MenuRow
          emoji="⚙️"
          label="Réglages"
          onPress={() => router.push("/profile/settings")}
        />
        <MenuRow
          emoji="💾"
          label="Sauvegarde"
          onPress={() => router.push("/profile/backup")}
        />
        <MenuRow
          emoji="📄"
          label="Télécharger mes données"
          onPress={() => router.push("/profile/data-export")}
        />
      </View>

      {/* ── Apparence ── */}
      <Text style={styles.sectionLabel}>Apparence</Text>
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

      <Text style={styles.sectionLabel}>Légal & support</Text>
      <View style={styles.menu}>
        <MenuRow
          emoji="📖"
          label="Guide d'utilisation"
          onPress={() => router.push("/guide")}
        />
        <MenuRow
          emoji="📝"
          label="Notes de mise à jour"
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
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>

      <Pressable onPress={confirmDelete}>
        <Text style={styles.deleteText}>Supprimer mon compte</Text>
      </Pressable>

      <Pressable
        style={styles.contactBtn}
        onPress={() => router.push("/contact")}
      >
        <Text style={styles.contactBtnText}>✉️ Contacter le support</Text>
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

import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

interface QA {
  q: string;
  a: string;
}
interface Section {
  emoji: string;
  title: string;
  items: QA[];
}

const SECTIONS: Section[] = [
  {
    emoji: "🎂",
    title: "Ajouter une date",
    items: [
      {
        q: "Comment ajouter un anniversaire ?",
        a: "Depuis l'onglet Anniversaires, appuie sur le bouton ＋ en haut à droite. Renseigne un prénom, une date et éventuellement la relation (famille, ami…).",
      },
      {
        q: "Comment modifier ou supprimer une date ?",
        a: "Appuie sur une carte pour ouvrir sa fiche. Pour une date manuelle, tu y trouveras les options de modification et de suppression.",
      },
      {
        q: "Les anniversaires de mes amis s'ajoutent-ils tout seuls ?",
        a: "Oui ! Dès qu'un ami accepte ta demande, son anniversaire apparaît automatiquement dans ta liste avec un badge AMI.",
      },
    ],
  },
  {
    emoji: "👥",
    title: "Amis & demandes",
    items: [
      {
        q: "Comment ajouter un ami ?",
        a: "Va dans l'onglet Profil → Mes amis. Recherche une personne par son email et envoie-lui une demande.",
      },
      {
        q: "Où voir mes demandes reçues ?",
        a: "Un badge rouge sur la cloche 🔔 (en haut) t'indique les demandes en attente. Ouvre Profil → Mes amis → onglet Reçues.",
      },
      {
        q: "Puis-je ouvrir la fiche d'un ami ?",
        a: "Oui, appuie sur son nom dans Mes amis, ou sur sa carte depuis l'accueil.",
      },
    ],
  },
  {
    emoji: "🎁",
    title: "Wishlist & cadeaux",
    items: [
      {
        q: "Comment créer ma liste de souhaits ?",
        a: "Va dans Profil → Ma wishlist et ajoute tes envies (titre, prix, lien du produit).",
      },
      {
        q: "Comment voir la wishlist d'un ami ?",
        a: "Ouvre sa carte → bouton Voir les cadeaux → onglet « Sa wishlist ».",
      },
      {
        q: "Comment réserver un cadeau ?",
        a: "Dans la wishlist d'un ami, appuie sur un cadeau disponible puis « Je réserve ». Les cadeaux déjà réservés par d'autres sont masqués.",
      },
      {
        q: "Comment gérer mes idées cadeaux pour quelqu'un ?",
        a: "Sur sa carte → Voir les cadeaux → « Mes idées ». Tu peux ajouter, filtrer par occasion et changer le statut (À acheter, Acheté, À offrir, Offert).",
      },
    ],
  },
  {
    emoji: "🎉",
    title: "Événements",
    items: [
      {
        q: "Comment créer un événement ?",
        a: "Onglet Événements → ＋, ou depuis la carte d'une personne → Organiser un événement.",
      },
      {
        q: "Comment inviter du monde ?",
        a: "Sur la page de l'événement : « Inviter mes amis » (depuis ta liste) ou « Partager le lien + code ». Les invités peuvent aussi inviter si tu l'autorises.",
      },
      {
        q: "À quoi sert la sélection de cadeaux ?",
        a: "En tant qu'organisateur, tu peux « Retenir » un ou plusieurs cadeaux proposés ; ils sont marqués ⭐ pour tout le monde.",
      },
      {
        q: "Comment fonctionne la cagnotte ?",
        a: "L'organisateur peut ouvrir une cagnotte en connectant son compte Stripe (paiements sécurisés). Les invités peuvent ensuite participer directement depuis la page de l'événement, et chacun voit le total collecté.",
      },
    ],
  },
  {
    emoji: "🔔",
    title: "Notifications",
    items: [
      {
        q: "Comment gérer les rappels par email ?",
        a: "Profil → Notifications email. Choisis d'être rappelé 30, 14, 7, 3, 1 jour(s) avant, ou le jour J.",
      },
      {
        q: "Les notifications push sont-elles natives ?",
        a: "Oui. Accepte la permission de notifications au lancement de l'app. Tu peux régler les rappels par date depuis la fiche d'une personne.",
      },
      {
        q: "Les messages sont-ils lisibles dans les notifs ?",
        a: "Les messages sont chiffrés de bout en bout et déchiffrés sur ton téléphone : le texte s'affiche directement dans la notification, comme sur WhatsApp.",
      },
    ],
  },
  {
    emoji: "⚙️",
    title: "Mon compte",
    items: [
      {
        q: "Comment modifier mes informations ?",
        a: "Profil → Mes informations (prénom, nom, date de naissance, avatar).",
      },
      {
        q: "Comment changer mon mot de passe ?",
        a: "Profil → Changer mon mot de passe. Ton mot de passe actuel te sera demandé.",
      },
      {
        q: "Comment supprimer mon compte ?",
        a: "Profil → tout en bas → Supprimer mon compte. Conforme au RGPD : tes données sont supprimées/anonymisées.",
      },
    ],
  },
];

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
        <View key={section.title} style={styles.section}>
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
          onPress={() => router.push("/support")}
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

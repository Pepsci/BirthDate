import { t } from "@/i18n";
import { ReactNode, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Linking } from "react-native";
import {
  SharedGiftList,
  SharedGiftProposal,
  proposeSharedGift,
  withdrawSharedProposal,
  decideSharedProposal,
} from "../lib/sharedGifts";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { isLocalMode } from "../lib/app-mode";
import { occasionEmoji, occasionLabel } from "../lib/occasions";
import GiftGridCard, { GiftBadge, giftGridStyles } from "./GiftGridCard";
import GiftIdeaForm from "./GiftIdeaForm";

type Status = "pending" | "accepted" | "declined";

const statusOf = (p: SharedGiftProposal): Status => p.status ?? "pending";

/** Temps laissé pour annuler un effacement. */
const UNDO_DELAY_MS = 6000;

/**
 * Bloc repliable : un titre avec le nombre d'éléments, qu'on touche pour
 * ouvrir ou fermer son contenu.
 */
function Section({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
      >
        <Text style={styles.toggleText}>
          {title} ({count})
        </Text>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open && children}
    </View>
  );
}

/**
 * Propositions d'idées sur une liste commune.
 *
 * Deux visages selon le rôle (`list.myRole`) :
 *   - invité : un bouton « Proposer une idée », le même formulaire que pour
 *     une idée cadeau (lien, récupération auto, image), et SES propositions
 *     avec leur état (en attente, acceptée, non retenue) ;
 *   - gestionnaire : les propositions à examiner, avec Accepter / Refuser,
 *     puis celles déjà traitées.
 *
 * Les propositions traitées restent affichées : c'est ce qui permet de
 * retrouver une réponse quand la notification a été effacée sans être lue.
 *
 * Les cartes sont des GiftGridCard, comme les autres idées cadeaux.
 * Le serveur ne renvoie à chacun que ce qu'il a le droit de voir : ce
 * composant n'a rien à filtrer. Chaque action renvoie la liste à jour,
 * remontée par `onChange`.
 *
 * Mode sans compte : les listes communes n'existent pas, on n'affiche rien.
 */
export default function SharedProposals({
  list,
  onChange,
  onError,
}: {
  list: SharedGiftList;
  onChange: (next: SharedGiftList) => void;
  onError: (message: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Un invité qui n'a encore rien proposé ouvre ce panneau pour proposer :
  // on lui montre directement le formulaire.
  const [formOpen, setFormOpen] = useState(
    list.myRole === "viewer" && (list.proposals ?? []).length === 0,
  );
  const [busy, setBusy] = useState(false);

  // ── Effacer avec délai d'annulation ───────────────────────────────────────
  // La carte disparaît tout de suite, mais rien n'est envoyé au serveur avant
  // UNDO_DELAY_MS : pendant ce temps, « Annuler » la fait revenir. Une seule
  // carte à la fois ; en effacer une autre valide la précédente.
  const [removing, setRemoving] = useState<SharedGiftProposal | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removingRef = useRef<SharedGiftProposal | null>(null);
  removingRef.current = removing;
  const listId = list._id;

  // Si on quitte l'écran pendant le délai, l'effacement demandé est envoyé.
  useEffect(
    () => () => {
      if (removeTimer.current) clearTimeout(removeTimer.current);
      if (removingRef.current) {
        withdrawSharedProposal(listId, removingRef.current._id).catch(() => {});
      }
    },
    [listId],
  );

  if (isLocalMode()) return null;

  const isMember = (list.myRole ?? "member") === "member";
  // La carte en cours d'effacement est déjà retirée de l'affichage.
  const proposals = (list.proposals ?? []).filter(
    (p) => p._id !== removing?._id,
  );
  const pending = proposals.filter((p) => statusOf(p) === "pending");
  const decided = proposals
    .filter((p) => statusOf(p) !== "pending")
    .sort(
      (a, b) =>
        new Date(b.decidedAt ?? 0).getTime() -
        new Date(a.decidedAt ?? 0).getTime(),
    );

  /** Lance un appel, remonte la liste à jour ou le message d'erreur. */
  const run = async (fn: () => Promise<SharedGiftList>) => {
    if (busy) return false;
    setBusy(true);
    try {
      onChange(await fn());
      return true;
    } catch (e: any) {
      onError(e?.message ?? t("common:errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askRemove = (p: SharedGiftProposal) => {
    if (removeTimer.current) clearTimeout(removeTimer.current);
    // Une autre carte attendait : on la valide sans passer par `run`, qui
    // refuserait un second appel tant que le premier n'est pas fini.
    if (removingRef.current) {
      withdrawSharedProposal(listId, removingRef.current._id).catch(() => {});
    }
    setRemoving(p);
    removeTimer.current = setTimeout(() => {
      setRemoving(null);
      run(() => withdrawSharedProposal(listId, p._id));
    }, UNDO_DELAY_MS);
  };

  const undoRemove = () => {
    if (removeTimer.current) clearTimeout(removeTimer.current);
    setRemoving(null);
  };

  const badgeFor = (p: SharedGiftProposal): GiftBadge => {
    const status = statusOf(p);
    const label = t(`date:proposals.status.${status}`);
    if (status === "accepted")
      return { label, color: colors.successStrong, bg: colors.successSoft };
    if (status === "declined")
      return { label, color: colors.danger, bg: colors.dangerSoft };
    return { label, color: colors.warningStrong, bg: colors.warningSoft };
  };

  const proposerName = (p: SharedGiftProposal) =>
    `${p.proposedBy?.name ?? ""} ${p.proposedBy?.surname ?? ""}`.trim() ||
    t("date:proposals.someone");

  const confirmDecline = (p: SharedGiftProposal) =>
    Alert.alert(
      t("date:proposals.declineTitle"),
      t("date:proposals.declineText", {
        name: proposerName(p),
        gift: p.giftName,
      }),
      [
        { text: t("common:actions.cancel"), style: "cancel" },
        {
          text: t("date:proposals.decline"),
          style: "destructive",
          onPress: () => {
            run(() => decideSharedProposal(list._id, p._id, "decline"));
          },
        },
      ],
    );

  /** Une proposition, dans la forme d'une carte d'idée cadeau. */
  const card = (
    p: SharedGiftProposal,
    options: { showBadge: boolean; showAuthor: boolean; actions?: ReactNode },
  ) => (
    <GiftGridCard
      key={p._id}
      imageUri={p.image}
      placeholderEmoji={occasionEmoji(p.occasion)}
      title={p.giftName}
      lines={[
        `${occasionEmoji(p.occasion)} ${occasionLabel(p.occasion)}`,
        ...(options.showAuthor
          ? [t("date:proposals.by", { name: proposerName(p) })]
          : []),
      ]}
      price={p.price}
      badge={options.showBadge ? badgeFor(p) : null}
      // Contour selon la réponse : vert acceptée, rouge non retenue.
      accentColor={
        !options.showBadge || statusOf(p) === "pending"
          ? undefined
          : statusOf(p) === "accepted"
            ? colors.success
            : colors.danger
      }
      // Toucher la carte ouvre le lien du produit, s'il y en a un.
      onPress={p.url ? () => Linking.openURL(p.url!) : undefined}
    >
      {options.actions}
    </GiftGridCard>
  );

  // ── Gestionnaire ──────────────────────────────────────────────────────────
  if (isMember) {
    return (
      <View style={styles.box}>
        {proposals.length === 0 && (
          <Text style={styles.empty}>{t("date:proposals.empty")}</Text>
        )}
        {pending.length > 0 && (
          <Section
            title={t("date:proposals.pendingTitle")}
            count={pending.length}
            defaultOpen
          >
            <View style={giftGridStyles.grid}>
              {pending.map((p) =>
                card(p, {
                  showBadge: false,
                  showAuthor: true,
                  actions: (
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.btn, styles.btnPrimary]}
                        disabled={busy}
                        onPress={() =>
                          run(() =>
                            decideSharedProposal(list._id, p._id, "accept"),
                          )
                        }
                      >
                        <Text style={styles.btnPrimaryText}>
                          {t("date:proposals.accept")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.btn}
                        disabled={busy}
                        onPress={() => confirmDecline(p)}
                      >
                        <Text style={styles.btnText}>
                          {t("date:proposals.decline")}
                        </Text>
                      </Pressable>
                    </View>
                  ),
                }),
              )}
            </View>
          </Section>
        )}

        {decided.length > 0 && (
          <Section
            title={t("date:proposals.handledTitle")}
            count={decided.length}
            defaultOpen={false}
          >
            <View style={giftGridStyles.grid}>
              {decided.map((p) =>
                card(p, { showBadge: true, showAuthor: true }),
              )}
            </View>
          </Section>
        )}
      </View>
    );
  }

  // ── Invité ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.box}>
      {!formOpen ? (
        <Pressable style={styles.proposeBtn} onPress={() => setFormOpen(true)}>
          <Text style={styles.proposeBtnText}>
            {t("date:proposals.proposeBtn")}
          </Text>
        </Pressable>
      ) : (
        <GiftIdeaForm
          busy={busy}
          title={t("date:proposals.formTitle")}
          submitLabel={t("date:proposals.send")}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (gift) => {
            const ok = await run(() => proposeSharedGift(list._id, gift));
            if (ok) setFormOpen(false);
          }}
        />
      )}

      {removing && (
        <View style={styles.undo}>
          <Text style={styles.undoText} numberOfLines={1}>
            {statusOf(removing) === "pending"
              ? t("date:proposals.withdrawn", { gift: removing.giftName })
              : t("date:proposals.erased", { gift: removing.giftName })}
          </Text>
          <Pressable onPress={undoRemove} hitSlop={10}>
            <Text style={styles.undoBtn}>{t("common:actions.cancel")}</Text>
          </Pressable>
        </View>
      )}

      {proposals.length > 0 && (
        <Section
          title={t("date:proposals.mineTitle")}
          count={proposals.length}
          defaultOpen
        >
          <View style={giftGridStyles.grid}>
            {[...pending, ...decided].map((p) =>
              card(p, {
                showBadge: true,
                showAuthor: false,
                actions: (
                  <Pressable
                    style={styles.btn}
                    disabled={busy}
                    onPress={() => askRemove(p)}
                  >
                    <Text style={styles.btnText}>
                      {statusOf(p) === "pending"
                        ? t("date:proposals.withdraw")
                        : t("date:proposals.erase")}
                    </Text>
                  </Pressable>
                ),
              }),
            )}
          </View>
        </Section>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardSoft,
      gap: 12,
    },
    section: { gap: 10 },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleText: { fontSize: 15, fontWeight: "700", color: c.text, flex: 1 },
    chevron: { fontSize: 14, color: c.sub, marginLeft: 8 },
    actions: { gap: 6 },
    btn: {
      marginTop: 4,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: "center",
    },
    btnText: { fontSize: 13, fontWeight: "600", color: c.text },
    btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
    btnPrimaryText: { fontSize: 13, fontWeight: "600", color: "#fff" },
    empty: { fontSize: 13, color: c.sub, textAlign: "center" },
    undo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgSecondary,
    },
    undoText: { flex: 1, fontSize: 14, color: c.text },
    undoBtn: { fontSize: 14, fontWeight: "700", color: c.primary },
    proposeBtn: { paddingVertical: 4, alignItems: "center" },
    proposeBtnText: { fontSize: 15, fontWeight: "600", color: c.primary },
  });

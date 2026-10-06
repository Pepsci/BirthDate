import { getLocaleTag, t } from "@/i18n";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  EventType,
  EventDetail,
  CreateEventPayload,
  formatEventDate,
  EVENT_TYPE_LABELS,
} from "../lib/events";
import AddressAutocomplete, { LocationValue } from "./AddressAutocomplete";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";
import { formPane } from "../lib/layout";
import { useAuth } from "../lib/auth-context";

/** Pourquoi la cagnotte est indisponible (raison renvoyée par le serveur). */
const POOL_LOCK_HINTS: Record<string, string> = {
  get minor() { return t("pool:lock.minor"); },
  get birthdate_missing() { return t("pool:lock.birthdate_missing"); },
  get birthdate_cooldown() { return t("pool:lock.birthdate_cooldown"); },
  get admin_blocked() { return t("pool:lock.admin_blocked"); },
};

function initialLocation(ev?: EventDetail): LocationValue | null {
  if (!ev?.fixedLocation) return null;
  if (typeof ev.fixedLocation === "string") return { name: ev.fixedLocation };
  return {
    name: ev.fixedLocation.name ?? ev.fixedLocation.address ?? "",
    address: ev.fixedLocation.address,
  };
}

const STEPS = ["essential", "date", "place", "gifts", "pool", "invite"] as const;

/**
 * Photographie de l'état du formulaire, tenue à jour à chaque render.
 *
 * L'écran parent la lit dans son cleanup de démontage : si l'utilisateur
 * quitte le stepper sans valider alors qu'il avait déjà saisi un titre, le
 * travail est enregistré en brouillon plutôt que perdu.
 */
export interface EventFormSnapshot {
  payload: CreateEventPayload;
  /** Titre renseigné → il y a de quoi faire un brouillon exploitable */
  hasContent: boolean;
  /** Formulaire déjà validé : le parent n'a rien à sauvegarder */
  submitted: boolean;
}

export default function EventFormStepper({
  initial,
  prefillName,
  isBirthday,
  submitLabel,
  onSubmit,
  snapshotRef,
}: {
  initial?: EventDetail;
  prefillName?: string;
  isBirthday?: boolean;
  submitLabel: string;
  onSubmit: (payload: CreateEventPayload) => Promise<void>;
  snapshotRef?: MutableRefObject<EventFormSnapshot | null>;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors, resolved } = useTheme();
  const [step, setStep] = useState(0);
  // Étape la plus loin atteinte → permet de revenir sur n'importe quelle
  // étape déjà visitée (en édition, toutes sont accessibles d'emblée).
  const [maxReached, setMaxReached] = useState(initial ? STEPS.length - 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const goStep = (i: number) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
  };

  // Étape 1 — essentiel
  const [type, setType] = useState<EventType>(
    initial?.type ?? (isBirthday ? "birthday" : "party"),
  );
  const [title, setTitle] = useState(
    initial?.title ?? (prefillName ? t("events:form.birthdayOf", { name: prefillName }) : ""),
  );
  const [description, setDescription] = useState(initial?.description ?? "");

  // Étape 2 — date
  const [dateMode, setDateMode] = useState<"fixed" | "vote">(
    initial?.dateMode ?? "fixed",
  );
  const [fixedDate, setFixedDate] = useState<Date>(() => {
    if (initial?.fixedDate) return new Date(initial.fixedDate);
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return d;
  });
  const [showDate, setShowDate] = useState(Platform.OS === "ios");
  const [showTime, setShowTime] = useState(Platform.OS === "ios");
  const [dateOptions, setDateOptions] = useState<Date[]>(
    (initial?.dateOptions ?? []).map((d) => new Date(d)),
  );
  const [showOptionPicker, setShowOptionPicker] = useState(false);
  const [optionDraft, setOptionDraft] = useState<Date>(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return d;
  });

  // Étape 3 — lieu
  const [locationMode, setLocationMode] = useState<"fixed" | "vote">(
    initial?.locationMode ?? "fixed",
  );
  const [fixedLocation, setFixedLocation] = useState<LocationValue | null>(
    initialLocation(initial),
  );
  const [locationOptions, setLocationOptions] = useState<LocationValue[]>(
    (initial?.locationOptions ?? []).map((l) => ({
      name: l.name ?? l.address ?? "",
      address: l.address,
    })),
  );
  const [pendingLoc, setPendingLoc] = useState<LocationValue | null>(null);
  const [locKey, setLocKey] = useState(0); // reset de l'autocomplete après ajout

  // Étape 4 — cadeaux
  const [giftMode, setGiftMode] = useState<"imposed" | "proposals" | "none">(
    initial?.giftMode ?? "proposals",
  );
  const [imposedGifts, setImposedGifts] = useState<
    { name: string; price?: number }[]
  >(initial?.imposedGifts ?? []);
  const [giftName, setGiftName] = useState("");
  const [giftPrice, setGiftPrice] = useState("");

  // Étape 5 — cagnotte (finalisée après création)
  // Cagnotte réservée aux 18 ans et plus (le serveur bloque aussi).
  const { user } = useAuth();
  const poolLocked = user?.canCreatePool === false;
  const [poolEnabled, setPoolEnabled] = useState(
    initial?.giftPoolEnabled ?? false,
  );
  const [wantIban, setWantIban] = useState(
    initial?.directTransfer?.ibanEnabled ?? false,
  );
  const [wantPaypal, setWantPaypal] = useState(
    initial?.directTransfer?.paypalEnabled ?? false,
  );

  // Étape 6 — invitation
  const [maxGuests, setMaxGuests] = useState(
    initial?.maxGuests ? String(initial.maxGuests) : "",
  );
  const [allowExternalGuests, setAllowExternalGuests] = useState(
    initial?.allowExternalGuests ?? true,
  );
  const [allowGuestInvites, setAllowGuestInvites] = useState(
    // Création : coché par défaut. Modification : la valeur de l'événement.
    initial ? initial.allowGuestInvites === true : true,
  );

  const canNext = () => {
    if (step === 0) return !!title.trim();
    if (step === 1) return dateMode === "fixed" || dateOptions.length >= 2;
    if (step === 2)
      return locationMode === "fixed" || locationOptions.length >= 2;
    if (step === 3)
      return (
        giftMode === "proposals" ||
        giftMode === "none" ||
        imposedGifts.length > 0
      );
    return true;
  };

  /** État courant du formulaire au format attendu par l'API. */
  const buildPayload = (): CreateEventPayload => ({
    title: title.trim(),
    description: description.trim() || undefined,
    type,
    dateMode,
    fixedDate: dateMode === "fixed" ? fixedDate.toISOString() : undefined,
    dateOptions:
      dateMode === "vote" ? dateOptions.map((d) => d.toISOString()) : undefined,
    locationMode,
    fixedLocation:
      locationMode === "fixed" ? fixedLocation ?? undefined : undefined,
    locationOptions: locationMode === "vote" ? locationOptions : undefined,
    giftMode,
    imposedGifts: giftMode === "imposed" ? imposedGifts : undefined,
    // Pas de cadeaux → pas de cagnotte.
    giftPoolEnabled: giftMode === "none" || poolLocked ? false : poolEnabled,
    maxGuests: maxGuests ? parseInt(maxGuests, 10) : null,
    allowExternalGuests,
    allowGuestInvites,
  });

  // Le formulaire a-t-il été validé ? En ref et non en state : c'est lu depuis
  // le cleanup de démontage du parent, après le dernier render.
  const submittedRef = useRef(false);

  // Snapshot rafraîchi après chaque render (pas de tableau de dépendances :
  // n'importe quel champ modifié doit être reflété).
  useEffect(() => {
    if (!snapshotRef) return;
    snapshotRef.current = {
      payload: buildPayload(),
      hasContent: !!title.trim(),
      submitted: submittedRef.current,
    };
  });

  const submit = async () => {
    setError(null);
    setSaving(true);
    // Marqué AVANT l'attente : onSubmit navigue lui-même, l'écran peut donc
    // se démonter avant la reprise du await. Sans ça, le parent croirait à un
    // abandon et créerait un brouillon en doublon de l'événement publié.
    submittedRef.current = true;
    if (snapshotRef?.current) snapshotRef.current.submitted = true;
    try {
      await onSubmit(buildPayload());
    } catch (e: any) {
      submittedRef.current = false;
      if (snapshotRef?.current) snapshotRef.current.submitted = false;
      setError(e?.message ?? t("events:form.createError"));
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {/* Progression */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s}
            style={styles.progressItem}
            onPress={() => i <= maxReached && setStep(i)}
          >
            <View
              style={[
                styles.progressDot,
                i === step && styles.progressDotActive,
                i < step && styles.progressDotDone,
              ]}
            >
              <Text
                style={[
                  styles.progressNum,
                  (i === step || i < step) && { color: colors.white },
                ]}
              >
                {i < step ? "✓" : i + 1}
              </Text>
            </View>
            <Text style={styles.progressLabel}>{t(`events:form.steps.${s}`)}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* ÉTAPE 1 — Essentiel */}
      {step === 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("events:form.type")}</Text>
          <View style={styles.chips}>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text
                  style={[styles.chipText, type === t && styles.chipTextActive]}
                >
                  {EVENT_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t("events:form.title")}</Text>
          <TextInput placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder={t("events:form.titlePlaceholder")}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>{t("events:form.description")}</Text>
          <TextInput placeholderTextColor={colors.placeholder}
            style={[styles.input, { minHeight: 70 }]}
            placeholder={t("events:form.descPlaceholder")}
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>
      )}

      {/* ÉTAPE 2 — Date */}
      {step === 1 && (
        <View style={styles.card}>
          <ModeSwitch
            left={t("events:form.dateFixed")}
            right={t("events:form.vote")}
            value={dateMode === "vote"}
            onChange={(v) => setDateMode(v ? "vote" : "fixed")}
          />

          {dateMode === "fixed" ? (
            <>
              {Platform.OS === "android" && (
                <>
                  <Pressable style={styles.input} onPress={() => setShowDate(true)}>
                    <Text style={styles.inputText}>
                      {formatEventDate(fixedDate)}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.input} onPress={() => setShowTime(true)}>
                    <Text style={styles.inputText}>
                      {t("events:form.time")}{" "}
                      {fixedDate.toLocaleTimeString(getLocaleTag(), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Pressable>
                </>
              )}
              {showDate && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={fixedDate}
                    mode="date"
                    minimumDate={new Date()}
                    display="spinner"
                    locale={getLocaleTag()}
                    themeVariant={resolved}
                    onChange={(e, d) => {
                      if (Platform.OS === "android") setShowDate(false);
                      if (d)
                        setFixedDate(
                          new Date(
                            d.getFullYear(), d.getMonth(), d.getDate(),
                            fixedDate.getHours(), fixedDate.getMinutes(),
                          ),
                        );
                    }}
                  />
                </View>
              )}
              {showTime && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={fixedDate}
                    mode="time"
                    display="spinner"
                    locale={getLocaleTag()}
                    themeVariant={resolved}
                    onChange={(e, d) => {
                      if (Platform.OS === "android") setShowTime(false);
                      if (d)
                        setFixedDate(
                          new Date(
                            fixedDate.getFullYear(), fixedDate.getMonth(),
                            fixedDate.getDate(), d.getHours(), d.getMinutes(),
                          ),
                        );
                    }}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                {t("events:form.dateVoteHint")}
              </Text>
              {dateOptions.map((d, i) => (
                <View key={i} style={styles.optionRow}>
                  <Text style={styles.optionText}>{formatEventDate(d)}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setDateOptions(dateOptions.filter((_, j) => j !== i))
                    }
                  >
                    <Text style={styles.deleteX}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.addOptionBtn}
                onPress={() => {
                  const d = new Date();
                  d.setHours(19, 0, 0, 0);
                  setOptionDraft(d);
                  setShowOptionPicker(true);
                }}
              >
                <Text style={styles.addOptionText}>{t("events:form.addDate")}</Text>
              </Pressable>
              {showOptionPicker && (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={optionDraft}
                    mode="date"
                    minimumDate={new Date()}
                    display="spinner"
                    locale={getLocaleTag()}
                    themeVariant={resolved}
                    onChange={(e, d) => {
                      // Android : la boîte se ferme et valide sur "OK"/"Annuler".
                      // iOS : la roue émet onChange en continu → on met juste à
                      // jour le brouillon, la validation se fait via le bouton.
                      if (Platform.OS === "android") {
                        setShowOptionPicker(false);
                        if (d && e.type === "set") {
                          const day = new Date(
                            d.getFullYear(), d.getMonth(), d.getDate(), 19, 0,
                          );
                          setDateOptions([...dateOptions, day]);
                        }
                      } else if (d) {
                        setOptionDraft(d);
                      }
                    }}
                  />
                  {Platform.OS === "ios" && (
                    <View style={styles.pickerActions}>
                      <Pressable
                        style={styles.pickerCancel}
                        onPress={() => setShowOptionPicker(false)}
                      >
                        <Text style={styles.pickerCancelText}>{t("common:actions.cancel")}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.pickerConfirm}
                        onPress={() => {
                          const day = new Date(
                            optionDraft.getFullYear(),
                            optionDraft.getMonth(),
                            optionDraft.getDate(),
                            19,
                            0,
                          );
                          setDateOptions([...dateOptions, day]);
                          setShowOptionPicker(false);
                        }}
                      >
                        <Text style={styles.pickerConfirmText}>
                          {t("events:form.addThisDate")}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* ÉTAPE 3 — Lieu */}
      {step === 2 && (
        <View style={styles.card}>
          <ModeSwitch
            left={t("events:form.placeFixed")}
            right={t("events:form.vote")}
            value={locationMode === "vote"}
            onChange={(v) => setLocationMode(v ? "vote" : "fixed")}
          />

          {locationMode === "fixed" ? (
            <>
              <Text style={styles.label}>{t("events:form.address")}</Text>
              <AddressAutocomplete
                placeholder={t("events:form.addressPlaceholder")}
                onChange={setFixedLocation}
              />
              <Text style={styles.hint}>
                {t("events:form.addressHint")}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                {t("events:form.placeVoteHint")}
              </Text>
              {locationOptions.map((l, i) => (
                <View key={i} style={styles.optionRow}>
                  <Text style={styles.optionText} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setLocationOptions(
                        locationOptions.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Text style={styles.deleteX}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <AddressAutocomplete
                key={locKey}
                placeholder={t("events:form.placeToSuggest")}
                onChange={setPendingLoc}
              />
              <Pressable
                style={[styles.addOptionBtn, !pendingLoc && { opacity: 0.4 }]}
                disabled={!pendingLoc}
                onPress={() => {
                  if (!pendingLoc) return;
                  setLocationOptions([...locationOptions, pendingLoc]);
                  setPendingLoc(null);
                  setLocKey((k) => k + 1);
                }}
              >
                <Text style={styles.addOptionText}>{t("events:form.addPlace")}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* ÉTAPE 4 — Cadeaux */}
      {step === 3 && (
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t("events:form.noGifts")}</Text>
              <Text style={styles.hint}>
                {t("events:form.noGiftsHint")}
              </Text>
            </View>
            <Switch
              value={giftMode === "none"}
              onValueChange={(v) => setGiftMode(v ? "none" : "proposals")}
              trackColor={{ true: colors.primary }}
            />
          </View>

          {giftMode !== "none" && (
            <>
              <ModeSwitch
                left={t("events:form.freeProposals")}
                right={t("events:form.imposed")}
                value={giftMode === "imposed"}
                onChange={(v) => setGiftMode(v ? "imposed" : "proposals")}
              />

              {giftMode === "proposals" ? (
            <Text style={styles.hint}>
              {t("events:form.proposalsHint")}
            </Text>
          ) : (
            <>
              <Text style={styles.hint}>
                {t("events:form.imposedHint")}
              </Text>
              {imposedGifts.map((g, i) => (
                <View key={i} style={styles.optionRow}>
                  <Text style={styles.optionText}>
                    {g.name}
                    {g.price != null ? ` · ${g.price} €` : ""}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      setImposedGifts(imposedGifts.filter((_, j) => j !== i))
                    }
                  >
                    <Text style={styles.deleteX}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.rowInline}>
                <TextInput placeholderTextColor={colors.placeholder}
                  style={[styles.input, { flex: 2 }]}
                  placeholder={t("events:form.gift")}
                  value={giftName}
                  onChangeText={setGiftName}
                />
                <TextInput placeholderTextColor={colors.placeholder}
                  style={[styles.input, { flex: 1 }]}
                  placeholder={t("gifts:wishlist.price")}
                  keyboardType="decimal-pad"
                  value={giftPrice}
                  onChangeText={setGiftPrice}
                />
                <Pressable
                  style={[styles.smallAdd, !giftName.trim() && { opacity: 0.4 }]}
                  disabled={!giftName.trim()}
                  onPress={() => {
                    setImposedGifts([
                      ...imposedGifts,
                      {
                        name: giftName.trim(),
                        price: giftPrice
                          ? Number(giftPrice.replace(",", "."))
                          : undefined,
                      },
                    ]);
                    setGiftName("");
                    setGiftPrice("");
                  }}
                >
                  <Text style={styles.smallAddText}>＋</Text>
                </Pressable>
              </View>
                </>
              )}
            </>
          )}
        </View>
      )}

      {/* ÉTAPE 5 — Cagnotte */}
      {step === 4 && (
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t("events:form.enablePool")}</Text>
              <Text style={styles.hint}>
                {poolLocked
                  ? POOL_LOCK_HINTS[String(user?.poolBlockedReason)] ??
                    POOL_LOCK_HINTS.minor
                  : t("events:form.poolHint")}
              </Text>
            </View>
            {!poolLocked && (
              <Switch
                value={poolEnabled}
                onValueChange={setPoolEnabled}
                trackColor={{ true: colors.primary }}
              />
            )}
          </View>

          {poolEnabled && !poolLocked && (
            <>
              <Text style={styles.label}>{t("events:form.methods")}</Text>
              <Pressable
                style={[styles.methodBtn, wantIban && styles.methodBtnActive]}
                onPress={() => setWantIban((v) => !v)}
              >
                <Text
                  style={[
                    styles.methodText,
                    wantIban && styles.methodTextActive,
                  ]}
                >
                  {t("events:form.iban")} {wantIban ? "✓" : ""}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.methodBtn, wantPaypal && styles.methodBtnActive]}
                onPress={() => setWantPaypal((v) => !v)}
              >
                <Text
                  style={[
                    styles.methodText,
                    wantPaypal && styles.methodTextActive,
                  ]}
                >
                  {t("events:form.paypal")} {wantPaypal ? "✓" : ""}
                </Text>
              </Pressable>

              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  {t("events:form.poolNotice")}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* ÉTAPE 6 — Invitation */}
      {step === 5 && (
        <View style={styles.card}>
          <Text style={styles.label}>{t("events:form.maxGuests")}</Text>
          <TextInput placeholderTextColor={colors.placeholder}
            style={styles.input}
            placeholder={t("events:form.unlimited")}
            keyboardType="number-pad"
            value={maxGuests}
            onChangeText={setMaxGuests}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>{t("events:form.external")}</Text>
              <Text style={styles.hint}>
                {t("events:form.externalHint")}
              </Text>
            </View>
            <Switch
              value={allowExternalGuests}
              onValueChange={setAllowExternalGuests}
              trackColor={{ true: colors.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>
                {t("events:form.guestInvites")}
              </Text>
              <Text style={styles.hint}>
                {t("events:form.guestInvitesHint")}
              </Text>
            </View>
            <Switch
              value={allowGuestInvites}
              onValueChange={setAllowGuestInvites}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.nav}>
        {step > 0 && (
          <Pressable style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Text style={styles.backText}>‹ {t("common:actions.back")}</Text>
          </Pressable>
        )}
        {step < STEPS.length - 1 ? (
          <Pressable
            style={[styles.nextBtn, !canNext() && { opacity: 0.5 }]}
            disabled={!canNext()}
            onPress={() => goStep(step + 1)}
          >
            <Text style={styles.nextText}>{t("common:actions.next")} ›</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.createBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.nextText}>{submitLabel}</Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function ModeSwitch({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.modeSwitch}>
      <Pressable
        style={[styles.modeBtn, !value && styles.modeBtnActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.modeText, !value && styles.modeTextActive]}>
          {left}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.modeBtn, value && styles.modeBtnActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.modeText, value && styles.modeTextActive]}>
          {right}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 12, paddingBottom: 48, gap: 10, ...formPane },
    error: { color: c.danger, textAlign: "center", padding: 6 },
    progress: { flexDirection: "row", justifyContent: "space-between" },
    progressItem: { alignItems: "center", flex: 1, gap: 3 },
    progressDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    progressDotActive: { backgroundColor: c.primary },
    progressDotDone: { backgroundColor: c.success },
    progressNum: { fontSize: 12, fontWeight: "700", color: c.sub },
    progressLabel: { fontSize: 10, color: c.sub },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 14,
      gap: 8,
      shadowColor: c.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    label: { fontSize: 13, fontWeight: "700", color: c.sub, marginTop: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 11,
      fontSize: 15,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    inputText: { fontSize: 15, color: c.text },
    hint: { color: c.faint, fontSize: 12 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: 11,
      backgroundColor: c.cardSoft,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: c.text },
    chipTextActive: { color: c.white },
    modeSwitch: {
      flexDirection: "row",
      backgroundColor: c.bgSecondary,
      borderRadius: 10,
      padding: 3,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: "center",
    },
    modeBtnActive: { backgroundColor: c.card, elevation: 1 },
    modeText: { fontSize: 13, fontWeight: "600", color: c.sub },
    modeTextActive: { color: c.text },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.cardSoft,
      borderRadius: 10,
      padding: 10,
    },
    optionText: { color: c.text, fontWeight: "500", flexShrink: 1 },
    deleteX: { color: c.danger, fontWeight: "700", fontSize: 15 },
    addOptionBtn: {
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: "dashed",
      borderRadius: 10,
      padding: 11,
      alignItems: "center",
    },
    addOptionText: { color: c.primary, fontWeight: "600" },
    rowInline: { flexDirection: "row", gap: 8, alignItems: "center" },
    smallAdd: {
      backgroundColor: c.primary,
      borderRadius: 10,
      width: 40,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
    },
    smallAddText: { color: c.white, fontSize: 18, fontWeight: "600" },
    pickerWrap: { alignItems: "center", width: "100%" },
    pickerActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
      width: "100%",
    },
    pickerCancel: {
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    pickerCancelText: { color: c.sub, fontWeight: "600" },
    pickerConfirm: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center",
    },
    pickerConfirmText: { color: c.white, fontWeight: "700", fontSize: 15 },
    methodBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      backgroundColor: c.cardSoft,
    },
    methodBtnActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    methodText: { color: c.text, fontWeight: "600", fontSize: 14 },
    methodTextActive: { color: c.primaryStrong },
    noticeBox: {
      backgroundColor: c.warningSoft,
      borderRadius: 10,
      padding: 12,
      marginTop: 4,
    },
    noticeText: { color: c.warningStrong, fontSize: 12, lineHeight: 17 },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    switchLabel: { fontSize: 14, fontWeight: "600", color: c.text },
    nav: { flexDirection: "row", gap: 10, marginTop: 4 },
    backBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: 13,
      paddingHorizontal: 18,
      backgroundColor: c.card,
    },
    backText: { color: c.text, fontWeight: "600" },
    nextBtn: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    createBtn: {
      flex: 1,
      backgroundColor: c.success,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    nextText: { color: c.white, fontWeight: "700", fontSize: 15 },
  });

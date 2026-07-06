import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { DateEntry, fetchDates } from "../lib/dates";
import { EventEntry, fetchMyEvents, eventDate } from "../lib/events";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function getMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  return x;
}

const WEEK_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface DayItems {
  birthdays: DateEntry[];
  namedays: DateEntry[];
  events: EventEntry[];
}

export default function AgendaScreen() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [dates, setDates] = useState<DateEntry[] | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchDates(), fetchMyEvents()])
        .then(([d, ev]) => {
          setDates(d);
          setEvents([...ev.organized, ...ev.invited]);
        })
        .catch((e) => setError(e?.message ?? "Erreur de chargement."));
    }, []),
  );

  // Items par jour du mois affiché
  const itemsByDay = useMemo(() => {
    const map = new Map<number, DayItems>();
    if (!dates) return map;
    const get = (day: number): DayItems => {
      if (!map.has(day))
        map.set(day, { birthdays: [], namedays: [], events: [] });
      return map.get(day)!;
    };

    for (const d of dates) {
      // Anniversaires : mois + jour uniquement (récurrence annuelle)
      const b = new Date(d.date);
      if (b.getMonth() === month) get(b.getDate()).birthdays.push(d);
      // Fêtes : format "MM-DD"
      const nd = d.nameday ?? d.linkedUser?.nameday;
      if (nd) {
        const [mm, dd] = nd.split("-").map(Number);
        if (mm - 1 === month) get(dd).namedays.push(d);
      }
    }
    for (const ev of events) {
      // Événements : année + mois + jour (non récurrents)
      const dt = eventDate(ev);
      if (dt && dt.getFullYear() === year && dt.getMonth() === month) {
        get(dt.getDate()).events.push(ev);
      }
    }
    return map;
  }, [dates, events, month, year]);

  const itemsForDate = (day: Date): DayItems => {
    const out: DayItems = { birthdays: [], namedays: [], events: [] };
    for (const d of dates ?? []) {
      const b = new Date(d.date);
      if (b.getMonth() === day.getMonth() && b.getDate() === day.getDate())
        out.birthdays.push(d);
      const nd = d.nameday ?? d.linkedUser?.nameday;
      if (nd) {
        const [mm, dd] = nd.split("-").map(Number);
        if (mm - 1 === day.getMonth() && dd === day.getDate())
          out.namedays.push(d);
      }
    }
    for (const ev of events) {
      const dt = eventDate(ev);
      if (
        dt &&
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate()
      )
        out.events.push(ev);
    }
    return out;
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };
  const moveWeek = (delta: number) => {
    const w = new Date(weekStart);
    w.setDate(w.getDate() + delta * 7);
    setWeekStart(w);
  };
  const openDay = (day: Date) => {
    setYear(day.getFullYear());
    setMonth(day.getMonth());
    setSelectedDay(day.getDate());
  };

  if (!dates) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Agenda" }} />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color="#3b82f6" />
        )}
      </View>
    );
  }

  // Grille : lundi en premier — offset (firstDay + 6) % 7 (règle projet)
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth();
  const selected = selectedDay != null ? itemsByDay.get(selectedDay) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Agenda" }} />
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Toggle Mois / Semaine */}
      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.viewBtn, view === "month" && styles.viewBtnActive]}
          onPress={() => setView("month")}
        >
          <Text style={[styles.viewText, view === "month" && styles.viewTextActive]}>
            Mois
          </Text>
        </Pressable>
        <Pressable
          style={[styles.viewBtn, view === "week" && styles.viewBtnActive]}
          onPress={() => {
            setWeekStart(getMonday(new Date()));
            setView("week");
          }}
        >
          <Text style={[styles.viewText, view === "week" && styles.viewTextActive]}>
            Semaine
          </Text>
        </Pressable>
      </View>

      {/* Navigation */}
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => (view === "month" ? prevMonth() : moveWeek(-1))}
          hitSlop={10}
        >
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {view === "month"
            ? `${MONTHS[month]} ${year}`
            : `Semaine du ${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].toLowerCase()}`}
        </Text>
        <Pressable
          onPress={() => (view === "month" ? nextMonth() : moveWeek(1))}
          hitSlop={10}
        >
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Vue semaine */}
      {view === "week" &&
        Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          const items = itemsForDate(day);
          const count =
            items.birthdays.length + items.namedays.length + items.events.length;
          const isToday =
            day.toDateString() === new Date().toDateString();
          return (
            <Pressable
              key={i}
              style={[styles.weekRow, isToday && styles.weekRowToday]}
              onPress={() => count > 0 && openDay(day)}
            >
              <View style={styles.weekDayCol}>
                <Text style={[styles.weekDayName, isToday && { color: "#2563eb" }]}>
                  {WEEK_DAYS[i]}
                </Text>
                <Text style={[styles.weekDayNum, isToday && { color: "#2563eb" }]}>
                  {day.getDate()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                {count === 0 && <Text style={styles.weekEmpty}>—</Text>}
                {items.birthdays.slice(0, 2).map((d) => (
                  <Text key={`b${d._id}`} style={styles.weekItem} numberOfLines={1}>
                    🎂 {d.name} {d.surname ?? ""}
                  </Text>
                ))}
                {items.namedays.slice(0, 1).map((d) => (
                  <Text key={`n${d._id}`} style={styles.weekItem} numberOfLines={1}>
                    🎉 Fête de {d.name}
                  </Text>
                ))}
                {items.events.slice(0, 2).map((ev) => (
                  <Text key={`e${ev._id}`} style={styles.weekItem} numberOfLines={1}>
                    📅 {ev.title}
                  </Text>
                ))}
                {count > 3 && (
                  <Text style={styles.weekMore}>+ {count - 3} autres…</Text>
                )}
              </View>
            </Pressable>
          );
        })}

      {/* En-têtes jours (vue mois) */}
      {view === "month" && (
      <View style={styles.grid}>
        {DAYS.map((d, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.dayHeader}>{d}</Text>
          </View>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={styles.cell} />;
          const items = itemsByDay.get(day);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <Pressable
              key={day}
              style={[styles.cell, styles.dayCell, isToday && styles.todayCell]}
              onPress={() => items && setSelectedDay(day)}
            >
              <Text style={[styles.dayNum, isToday && styles.todayNum]}>
                {day}
              </Text>
              <View style={styles.dots}>
                {!!items?.birthdays.length && <Dot color="#3b82f6" />}
                {!!items?.namedays.length && <Dot color="#f59e0b" />}
                {!!items?.events.length && <Dot color="#10b981" />}
              </View>
            </Pressable>
          );
        })}
      </View>
      )}

      {/* Légende */}
      <View style={styles.legend}>
        <LegendItem color="#3b82f6" label="Anniversaire" />
        <LegendItem color="#f59e0b" label="Fête" />
        <LegendItem color="#10b981" label="Événement" />
      </View>

      {/* Modal jour */}
      <Modal
        visible={selectedDay != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedDay(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {selectedDay} {MONTHS[month].toLowerCase()} {year}
            </Text>

            {selected?.birthdays.map((d) => (
              <Pressable
                key={`b${d._id}`}
                style={styles.sheetRow}
                onPress={() => {
                  setSelectedDay(null);
                  router.push(`/date/${d._id}`);
                }}
              >
                <Text style={styles.sheetEmoji}>🎂</Text>
                <Text style={styles.sheetText}>
                  {d.name} {d.surname ?? ""}
                </Text>
              </Pressable>
            ))}
            {selected?.namedays.map((d) => (
              <Pressable
                key={`n${d._id}`}
                style={styles.sheetRow}
                onPress={() => {
                  setSelectedDay(null);
                  router.push(`/date/${d._id}`);
                }}
              >
                <Text style={styles.sheetEmoji}>🎉</Text>
                <Text style={styles.sheetText}>
                  Fête de {d.name} {d.surname ?? ""}
                </Text>
              </Pressable>
            ))}
            {selected?.events.map((ev) => (
              <Pressable
                key={`e${ev._id}`}
                style={styles.sheetRow}
                onPress={() => {
                  setSelectedDay(null);
                  router.push(`/event/${ev.shortId}`);
                }}
              >
                <Text style={styles.sheetEmoji}>📅</Text>
                <Text style={styles.sheetText}>{ev.title}</Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.closeBtn}
              onPress={() => setSelectedDay(null)}
            >
              <Text style={styles.closeText}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <Dot color={color} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const CELL = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { padding: 12, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  error: { color: "#b91c1c", textAlign: "center", padding: 6 },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  viewBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  viewBtnActive: { backgroundColor: "#fff", elevation: 1 },
  viewText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  viewTextActive: { color: "#111827" },
  weekRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  weekRowToday: { borderWidth: 1.5, borderColor: "#3b82f6" },
  weekDayCol: { width: 72 },
  weekDayName: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  weekDayNum: { fontSize: 20, fontWeight: "700", color: "#111827" },
  weekEmpty: { color: "#d1d5db" },
  weekItem: { color: "#374151", fontSize: 13 },
  weekMore: { color: "#3b82f6", fontSize: 12, fontWeight: "600" },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  navArrow: { fontSize: 30, color: "#3b82f6", fontWeight: "600" },
  monthTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 6,
  },
  cell: { width: CELL, alignItems: "center", paddingVertical: 6 },
  dayCell: { minHeight: 52, borderRadius: 8 },
  todayCell: { backgroundColor: "#eff6ff" },
  dayHeader: { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  dayNum: { fontSize: 14, color: "#111827" },
  todayNum: { color: "#2563eb", fontWeight: "700" },
  dots: { flexDirection: "row", gap: 3, marginTop: 3, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 12, color: "#6b7280" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 4,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  sheetEmoji: { fontSize: 18 },
  sheetText: { fontSize: 15, color: "#111827", fontWeight: "500" },
  closeBtn: { alignItems: "center", marginTop: 14 },
  closeText: { color: "#3b82f6", fontWeight: "600" },
});

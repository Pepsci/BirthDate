import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  useTheme,
  useThemedStyles,
  ThemeColors,
} from "../lib/theme-context";

export interface LocationValue {
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

interface Suggestion {
  label: string;
  city?: string;
  lat: number;
  lng: number;
}

/**
 * Autocomplete de lieux via Photon (photon.komoot.io, données OpenStreetMap).
 * Gratuit, sans clé, et gère les POI ("Jardin du Luxembourg") comme les
 * adresses — équivalent mobile du Google Places du web.
 * La saisie libre reste possible (lieu sans adresse précise : "Chez moi"…).
 */
export default function AddressAutocomplete({
  placeholder,
  onChange,
  initialText = "",
}: {
  placeholder: string;
  onChange: (loc: LocationValue | null) => void;
  initialText?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [text, setText] = useState(initialText);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(false);

  const search = async (q: string) => {
    try {
      setLoading(true);
      // lat/lon = biais Paris pour prioriser les résultats français
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=fr&lat=48.85&lon=2.35`,
      );
      const json = await res.json();
      setSuggestions(
        (json.features ?? [])
          .map((f: any) => {
            const p = f.properties ?? {};
            const namePart =
              p.name ??
              [p.housenumber, p.street].filter(Boolean).join(" ");
            if (!namePart) return null;
            const label = [namePart, p.postcode, p.city ?? p.state]
              .filter(Boolean)
              .join(", ");
            return {
              label,
              city: p.city,
              lng: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
            };
          })
          .filter(Boolean) as Suggestion[],
      );
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const onTextChange = (t: string) => {
    setText(t);
    selectedRef.current = false;
    // Saisie libre : le texte devient le nom du lieu
    onChange(t.trim() ? { name: t.trim() } : null);

    if (debounce.current) clearTimeout(debounce.current);
    if (t.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(() => search(t.trim()), 350);
  };

  const select = (s: Suggestion) => {
    selectedRef.current = true;
    setText(s.label);
    setSuggestions([]);
    onChange({
      name: s.label,
      address: s.label,
      coordinates: { lat: s.lat, lng: s.lng },
    });
  };

  return (
    <View style={styles.wrap}>
      <View>
        <TextInput
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          placeholder={placeholder}
          value={text}
          onChangeText={onTextChange}
        />
        {loading && (
          <ActivityIndicator
            style={styles.spinner}
            size="small"
            color={colors.faint}
          />
        )}
      </View>
      {suggestions.length > 0 && !selectedRef.current && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.label}${i}`}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && { backgroundColor: colors.primarySoft },
              ]}
              onPress={() => select(s)}
            >
              <Text style={styles.suggestionText} numberOfLines={1}>
                📍 {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 0 },
    input: {
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 10,
      padding: 11,
      fontSize: 15,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    spinner: { position: "absolute", right: 10, top: 12 },
    dropdown: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderTopWidth: 0,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      marginTop: -4,
      paddingTop: 4,
    },
    suggestion: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    suggestionText: { color: c.text, fontSize: 13 },
  });

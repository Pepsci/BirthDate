import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";

/**
 * Cadre carte pour le lieu d'un événement (parité avec le web : Leaflet/OSM).
 * - Utilise les coordonnées enregistrées si présentes.
 * - Sinon géocode l'adresse via Nominatim (OSM, gratuit, sans clé).
 * - Rend une carte Leaflet interactive (zoom/déplacement) dans une WebView.
 */
export default function EventLocationMap({
  name,
  address,
  coordinates,
  onOpenMaps,
}: {
  name?: string;
  address?: string;
  coordinates?: { lat?: number; lng?: number } | null;
  onOpenMaps: () => void;
}) {
  const hasCoords = !!(coordinates?.lat && coordinates?.lng);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    hasCoords ? { lat: coordinates!.lat!, lng: coordinates!.lng! } : null,
  );
  const [loading, setLoading] = useState(!hasCoords);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (coords) return;
    const q = [name, address].filter(Boolean).join(", ");
    if (!q) {
      setLoading(false);
      setFailed(true);
      return;
    }
    let active = true;
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        q,
      )}`,
      { headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.[0]?.lat && data?.[0]?.lon) {
          setCoords({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          });
        } else {
          setFailed(true);
        }
      })
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = coords ? leafletHtml(coords.lat, coords.lng) : "";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📍 Lieu</Text>
      <Text style={styles.name}>{name || address}</Text>
      {!!address && name !== address && (
        <Text style={styles.address}>{address}</Text>
      )}

      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : coords && !failed ? (
        <View style={styles.frame}>
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={styles.web}
            scrollEnabled={false}
            nestedScrollEnabled
            javaScriptEnabled
            domStorageEnabled
            onError={() => setFailed(true)}
          />
        </View>
      ) : null}

      <Pressable style={styles.mapsBtn} onPress={onOpenMaps}>
        <Text style={styles.mapsBtnText}>🧭 Ouvrir dans Maps</Text>
      </Pressable>
    </View>
  );
}

function leafletHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef2f7; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var lat = ${lat}, lng = ${lng};
  var map = L.map('map', { attributionControl: false, zoomControl: true }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.marker([lat, lng]).addTo(map);
  setTimeout(function () { map.invalidateSize(); }, 200);
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontSize: 15, fontWeight: "800", color: "#111827" },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  address: { fontSize: 13, color: "#6b7280" },
  placeholder: {
    height: 180,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  frame: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  web: { flex: 1, backgroundColor: "transparent" },
  mapsBtn: {
    marginTop: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  mapsBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

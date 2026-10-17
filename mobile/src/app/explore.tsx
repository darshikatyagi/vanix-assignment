
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

const API = "http://localhost:3000";

type Reading = {
  id: number;
  timestamp: number;
  temperature: number;
  battery: number;
  activity_score: number;
};

type AlertItem = {
  id: number;
  device_id: number;
  type: string;
  message: string;
  raised_at: number;
  acknowledged: number;
};

export default function DeviceDetails() {
  const params = useLocalSearchParams<{ deviceId?: string | string[] }>();
const deviceId = Array.isArray(params.deviceId)
  ? params.deviceId[0]
  : params.deviceId;
  const router = useRouter();

  const [device, setDevice] = useState<any>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyAlert, setBusyAlert] = useState<number | null>(null);

  const loadDetails = async () => {
     if (!deviceId) {
    setError("No device selected. Return to the dashboard and choose a device.");
    setLoading(false);
    setRefreshing(false);
    return;
  }
    try {
      setError("");

      const [deviceResponse, readingsResponse, alertsResponse] =
        await Promise.all([
          fetch(`${API}/api/devices/${deviceId}`),
          fetch(`${API}/api/devices/${deviceId}/readings?limit=10`),
          fetch(`${API}/api/alerts?status=open`),
        ]);

      if (!deviceResponse.ok || !readingsResponse.ok || !alertsResponse.ok) {
        throw new Error("Could not load device information.");
      }

      const deviceData = await deviceResponse.json();
      const readingsData = await readingsResponse.json();
      const alertsData = await alertsResponse.json();

      setDevice(deviceData.device);
      setReadings(readingsData.readings || []);
      setAlerts(
        alertsData.filter(
          (alert: AlertItem) => alert.type && alert.device_id === Number(deviceId)
        )
      );
    } catch {
      setError("Unable to connect. Check the backend server and API address.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [deviceId])
  );

  const acknowledgeAlert = async (id: number) => {
    try {
      setBusyAlert(id);
      const response = await fetch(`${API}/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });

      if (!response.ok) throw new Error("Acknowledgement failed.");
      await loadDetails();
    } catch {
      setError("Could not acknowledge this alert. Please retry.");
    } finally {
      setBusyAlert(null);
    }
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleString();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4776E6" />
        <Text style={styles.muted}>Loading device details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDetails();
            }}
          />
        }
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹  All devices</Text>
        </Pressable>

        <Text style={styles.eyebrow}>DEVICE DETAILS</Text>
        <Text style={styles.title}>{device?.label || `Device ${deviceId}`}</Text>
        <Text style={styles.subtitle}>Device ID: {deviceId}</Text>

        {!!error && (
          <Pressable style={styles.errorCard} onPress={loadDetails}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>LATEST TEMPERATURE</Text>
          <Text style={styles.temperature}>
            {readings.length
              ? `${readings[0].temperature.toFixed(2)}°C`
              : "--"}
          </Text>
          <View style={styles.separator} />
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.cardLabel}>BATTERY</Text>
              <Text style={styles.summaryValue}>
                {readings.length ? `${readings[0].battery}%` : "--"}
              </Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>ACTIVITY SCORE</Text>
              <Text style={styles.summaryValue}>
                {readings.length
                  ? readings[0].activity_score.toFixed(2)
                  : "--"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Open alerts ({alerts.length})</Text>
        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No open alerts for this device.</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Text style={styles.alertType}>
                {alert.type.replaceAll("_", " ").toUpperCase()}
              </Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertTime}>
                Raised: {formatDate(alert.raised_at)}
              </Text>
              <Pressable
                style={styles.ackButton}
                disabled={busyAlert === alert.id}
                onPress={() => acknowledgeAlert(alert.id)}
              >
                <Text style={styles.ackText}>
                  {busyAlert === alert.id ? "Saving..." : "Acknowledge alert"}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Recent readings</Text>
        {readings.map((reading) => (
          <View style={styles.readingCard} key={reading.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.readingTemperature}>
                {reading.temperature.toFixed(2)}°C
              </Text>
              <Text style={styles.readingTime}>
                {formatDate(reading.timestamp)}
              </Text>
            </View>
            <View style={styles.readingRight}>
              <Text style={styles.readingMetric}>Battery {reading.battery}%</Text>
              <Text style={styles.readingMetric}>
                Activity {reading.activity_score.toFixed(1)}
              </Text>
            </View>
          </View>
        ))}

        <Text style={styles.footer}>Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FB" },
  muted: { color: "#7B8498", marginTop: 12 },
  back: { color: "#4776E6", fontWeight: "700", fontSize: 15, marginBottom: 24 },
  eyebrow: { color: "#4776E6", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#17233C", fontSize: 29, fontWeight: "800", marginTop: 8 },
  subtitle: { color: "#7B8498", marginTop: 6, marginBottom: 20 },
  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 22, elevation: 2 },
  cardLabel: { color: "#8A93A5", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  temperature: { color: "#17233C", fontSize: 38, fontWeight: "800", marginVertical: 8 },
  separator: { height: 1, backgroundColor: "#EFF1F6", marginVertical: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryValue: { color: "#17233C", fontSize: 20, fontWeight: "800", marginTop: 8 },
  sectionTitle: { color: "#17233C", fontSize: 19, fontWeight: "800", marginTop: 28, marginBottom: 13 },
  alertCard: { backgroundColor: "#FFF", borderRadius: 15, padding: 17, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: "#DC5555" },
  alertType: { color: "#C24141", fontWeight: "800", fontSize: 12 },
  alertMessage: { color: "#17233C", fontSize: 14, marginTop: 8 },
  alertTime: { color: "#8A93A5", fontSize: 11, marginTop: 8 },
  ackButton: { backgroundColor: "#EAF0FF", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 13 },
  ackText: { color: "#315CC5", fontWeight: "800", fontSize: 12 },
  emptyCard: { backgroundColor: "#E1F5EA", borderRadius: 12, padding: 17 },
  emptyText: { color: "#18794E", fontSize: 13 },
  readingCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 15, borderRadius: 14, marginBottom: 10 },
  readingTemperature: { color: "#17233C", fontSize: 18, fontWeight: "800" },
  readingTime: { color: "#8A93A5", fontSize: 11, marginTop: 5 },
  readingRight: { alignItems: "flex-end", gap: 5 },
  readingMetric: { color: "#566176", fontSize: 12 },
  footer: { color: "#8A93A5", textAlign: "center", fontSize: 12, marginTop: 20 },
  errorCard: { backgroundColor: "#FCE8E8", padding: 15, borderRadius: 12, marginBottom: 15 },
  errorText: { color: "#A52F2F", fontSize: 13 },
  retry: { color: "#A52F2F", fontWeight: "800", marginTop: 8 },
});


import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

const API = "http://localhost:3000";

type Device = {
  deviceId: number;
  label: string;
  location?: string;
  latestTemperature: number | null;
  activityScore: number | null;
  lastSeen: number | null;
  hasOpenAlert: number;
};

export default function Dashboard() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDevices = async () => {
    try {
      setError("");
      const response = await fetch(`${API}/api/devices`);
      if (!response.ok) throw new Error("Unable to load devices");
      setDevices(await response.json());
    } catch {
      setError("Cannot connect to the backend. Check that the server is running.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [])
  );

  const onlineCount = devices.filter((d) => d.lastSeen !== null).length;
  const alertCount = devices.filter((d) => d.hasOpenAlert > 0).length;

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={devices}
        keyExtractor={(item) => String(item.deviceId)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDevices();
            }}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>VANIX TECHNOLOGIES</Text>
            <Text style={styles.title}>Device Monitor</Text>
            <Text style={styles.subtitle}>
              Your sensor network at a glance
            </Text>

            <View style={styles.stats}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{devices.length}</Text>
                <Text style={styles.statLabel}>Devices</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{onlineCount}</Text>
                <Text style={styles.statLabel}>Reporting</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: "#DC5555" }]}>
                  {alertCount}
                </Text>
                <Text style={styles.statLabel}>With alerts</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>All devices</Text>

            {loading && (
              <ActivityIndicator size="large" color="#4776E6" />
            )}
            {!!error && (
              <Pressable style={styles.errorCard} onPress={loadDevices}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.retry}>Tap to retry</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>No devices registered yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.deviceCard}
            onPress={() =>
              router.push({
                pathname: "/explore",
                params: { deviceId: String(item.deviceId) },
              })
            }
          >
            <View style={styles.deviceTop}>
              <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>⌁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{item.label}</Text>
                <Text style={styles.deviceId}>ID: {item.deviceId}</Text>
              </View>
              <View
                style={[
                  styles.status,
                  { backgroundColor: item.hasOpenAlert ? "#FCE8E8" : "#E1F5EA" },
                ]}
              >
                <Text
                  style={{
                    color: item.hasOpenAlert ? "#C24141" : "#18794E",
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {item.hasOpenAlert ? "ALERT" : "OK"}
                </Text>
              </View>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>TEMPERATURE</Text>
                <Text style={styles.metricValue}>
                  {item.latestTemperature == null
                    ? "--"
                    : `${item.latestTemperature.toFixed(1)}°C`}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>ACTIVITY SCORE</Text>
                <Text style={styles.metricValue}>
                  {item.activityScore == null
                    ? "--"
                    : item.activityScore.toFixed(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.openDetails}>View readings and alerts  →</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Text style={styles.footer}>Pull down to refresh device data</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FB" },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { color: "#4776E6", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: 12 },
  title: { fontSize: 30, fontWeight: "800", color: "#17233C", marginTop: 8 },
  subtitle: { fontSize: 14, color: "#7B8498", marginTop: 6, marginBottom: 22 },
  stats: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, elevation: 1 },
  statNumber: { fontSize: 25, fontWeight: "800", color: "#17233C" },
  statLabel: { color: "#7B8498", fontSize: 12, marginTop: 5 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#17233C", marginBottom: 14 },
  deviceCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 17, marginBottom: 13, elevation: 2 },
  deviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#EAF0FF", alignItems: "center", justifyContent: "center" },
  deviceIconText: { fontSize: 27, color: "#4776E6" },
  deviceName: { fontSize: 16, fontWeight: "800", color: "#17233C" },
  deviceId: { color: "#8A93A5", fontSize: 12, marginTop: 4 },
  status: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  metrics: { flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#EFF1F6" },
  metric: { flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: "700", color: "#8A93A5", letterSpacing: 0.6 },
  metricValue: { fontSize: 22, fontWeight: "800", color: "#17233C", marginTop: 6 },
  openDetails: { fontSize: 12, fontWeight: "700", color: "#4776E6", marginTop: 17 },
  footer: { textAlign: "center", color: "#8A93A5", fontSize: 12, marginTop: 12 },
  empty: { textAlign: "center", color: "#8A93A5", padding: 24 },
  errorCard: { backgroundColor: "#FCE8E8", padding: 16, borderRadius: 12, marginBottom: 16 },
  errorText: { color: "#A52F2F", fontSize: 13 },
  retry: { color: "#A52F2F", fontWeight: "800", marginTop: 8 },
});

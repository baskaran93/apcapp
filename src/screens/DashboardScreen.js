// src/screens/DashboardScreen.js
import React, { useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
  Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { ThemeContext } from "../theme/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import { getDashboardSummary } from "../services/api";

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, mode, toggleTheme } = useContext(ThemeContext);
  const { width } = useWindowDimensions();

  const [summary, setSummary] = useState({
    patients_today: null,
    appointments_today: null,
    consultations_today: null,
    revenue_today: null,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getDashboardSummary();
      if (res.ok && res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (e) {
      console.error("DASHBOARD SUMMARY LOAD ERROR", e);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const fmt = (val, prefix = "") =>
    summaryLoading || val === null || val === undefined ? "—" : `${prefix}${val}`;

  const styles = getStyles(theme, mode);

  // Responsive columns
  const columns = width >= 1100 ? 4 : 2;

  const GAP = 16;
  const H_PADDING = width >= 900 ? 48 : 32;
  const cardWidth = (width - H_PADDING - GAP * (columns - 1)) / columns;

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* ===== BEAUTIFUL BACKGROUND GRADIENT ===== */}
      <LinearGradient
        colors={
          mode === "light"
            ? ["#f8fafc", "#eef2ff", "#f1f5f9"]
            : ["#0b1220", "#0f172a", "#020617"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ===== BACKGROUND BLOBS ===== */}
      <View
        pointerEvents="none"
        style={[
          styles.bgBlob,
          {
            backgroundColor:
              mode === "light"
                ? "rgba(99,102,241,0.18)"
                : "rgba(99,102,241,0.14)",
            top: -90,
            left: -80,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bgBlob,
          {
            backgroundColor:
              mode === "light"
                ? "rgba(34,197,94,0.14)"
                : "rgba(34,197,94,0.10)",
            bottom: -120,
            right: -90,
          },
        ]}
      />

      {/* ===== MAIN CONTENT ===== */}
      <ScrollView contentContainerStyle={styles.container}>
        <Animated.View
          style={[
            styles.inner,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ===== HEADER ===== */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Dashboard 👋</Text>
              <Text style={styles.subtitle}>Hospital Operations Overview</Text>
            </View>

            <TouchableOpacity
              onPress={toggleTheme}
              activeOpacity={0.85}
              style={styles.themeBtn}
            >
              <Icon
                name={mode === "light" ? "moon-outline" : "sunny-outline"}
                size={22}
                color={theme.primary}
              />
            </TouchableOpacity>
          </View>

          {/* ===== KPI CARDS ===== */}
          <View style={styles.gridRow}>
            <KpiCard
              icon="people-outline"
              label="Patients Today"
              value={fmt(summary.patients_today)}
              width={cardWidth}
              accent="#22c55e"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon="calendar-outline"
              label="Appointments"
              value={fmt(summary.appointments_today)}
              width={cardWidth}
              accent="#3b82f6"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon="medkit-outline"
              label="Consultations"
              value={fmt(summary.consultations_today)}
              width={cardWidth}
              accent="#f97316"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon="cash-outline"
              label="Revenue"
              value={fmt(summary.revenue_today, "₹")}
              width={cardWidth}
              accent="#a855f7"
              theme={theme}
              mode={mode}
            />
          </View>

          {/* ===== QUICK ACTIONS ===== */}
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <Text style={styles.sectionSub}>
                Jump to common tasks quickly
              </Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <ActionTile
              icon="people-outline"
              title="Patient Details"
              subtitle="Register & view patients"
              width={cardWidth}
              theme={theme}
              mode={mode}
              onPress={() => navigation.navigate("Home", { screen: "Patients" })}
            />

            <ActionTile
              icon="calendar-outline"
              title="Book Appointment"
              subtitle="Fix daily appointments"
              width={cardWidth}
              theme={theme}
              mode={mode}
              onPress={() => navigation.navigate("Home", { screen: "Appointments" })}
            />

            <ActionTile
              icon="medkit-outline"
              title="Treatment Details"
              subtitle="Add treatment records"
              width={cardWidth}
              theme={theme}
              mode={mode}
              onPress={() =>
                navigation.navigate("Home", { screen: "Patient Treatment" })
              }
            />

            <ActionTile
              icon="pricetags-outline"
              title="Treatment Charges"
              subtitle="Charges & billing master"
              width={cardWidth}
              theme={theme}
              mode={mode}
              onPress={() =>
                navigation.navigate("Home", { screen: "Treatment Charges" })
              }
            />

            <ActionTile
              icon="receipt-outline"
              title="Billing / Payments"
              subtitle="Track collections"
              width={cardWidth}
              theme={theme}
              mode={mode}
              onPress={() => alert("Billing screen coming soon")}
            />
          </View>

          {/* ===== MODERN INFO CARD ===== */}
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Icon name="sparkles-outline" size={20} color={theme.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Tip</Text>
              <Text style={styles.infoText}>
                Add charts + recent appointments table to make this dashboard
                look like a real ERP.
              </Text>
            </View>
          </View>

          {/* ===== SPACE ===== */}
          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ========================= */
/* ===== COMPONENTS ======== */
/* ========================= */

function KpiCard({ icon, label, value, accent, width, theme, mode }) {
  return (
    <View
      style={[
        stylesGlobal.kpiCard,
        {
          width,
          backgroundColor: theme.card,
          borderColor: accent + "55",
        },
      ]}
    >
      <View style={stylesGlobal.kpiTopRow}>
        <View
          style={[
            stylesGlobal.kpiIconWrap,
            { backgroundColor: accent + "22" },
          ]}
        >
          <Icon name={icon} size={24} color={accent} />
        </View>

        <View style={[stylesGlobal.dot, { backgroundColor: accent }]} />
      </View>

      <Text style={[stylesGlobal.kpiValue, { color: theme.text }]}>
        {value}
      </Text>

      <Text style={[stylesGlobal.kpiLabel, { color: theme.subText }]}>
        {label}
      </Text>

      <View style={[stylesGlobal.kpiTrack, { backgroundColor: accent + "33" }]}>
        <View
          style={[
            stylesGlobal.kpiFill,
            { backgroundColor: accent, width: "65%" },
          ]}
        />
      </View>
    </View>
  );
}

function ActionTile({ icon, title, subtitle, onPress, width, theme, mode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        stylesGlobal.actionTile,
        {
          width,
          backgroundColor: theme.card,
          borderColor: mode === "light" ? "#e5e7eb" : "#2a2a2a",
        },
      ]}
    >
      <View style={stylesGlobal.actionTopRow}>
        <View
          style={[
            stylesGlobal.actionIconWrap,
            { backgroundColor: theme.primary + "22" },
          ]}
        >
          <Icon name={icon} size={24} color={theme.primary} />
        </View>

        <Icon name="arrow-forward-outline" size={18} color={theme.subText} />
      </View>

      <Text style={[stylesGlobal.actionTitle, { color: theme.text }]}>
        {title}
      </Text>

      <Text style={[stylesGlobal.actionSub, { color: theme.subText }]}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

/* ========================= */
/* ===== SCREEN STYLES ===== */
/* ========================= */

const getStyles = (theme, mode) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      paddingBottom: 50,
      paddingTop: 18,
      paddingHorizontal: 16,
      alignItems: "center",
    },

    inner: {
      width: "100%",
      maxWidth: 1200,
    },

    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },

    title: {
      fontSize: 30,
      fontWeight: "900",
      color: theme.text,
      letterSpacing: 0.2,
    },

    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: theme.subText,
    },

    themeBtn: {
      height: 44,
      width: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: mode === "light" ? "#e5e7eb" : "#2a2a2a",

      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        },
        android: {
          elevation: 6,
        },
        web: {
          boxShadow: "0px 10px 30px rgba(0,0,0,0.12)",
        },
      }),
    },

    gridRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      marginTop: 12,
    },

    sectionHead: {
      marginTop: 24,
      marginBottom: 8,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.text,
    },

    sectionSub: {
      marginTop: 6,
      fontSize: 13,
      color: theme.subText,
    },

    infoCard: {
      marginTop: 26,
      borderRadius: 22,
      padding: 18,
      flexDirection: "row",
      gap: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: mode === "light" ? "#e5e7eb" : "#2a2a2a",
    },

    infoIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary + "22",
    },

    infoTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: theme.text,
    },

    infoText: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: theme.subText,
    },

    /* ===== BACKGROUND BLOB STYLE ===== */
    bgBlob: {
      position: "absolute",
      width: 280,
      height: 280,
      borderRadius: 280,
    },
  });

/* ========================= */
/* ===== GLOBAL STYLES ===== */
/* ========================= */

const stylesGlobal = StyleSheet.create({
  kpiCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,

    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 10px 30px rgba(0,0,0,0.10)",
      },
    }),
  },

  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kpiIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  dot: {
    width: 9,
    height: 9,
    borderRadius: 20,
  },

  kpiValue: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: "900",
  },

  kpiLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },

  kpiTrack: {
    marginTop: 14,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },

  kpiFill: {
    height: 6,
    borderRadius: 999,
  },

  actionTile: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,

    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0px 10px 30px rgba(0,0,0,0.10)",
      },
    }),
  },

  actionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "900",
  },

  actionSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});

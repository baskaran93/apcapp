// src/screens/DashboardScreen.js
import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { AuthContext } from "../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { getDashboardSummary, getAppointments } from "../services/api";

const STATUS_COLORS = {
  Scheduled: "#3b82f6",
  Completed: "#22c55e",
  Cancelled: "#ef4444",
};

const formatApptDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, mode, toggleTheme } = useContext(ThemeContext);
  const { userRole } = useContext(AuthContext);
  const isAdmin = userRole === "admin";
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState("month"); // "day" | "week" | "month"

  const [summary, setSummary] = useState({
    patients_today: null,
    appointments_today: null,
    consultations_today: null,
    income_today: null,
    expenses_today: null,
    revenue_today: null,
    period: "month",
    period_label: "This Month",
    income_period: null,
    expenses_period: null,
    profit_loss: null,
    profit_margin: null,
    profit_loss_status: null,
    walkins_period: null,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadSummary = useCallback(async (selectedPeriod) => {
    try {
      setSummaryLoading(true);
      const res = await getDashboardSummary(selectedPeriod);
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
    loadSummary(period);
  }, [loadSummary, period]);

  useFocusEffect(
    useCallback(() => {
      loadSummary(period);
    }, [loadSummary, period])
  );

  const [appointments, setAppointments] = useState([]);
  const [apptLoading, setApptLoading] = useState(true);

  const loadAppointments = useCallback(async () => {
    try {
      const res = await getAppointments();
      if (res.ok && Array.isArray(res.data?.data)) {
        setAppointments(res.data.data);
      }
    } catch (e) {
      console.error("DASHBOARD APPOINTMENTS LOAD ERROR", e);
    } finally {
      setApptLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [loadAppointments])
  );

  // Last 7 days appointment trend (excludes cancelled)
  const trendData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        value: 0,
      });
    }
    appointments.forEach((a) => {
      if (!a.appointment_date || a.status === "Cancelled") return;
      const key = String(a.appointment_date).slice(0, 10);
      const day = days.find((d) => d.key === key);
      if (day) day.value += 1;
    });
    return days;
  }, [appointments]);

  const statusCounts = useMemo(() => {
    const counts = { Scheduled: 0, Completed: 0, Cancelled: 0 };
    appointments.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return counts;
  }, [appointments]);

  const recentAppointments = useMemo(() => {
    return [...appointments]
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
      .slice(0, 6);
  }, [appointments]);

  const fmt = (val, prefix = "") =>
    summaryLoading || val === null || val === undefined ? "—" : `${prefix}${val}`;

  const fmtCurrency = (val) => {
    if (summaryLoading || val === null || val === undefined) return "—";
    const num = Number(val);
    const sign = num < 0 ? "-" : "";
    return `${sign}₹${Math.abs(num).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })}`;
  };

  const PERIOD_LABELS = { day: "Today", week: "This Week", month: "This Month" };
  const periodLabel = summary.period_label || PERIOD_LABELS[period];
  const isProfit = (summary.profit_loss ?? 0) >= 0;

  const styles = getStyles(theme, mode);

  // Responsive columns
  const columns = width >= 1100 ? 4 : 2;

  const GAP = 16;
  const H_PADDING = width >= 900 ? 48 : 32;
  const cardWidth = Math.floor((width - H_PADDING - GAP * (columns - 1)) / columns);

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
          </View>

          {/* ===== BUSINESS OVERVIEW ===== */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View>
                <Text style={styles.sectionTitle}>Business Overview</Text>
                <Text style={styles.sectionSub}>
                  Showing figures for {periodLabel.toLowerCase()}
                </Text>
              </View>

              <PeriodSelector value={period} onChange={setPeriod} theme={theme} mode={mode} />
            </View>
          </View>

          <View style={styles.gridRow}>
            <KpiCard
              icon="walk-outline"
              label={`Walk-ins · ${periodLabel}`}
              value={fmt(summary.walkins_period)}
              width={cardWidth}
              accent="#0ea5e9"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon="cash-outline"
              label={`Revenue · ${periodLabel}`}
              value={fmtCurrency(summary.income_period)}
              width={cardWidth}
              accent="#a855f7"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon="wallet-outline"
              label={`Expenses · ${periodLabel}`}
              value={fmtCurrency(summary.expenses_period)}
              width={cardWidth}
              accent="#ef4444"
              theme={theme}
              mode={mode}
            />

            <KpiCard
              icon={isProfit ? "trending-up-outline" : "trending-down-outline"}
              label={isProfit ? `Profit · ${periodLabel}` : `Loss · ${periodLabel}`}
              value={fmtCurrency(summary.profit_loss)}
              caption={
                summaryLoading || summary.profit_margin === null || summary.profit_margin === undefined
                  ? null
                  : `${summary.profit_margin}% margin`
              }
              width={cardWidth}
              accent={isProfit ? "#22c55e" : "#ef4444"}
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
              onPress={() => navigation.navigate("Home", { screen: "Billing" })}
            />

            {isAdmin && (
              <ActionTile
                icon="wallet-outline"
                title="Office Expenses"
                subtitle="Track clinic expenses"
                width={cardWidth}
                theme={theme}
                mode={mode}
                onPress={() =>
                  navigation.navigate("Home", { screen: "Office Expenses" })
                }
              />
            )}
          </View>

          {/* ===== ANALYTICS ===== */}
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Analytics</Text>
              <Text style={styles.sectionSub}>
                Appointment trends & status at a glance
              </Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={{ flex: 1, minWidth: 320 }}>
              <TrendChart data={trendData} theme={theme} mode={mode} />
            </View>

            <View style={{ flex: 1, minWidth: 280 }}>
              <StatusBreakdown counts={statusCounts} theme={theme} mode={mode} />
            </View>
          </View>

          {/* ===== RECENT APPOINTMENTS ===== */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionHeadRow}>
              <View>
                <Text style={styles.sectionTitle}>Recent Appointments</Text>
                <Text style={styles.sectionSub}>Latest bookings across the clinic</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("Home", { screen: "Appointments" })}
              >
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>

          <RecentAppointmentsTable
            items={recentAppointments}
            loading={apptLoading}
            theme={theme}
            mode={mode}
          />

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

function KpiCard({ icon, label, value, caption, accent, width, theme, mode }) {
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

      <View style={stylesGlobal.kpiLabelRow}>
        <Text style={[stylesGlobal.kpiLabel, { color: theme.subText }]}>
          {label}
        </Text>

        {!!caption && (
          <View style={[stylesGlobal.kpiCaptionPill, { backgroundColor: accent + "22" }]}>
            <Text style={[stylesGlobal.kpiCaptionText, { color: accent }]}>{caption}</Text>
          </View>
        )}
      </View>

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

function PeriodSelector({ value, onChange, theme, mode }) {
  const options = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
  ];
  const borderColor = mode === "light" ? "#e5e7eb" : "#2a2a2a";

  return (
    <View
      style={[
        stylesGlobal.periodSelector,
        { backgroundColor: theme.card, borderColor },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            activeOpacity={0.85}
            onPress={() => onChange(opt.key)}
            style={[
              stylesGlobal.periodOption,
              active && { backgroundColor: theme.primary },
            ]}
          >
            <Text
              style={[
                stylesGlobal.periodOptionText,
                { color: active ? "#fff" : theme.subText },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TrendChart({ data, theme, mode }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const borderColor = mode === "light" ? "#e5e7eb" : "#2a2a2a";

  return (
    <View
      style={[
        stylesGlobal.chartCard,
        { backgroundColor: theme.card, borderColor },
      ]}
    >
      <Text style={[stylesGlobal.chartTitle, { color: theme.text }]}>
        Appointments · Last 7 Days
      </Text>

      <View style={stylesGlobal.barRow}>
        {data.map((d) => (
          <View key={d.key} style={stylesGlobal.barCol}>
            <Text style={[stylesGlobal.barValue, { color: theme.subText }]}>
              {d.value}
            </Text>

            <View
              style={[
                stylesGlobal.barTrack,
                { backgroundColor: theme.primary + "1a" },
              ]}
            >
              <View
                style={[
                  stylesGlobal.barFill,
                  {
                    height: `${(d.value / max) * 100}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>

            <Text style={[stylesGlobal.barLabel, { color: theme.subText }]}>
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusBreakdown({ counts, theme, mode }) {
  const borderColor = mode === "light" ? "#e5e7eb" : "#2a2a2a";
  const items = [
    { key: "Scheduled", color: STATUS_COLORS.Scheduled, value: counts.Scheduled },
    { key: "Completed", color: STATUS_COLORS.Completed, value: counts.Completed },
    { key: "Cancelled", color: STATUS_COLORS.Cancelled, value: counts.Cancelled },
  ];
  const total = items.reduce((sum, it) => sum + it.value, 0);

  return (
    <View
      style={[
        stylesGlobal.chartCard,
        { backgroundColor: theme.card, borderColor },
      ]}
    >
      <Text style={[stylesGlobal.chartTitle, { color: theme.text }]}>
        Appointment Status
      </Text>

      <View
        style={[
          stylesGlobal.stackedBarTrack,
          { backgroundColor: mode === "light" ? "#e5e7eb" : "#1f2937" },
        ]}
      >
        {total > 0 &&
          items.map(
            (it) =>
              it.value > 0 && (
                <View
                  key={it.key}
                  style={{ flex: it.value, backgroundColor: it.color }}
                />
              )
          )}
      </View>

      <View style={stylesGlobal.legendWrap}>
        {items.map((it) => (
          <View key={it.key} style={stylesGlobal.legendItem}>
            <View style={[stylesGlobal.legendDot, { backgroundColor: it.color }]} />
            <Text style={[stylesGlobal.legendText, { color: theme.subText }]}>
              {it.key} · {it.value}
              {total ? ` (${Math.round((it.value / total) * 100)}%)` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentAppointmentsTable({ items, loading, theme, mode }) {
  const borderColor = mode === "light" ? "#e5e7eb" : "#2a2a2a";
  const rowBorder = mode === "light" ? "#f1f5f9" : "#1f2937";

  return (
    <View style={[stylesGlobal.tableCard, { backgroundColor: theme.card, borderColor }]}>
      <View style={stylesGlobal.tableHeadRow}>
        <Text style={[stylesGlobal.tableHeadCell, { flex: 1.4, color: theme.subText }]}>
          PATIENT
        </Text>
        <Text style={[stylesGlobal.tableHeadCell, { flex: 1.1, color: theme.subText }]}>
          DOCTOR
        </Text>
        <Text style={[stylesGlobal.tableHeadCell, { flex: 1.2, color: theme.subText }]}>
          DATE & TIME
        </Text>
        <Text
          style={[
            stylesGlobal.tableHeadCell,
            { flex: 0.9, color: theme.subText, textAlign: "right" },
          ]}
        >
          STATUS
        </Text>
      </View>

      {loading ? (
        <Text style={[stylesGlobal.tableEmptyText, { color: theme.subText }]}>
          Loading appointments…
        </Text>
      ) : items.length === 0 ? (
        <Text style={[stylesGlobal.tableEmptyText, { color: theme.subText }]}>
          No appointments yet
        </Text>
      ) : (
        items.map((item, idx) => {
          const color = STATUS_COLORS[item.status] || "#94a3b8";
          return (
            <View
              key={item.id ?? idx}
              style={[
                stylesGlobal.tableRow,
                idx !== items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: rowBorder,
                },
              ]}
            >
              <Text
                style={[stylesGlobal.tableCell, { flex: 1.4, color: theme.text, fontWeight: "700" }]}
                numberOfLines={1}
              >
                {item.patient_name || "—"}
              </Text>
              <Text
                style={[stylesGlobal.tableCell, { flex: 1.1, color: theme.subText }]}
                numberOfLines={1}
              >
                {item.doctor_name || "—"}
              </Text>
              <Text style={[stylesGlobal.tableCell, { flex: 1.2, color: theme.subText }]}>
                {formatApptDate(item.appointment_date)}
              </Text>
              <View style={{ flex: 0.9, alignItems: "flex-end" }}>
                <View style={[stylesGlobal.statusBadge, { backgroundColor: color + "22" }]}>
                  <Text style={[stylesGlobal.statusBadgeText, { color }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
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

    sectionHeadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      flexWrap: "wrap",
      gap: 12,
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

    viewAllLink: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.primary,
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

  kpiLabelRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  kpiLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  kpiCaptionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },

  kpiCaptionText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* ===== PERIOD SELECTOR ===== */
  periodSelector: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },

  periodOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  periodOptionText: {
    fontSize: 13,
    fontWeight: "700",
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

  /* ===== CHART CARD ===== */
  chartCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    minHeight: 210,

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

  chartTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  /* ===== BAR CHART ===== */
  barRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 22,
    height: 130,
  },

  barCol: {
    flex: 1,
    alignItems: "center",
  },

  barValue: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },

  barTrack: {
    width: 14,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },

  barFill: {
    width: "100%",
    borderRadius: 8,
  },

  barLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
  },

  /* ===== STATUS BREAKDOWN ===== */
  stackedBarTrack: {
    marginTop: 22,
    height: 14,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
  },

  legendWrap: {
    marginTop: 18,
    gap: 10,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 20,
  },

  legendText: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* ===== RECENT APPOINTMENTS TABLE ===== */
  tableCard: {
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

  tableHeadRow: {
    flexDirection: "row",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },

  tableHeadCell: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  tableCell: {
    fontSize: 13,
    paddingRight: 8,
  },

  tableEmptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
});

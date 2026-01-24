// src/screens/DashboardScreen.js
import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { ThemeContext } from "../theme/ThemeContext";

const Logo = require("../../assets/images/logo.png");

function DashboardScreen() {
  const navigation = useNavigation();
  const { theme, mode, toggleTheme } = useContext(ThemeContext);
  const { width } = useWindowDimensions();

  // 🔹 PERFECT RESPONSIVE BREAKPOINTS
  const getColumns = () => {
    if (width < 480) return 1;     // 🔥 small mobile → 1 card
    if (width < 768) return 2;     // mobile / big phone
    if (width < 1100) return 3;    // tablet / small web
    return 4;                     // large web
  };

  const columns = getColumns();

  const GAP = 15;
  const H_PADDING = 40;

  const cardWidth = (width - H_PADDING - (columns - 1) * GAP) / columns;

  const styles = getStyles(theme);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcome}>Welcome 👋</Text>
            <Text style={styles.subtitle}>Hospital OP Dashboard</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn}>
              <Icon
                name={mode === "light" ? "moon-outline" : "sunny-outline"}
                size={22}
                color={theme.primary}
              />
            </TouchableOpacity>

            <Image source={Logo} style={styles.logo} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.gridRow}>
          <StatCard icon="people-outline" label="Patients Today" value="24" theme={theme} width={cardWidth} />
          <StatCard icon="calendar-outline" label="Appointments" value="18" theme={theme} width={cardWidth} />
          <StatCard icon="medkit-outline" label="Consultations" value="12" theme={theme} width={cardWidth} />
          <StatCard icon="cash-outline" label="Revenue" value="₹8,500" theme={theme} width={cardWidth} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.gridRow}>
          <ActionButton
            icon="people-outline"
            label="Patients"
            theme={theme}
            width={cardWidth}
            onPress={() =>
              navigation.navigate("Home", { screen: "Patient List" })
            }
          />

          <ActionButton icon="receipt-outline" label="Billing" theme={theme} width={cardWidth} />

          <ActionButton
            icon="pricetags-outline"
            label="Treatment Charges"
            theme={theme}
            width={cardWidth}
            onPress={() =>
              navigation.navigate("Home", { screen: "Treatment Charges" })
            }
          />
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- Components ---------- */

const StatCard = ({ icon, label, value, theme, width }) => (
  <View style={[cardBase, { backgroundColor: theme.card, width }]}>
    <Icon name={icon} size={28} color={theme.primary} />
    <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text, marginTop: 10 }}>
      {value}
    </Text>
    <Text style={{ fontSize: 13, color: theme.subText, marginTop: 6 }}>
      {label}
    </Text>
  </View>
);

const ActionButton = ({ icon, label, theme, onPress, width }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[actionBase, { backgroundColor: theme.card, width }]}
  >
    <Icon name={icon} size={30} color={theme.primary} />
    <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: theme.text }}>
      {label}
    </Text>
  </TouchableOpacity>
);

/* ---------- Styles ---------- */

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 20,
      paddingBottom: 30,
      alignItems: "center",
    },

    inner: {
      width: "100%",
      maxWidth: 1100,
    },

    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 25,
      marginTop: 10,
    },

    headerRight: {
      flexDirection: "row",
      alignItems: "center",
    },

    themeBtn: {
      marginRight: 14,
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.card,
    },

    welcome: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
    },

    subtitle: {
      fontSize: 14,
      color: theme.subText,
      marginTop: 6,
    },

    logo: {
      width: 48,
      height: 48,
      resizeMode: "contain",
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginVertical: 22,
      color: theme.text,
    },

    gridRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: 15,
    },
  });

const cardBase = {
  borderRadius: 16,
  padding: 18,
  marginBottom: 15,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 4,
};

const actionBase = {
  borderRadius: 16,
  paddingVertical: 26,
  alignItems: "center",
  marginBottom: 15,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 4,
};

export default DashboardScreen;

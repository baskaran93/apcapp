import React, { useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";

import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { AuthContext } from "./src/context/AuthContext";
import { ThemeContext } from "./src/theme/ThemeContext";
import { hasPermission } from "./src/utils/permissions";

import LoginScreen from "./src/screens/login";
import DashboardScreen from "./src/screens/DashboardScreen";
import PatientProfileScreen from "./src/screens/registration";
import PatientListScreen from "./src/screens/patientlistscreen";
import TreatmentChargesMaster from "./src/screens/TreatmentChargesMaster";
import PatientTreatmentDetails from "./src/screens/PatientTreatmentDetails";
import AppointmentScreen from "./src/screens/AppointmentScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import UserManagementScreen from "./src/screens/UserManagementScreen";
import MenuRightsScreen from "./src/screens/MenuRightsScreen";
import DesignationMaster from "./src/screens/DesignationMaster";
import ReferralTypeMaster from "./src/screens/ReferralTypeMaster";
import ExpenseMaster from "./src/screens/ExpenseMaster";
import OfficeExpensesScreen from "./src/screens/OfficeExpensesScreen";
import TreatmentHistoryScreen from "./src/screens/TreatmentHistoryScreen";
import BillingScreen from "./src/screens/BillingScreen";

const MENU_BY_ROUTE = {
  Patients: "patients",
  Appointments: "appointments",
  "Treatment Charges": "treatment_charges",
  "Patient Treatment": "patient_treatment",
  "Treatment History": "patient_treatment",
  "Billing": "patient_treatment",
};

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

/* =========================================================
   ✅ Custom Trending Drawer UI
========================================================= */
function CustomDrawerContent(props) {
  const { userName, userRole, permissions } = useContext(AuthContext);
  const { theme, mode } = useContext(ThemeContext);

  const isDark = mode === "dark";

  // Sidebar gradient colors based on theme
  const bgColors = isDark
    ? ["#0f172a", "#1e293b", "#0b1220"]
    : ["#f8fafc", "#eef2ff", "#ffffff"];

  const textColor = isDark ? "#fff" : "#0f172a";
  const subTextColor = isDark ? "#cbd5e1" : "#475569";

  // ✅ USER NAME (dynamic)
  const displayName =
    userName && userName.trim().length > 0 ? userName : "User";

  // ✅ First letter avatar
  const firstLetter =
    displayName && displayName.trim().length > 0
      ? displayName.trim().charAt(0).toUpperCase()
      : "U";

  return (
    <LinearGradient colors={bgColors} style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ===== Profile Header ===== */}
        <View style={styles.profileBox}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: isDark ? "#2563eb" : "#1d4ed8" },
            ]}
          >
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.adminText, { color: textColor }]}>
              {displayName}
            </Text>

            <Text style={[styles.roleText, { color: subTextColor }]}>
              {userRole
                ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
                : "Clinic Panel"}
            </Text>
          </View>
        </View>

        {/* ===== Drawer Items ===== */}
        <View style={{ paddingHorizontal: 14, marginTop: 10 }}>
          {props.state.routes.map((route, index) => {
            const focused = index === props.state.index;

            // Settings and admin-only management screens are reached via
            // Settings, not the sidebar menu
            if (["Settings", "Manage Users", "Menu Rights", "Designation Master", "Referral Type Master", "Expense Master"].includes(route.name)) return null;

            // Office Expenses isn't part of the configurable role_permissions
            // system — it's a straight admin-only screen, so gate it here.
            if (route.name === "Office Expenses" && userRole !== "admin") return null;

            // Menu-scoped visibility: driven by the configurable role_permissions
            // table (admin's /permissions/me/ is all-true, so admin always sees everything)
            const menuKey = MENU_BY_ROUTE[route.name];
            if (menuKey && !hasPermission(permissions, menuKey, "view")) return null;

            const onPress = () => props.navigation.navigate(route.name);

            const iconMap = {
              Dashboard: "view-dashboard",
              Patients: "account-group",
              Appointments: "calendar-clock",
              "Treatment Charges": "cash-multiple",
              "Patient Treatment": "medical-bag",
              "Treatment History": "history",
              "Billing": "receipt-text-outline",
              "Office Expenses": "wallet-outline",
            };

            const iconName = iconMap[route.name] || "circle-outline";

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={[
                  styles.menuCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(15,23,42,0.06)",
                  },
                  focused && {
                    backgroundColor: isDark
                      ? "rgba(37,99,235,0.25)"
                      : "rgba(29,78,216,0.18)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: focused
                        ? "#1d4ed8"
                        : isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(15,23,42,0.10)",
                    },
                  ]}
                >
                  <Icon name={iconName} size={26} color="#fff" />
                </View>

                <Text style={[styles.menuText, { color: textColor }]}>
                  {route.name}
                </Text>

                <Icon
                  name="chevron-right"
                  size={26}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </DrawerContentScrollView>
    </LinearGradient>
  );
}

/* =========================================================
   ✅ Access Denied placeholder shared by both guards below
========================================================= */
function AccessDenied({ theme }) {
  return (
    <View style={[styles.deniedContainer, { backgroundColor: theme.background }]}>
      <Icon name="lock-outline" size={48} color={theme.subText} />
      <Text style={[styles.deniedTitle, { color: theme.text }]}>Access Restricted</Text>
      <Text style={[styles.deniedText, { color: theme.subText }]}>
        You don't have permission to view this screen.
      </Text>
    </View>
  );
}

/* =========================================================
   ✅ Role Guard - for screens that are always admin-only
   (user management, menu rights) regardless of the
   configurable permission matrix.
========================================================= */
function withRoleGuard(ScreenComponent, allowedRoles) {
  return function RoleGuardedScreen(props) {
    const { userRole } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    if (!allowedRoles.includes(userRole)) {
      return <AccessDenied theme={theme} />;
    }

    return <ScreenComponent {...props} />;
  };
}

/* =========================================================
   ✅ Permission Guard - for the four configurable business
   menus. Blocks direct navigation even if the sidebar entry
   is hidden (e.g. via deep link).
========================================================= */
function withPermissionGuard(ScreenComponent, menu) {
  return function PermissionGuardedScreen(props) {
    const { permissions } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    if (!hasPermission(permissions, menu, "view")) {
      return <AccessDenied theme={theme} />;
    }

    return <ScreenComponent {...props} />;
  };
}

/* =========================================================
   ✅ Drawer Navigator
========================================================= */
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        drawerType: "front", // 🔥 Forces overlay behavior on Web (fixes split screen)
        drawerStyle: {
          width: 280,
          backgroundColor: "#fff", // Solid background for clarity
        },
        sceneContainerStyle: {
          backgroundColor: "#f8fafc",
        },
        headerLeft: () =>
          navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingHorizontal: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-left" size={24} color="#0f172a" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.toggleDrawer()}
              style={{ paddingHorizontal: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="menu" size={24} color="#0f172a" />
            </TouchableOpacity>
          ),
        headerRight: () =>
          route.name === "Settings" ? null : (
            <TouchableOpacity
              onPress={() => navigation.navigate("Settings")}
              style={{ paddingHorizontal: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="cog-outline" size={26} color="#0f172a" />
            </TouchableOpacity>
          ),
      })}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen
        name="Patients"
        component={withPermissionGuard(PatientListScreen, "patients")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Appointments"
        component={withPermissionGuard(AppointmentScreen, "appointments")}
      />
      <Drawer.Screen
        name="Treatment Charges"
        component={withPermissionGuard(TreatmentChargesMaster, "treatment_charges")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Patient Treatment"
        component={withPermissionGuard(PatientTreatmentDetails, "patient_treatment")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Treatment History"
        component={withPermissionGuard(TreatmentHistoryScreen, "patient_treatment")}
      />
      <Drawer.Screen
        name="Billing"
        component={withPermissionGuard(BillingScreen, "patient_treatment")}
        options={{ headerShown: false }}
      />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen
        name="Manage Users"
        component={withRoleGuard(UserManagementScreen, ["admin"])}
      />
      <Drawer.Screen
        name="Menu Rights"
        component={withRoleGuard(MenuRightsScreen, ["admin"])}
      />
      <Drawer.Screen
        name="Designation Master"
        component={withRoleGuard(DesignationMaster, ["admin"])}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Referral Type Master"
        component={withRoleGuard(ReferralTypeMaster, ["admin"])}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Expense Master"
        component={withRoleGuard(ExpenseMaster, ["admin"])}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="Office Expenses"
        component={withRoleGuard(OfficeExpensesScreen, ["admin"])}
        options={{ headerShown: false }}
      />
    </Drawer.Navigator>
  );
}

/* =========================================================
   ✅ Stack Navigator
========================================================= */
function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Home"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Registration"
        component={PatientProfileScreen}
        options={{ title: "Patient Registration" }}
      />
    </Stack.Navigator>
  );
}

export default AppNavigator;

/* =========================================================
   ✅ Styles
========================================================= */
const styles = StyleSheet.create({
  profileBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  adminText: {
    fontSize: 18,
    fontWeight: "800",
  },
  roleText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },

  deniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
  },
  deniedText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
});

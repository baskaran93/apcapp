import React, { useCallback, useContext, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { ThemeContext } from "../theme/ThemeContext";
import { getPermissionsMatrix, updatePermission } from "../services/api";

const ROLES = ["doctor", "receptionist"];
const MENUS = [
  { key: "patients", label: "Patients", icon: "account-group" },
  { key: "appointments", label: "Appointments", icon: "calendar-clock" },
  { key: "treatment_charges", label: "Treatment Charges", icon: "cash-multiple" },
  { key: "patient_treatment", label: "Patient Treatment", icon: "medical-bag" },
];
const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_add", label: "Add" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
];

function notify(title, message) {
  if (Platform.OS === "web") window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

const MenuRightsScreen = () => {
  const { theme, mode } = useContext(ThemeContext);
  const isDark = mode === "dark";

  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  const rowKey = (role, menu) => `${role}:${menu}`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPermissionsMatrix();
      if (res.ok) {
        const byKey = {};
        for (const row of res.data?.data || []) {
          byKey[rowKey(row.role, row.menu)] = row;
        }
        setMatrix(byKey);
      }
    } catch (e) {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = async (role, menu, actionKey) => {
    const key = rowKey(role, menu);
    const current = matrix[key] || {
      role,
      menu,
      can_view: false,
      can_add: false,
      can_edit: false,
      can_delete: false,
    };
    const updated = { ...current, [actionKey]: !current[actionKey] };

    // Optimistic update
    setMatrix((prev) => ({ ...prev, [key]: updated }));
    setSavingKey(key + actionKey);

    try {
      const res = await updatePermission(updated);
      if (!res.ok) {
        // revert on failure
        setMatrix((prev) => ({ ...prev, [key]: current }));
        notify("Error", res.data?.detail || "Failed to update permission.");
      }
    } catch (e) {
      setMatrix((prev) => ({ ...prev, [key]: current }));
      notify("Network Error", "Unable to connect to server");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.hint, { color: theme.subText }]}>
          Admin always has full access. Configure what Doctor and Receptionist accounts
          can view, add, edit, or delete in each area below.
        </Text>

        {ROLES.map((role) => (
          <View key={role} style={{ marginTop: 18 }}>
            <Text style={[styles.roleTitle, { color: theme.text }]}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Text>

            {MENUS.map((menu) => {
              const key = rowKey(role, menu.key);
              const row = matrix[key] || {};
              return (
                <View
                  key={menu.key}
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.menuHeader}>
                    <Icon name={menu.icon} size={18} color={theme.primary} />
                    <Text style={[styles.menuLabel, { color: theme.text }]}>{menu.label}</Text>
                  </View>

                  <View style={styles.actionsRow}>
                    {ACTIONS.map((action) => {
                      const busy = savingKey === key + action.key;
                      return (
                        <View key={action.key} style={styles.actionCol}>
                          <Text style={[styles.actionLabel, { color: theme.subText }]}>{action.label}</Text>
                          <Switch
                            value={!!row[action.key]}
                            onValueChange={() => toggle(role, menu.key, action.key)}
                            disabled={busy}
                            trackColor={{ false: isDark ? "#334155" : "#e5e7eb", true: theme.primary }}
                            thumbColor="#fff"
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MenuRightsScreen;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { fontSize: 13, lineHeight: 19 },
  roleTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  menuLabel: { fontSize: 15, fontWeight: "700" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionCol: { alignItems: "center", gap: 6 },
  actionLabel: { fontSize: 11, fontWeight: "700" },
});

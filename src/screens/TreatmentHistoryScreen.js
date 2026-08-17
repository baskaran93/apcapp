import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons as Icon } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { ThemeContext } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { getAllTreatmentHistory, deleteTreatment } from "../services/api";

function notify(title, message) {
  if (Platform.OS === "web") window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

const TreatmentHistoryScreen = () => {
  const navigation = useNavigation();
  const { theme, mode } = useContext(ThemeContext);
  const { permissions } = useContext(AuthContext);
  const isDark = mode === "dark";
  const canDelete = hasPermission(permissions, "patient_treatment", "delete");
  const canEdit = hasPermission(permissions, "patient_treatment", "edit");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllTreatmentHistory();
      if (res.ok) {
        setRecords(res.data?.data || []);
      } else {
        notify("Error", res.data?.detail || "Failed to load treatment history.");
      }
    } catch (e) {
      notify("Network Error", "Unable to fetch treatment history");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter(
      (r) =>
        (r.patient_name || "").toLowerCase().includes(q) ||
        (r.diagnosis || "").toLowerCase().includes(q) ||
        (r.doctor_name || "").toLowerCase().includes(q) ||
        (r.patient_id || "").toLowerCase().includes(q)
    );
  }, [records, search]);

  const handleDelete = (item) => {
    const doDelete = async () => {
      const res = await deleteTreatment(item.id);
      if (res.ok) loadHistory();
      else notify("Error", res.data?.detail || "Failed to delete treatment record.");
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete this treatment record for ${item.patient_name || item.patient_id}?`)) doDelete();
    } else {
      Alert.alert(
        "Delete Treatment",
        `Delete this treatment record for ${item.patient_name || item.patient_id}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const goToPatient = (item) => {
    navigation.navigate("Patient Treatment", {
      patient: { id: item.patient_id, name: item.patient_name, phone_number: item.patient_phone },
    });
  };

  const goToEdit = (item) => {
    navigation.navigate("Patient Treatment", {
      patient: { id: item.patient_id, name: item.patient_name, phone_number: item.patient_phone },
      editingSession: item,
    });
  };

  const renderItem = ({ item }) => {
    const total = (item.items || []).reduce((s, it) => s + (it.cost || 0), 0);
    const expanded = expandedId === item.id;

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity onPress={() => goToPatient(item)} activeOpacity={0.8}>
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.patientName, { color: theme.text }]}>
                {item.patient_name || item.patient_id || "Unknown Patient"}
              </Text>
              <Text style={[styles.subText, { color: theme.subText }]}>
                {new Date(item.treatment_date).toLocaleDateString()}
                {item.doctor_name ? ` • Dr. ${item.doctor_name}` : ""}
              </Text>
            </View>
            <Text style={[styles.cost, { color: theme.primary }]}>₹{total}</Text>
          </View>

          {!!item.diagnosis && (
            <Text style={[styles.diagnosis, { color: theme.text }]} numberOfLines={2}>
              {item.diagnosis}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => setExpandedId(expanded ? null : item.id)} style={styles.actionChip}>
            <Icon name={expanded ? "chevron-up-outline" : "list-outline"} size={14} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
              {expanded ? "Hide items" : `${item.items?.length || 0} item(s)`}
            </Text>
          </TouchableOpacity>

          {canEdit && (
            <TouchableOpacity onPress={() => goToEdit(item)} style={[styles.actionChip, { backgroundColor: theme.primary + "18" }]}>
              <Icon name="create-outline" size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>Edit</Text>
            </TouchableOpacity>
          )}

          {canDelete && (
            <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionChip, { backgroundColor: "#ef444418" }]}>
              <Icon name="trash-outline" size={14} color="#ef4444" />
              <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700", marginLeft: 4 }}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {expanded && (
          <View style={[styles.itemsBox, { borderColor: theme.border }]}>
            {(item.items || []).map((it, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={{ color: theme.text, flex: 1 }}>{it.treatment_name}</Text>
                <Text style={{ color: theme.subText, fontWeight: "700" }}>₹{it.cost}</Text>
              </View>
            ))}
            {!!item.notes && (
              <Text style={[styles.notes, { color: theme.subText }]}>Notes: {item.notes}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Icon name="search-outline" size={18} color={theme.subText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by patient, diagnosis, or doctor..."
            placeholderTextColor={theme.subText}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Icon name="close-circle" size={18} color={theme.subText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40, color: theme.subText }}>
              No treatment history found.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default TreatmentHistoryScreen;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  patientName: { fontSize: 15, fontWeight: "800" },
  subText: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  cost: { fontSize: 16, fontWeight: "800" },
  diagnosis: { fontSize: 13, marginTop: 8 },

  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,0.10)",
  },

  itemsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  notes: { fontSize: 12, fontStyle: "italic", marginTop: 6 },
});

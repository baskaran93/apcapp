import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getPatients } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const HIDDEN_COLUMNS = ["id", "photo", "created_at", "updated_at"];

const formatHeader = (key) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const getColumnWidth = (key, data) => {
  let maxLength = key.length;
  data.forEach((item) => {
    const value = item[key] ? item[key].toString() : "";
    if (value.length > maxLength) maxLength = value.length;
  });
  const width = maxLength * 8 + 40;
  return Math.min(Math.max(width, 110), 260);
};

const PatientListScreen = () => {
  const navigation = useNavigation();
  const { theme, mode } = useContext(ThemeContext);

  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState([]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await getPatients();
      let data = [];

      if (response.ok) {
        if (Array.isArray(response.data)) data = response.data;
        else if (response.data.results) data = response.data.results;
        else if (response.data.patients) data = response.data.patients;
        else if (response.data.data) data = response.data.data;
      } else {
        Alert.alert("Error", "Failed to load patient list");
      }

      setPatients(data);
      setFiltered(data);

      if (data.length > 0) {
        const keys = Object.keys(data[0]).filter(
          (key) => !HIDDEN_COLUMNS.includes(key)
        );

        const cols = keys.map((key) => ({
          key,
          label: formatHeader(key),
          width: getColumnWidth(key, data),
        }));

        setColumns(cols);
      }
    } catch (error) {
      Alert.alert("Network Error", "Unable to fetch patient list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [])
  );

  const handleSearch = (text) => {
    setSearch(text);

    if (text.trim() === "") {
      setFiltered(patients);
      return;
    }

    const filteredData = patients.filter((item) =>
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(text.toLowerCase())
    );

    setFiltered(filteredData);
  };

  /* 🔥 EXPORT PATIENT LIST AS CSV */
  const handleExport = async () => {
    if (patients.length === 0) {
      Alert.alert("No Data", "No patients to export");
      return;
    }
  
    try {
      const headers = columns.map((c) => c.label).join(",");
      const rows = patients.map((item) =>
        columns.map((c) => `"${item[c.key] ?? ""}"`).join(",")
      );
  
      const csv = [headers, ...rows].join("\n");
      const fileName = `patients_${Date.now()}.csv`;
  
      if (Platform.OS === "web") {
        // 🖥️ WEB DOWNLOAD (NO FileSystem)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
  
        Alert.alert("Success", "Patient list exported successfully");
      } else {
        // 📱 MOBILE EXPORT (ANDROID / IOS)
        const fileUri = FileSystem.documentDirectory + fileName;
  
        await FileSystem.writeAsStringAsync(fileUri, csv); // no EncodingType needed
  
        await Sharing.shareAsync(fileUri);
  
        Alert.alert("Success", "Patient list exported successfully");
      }
    } catch (err) {
      console.error("EXPORT ERROR 👉", err);
      Alert.alert("Error", "Failed to export patient list");
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.text, marginTop: 10 }}>
          Loading patients...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.card}
      />

      {/* 🔹 HEADER WITH EXPORT */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Patients
        </Text>

        {/* 📤 EXPORT BUTTON */}
        <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
          <Icon name="download-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* BODY */}
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* 🔍 SEARCH */}
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Icon name="search-outline" size={18} color={theme.subText} />
          <TextInput
            placeholder="Search patient..."
            placeholderTextColor={theme.subText}
            value={search}
            onChangeText={handleSearch}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        {/* TABLE */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header Row */}
            <View
              style={[
                styles.tableHeader,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={[
                    styles.headerCell,
                    { width: col.width, color: theme.text },
                  ]}
                >
                  {col.label}
                </Text>
              ))}
            </View>

            {/* Data Rows (NO NAVIGATION NOW) */}
            <FlatList
              data={filtered}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.rowCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  {columns.map((col) => (
                    <Text
                      key={col.key}
                      style={[
                        styles.cell,
                        { width: col.width, color: theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item[col.key]}
                    </Text>
                  ))}
                </View>
              )}
            />
          </View>
        </ScrollView>
      </View>

      {/* 🔥 FLOATING ADD BUTTON (ONLY THIS OPENS ADD SCREEN) */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate("Patient Profile")}
        activeOpacity={0.85}
      >
        <Icon name="add" size={34} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PatientListScreen;

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    elevation: 4,
  },

  backBtn: {
    position: "absolute",
    left: 15,
    padding: 6,
  },

  exportBtn: {
    position: "absolute",
    right: 15,
    padding: 6,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
  },

  container: {
    flex: 1,
    padding: 15,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 15,
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },

  headerCell: {
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 10,
  },

  rowCard: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    elevation: 2,
  },

  cell: {
    fontSize: 13,
    paddingHorizontal: 10,
  },

  fab: {
    position: "absolute",
    bottom: 25,
    right: 25,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});

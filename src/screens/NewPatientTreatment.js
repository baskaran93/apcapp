import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  FlatList,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getPatients, getTreatmentCharges, registerTreatment } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";

const NewPatientTreatment = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, mode } = useContext(ThemeContext);

  const initialPatient = route.params?.patient || null;

  const [patients, setPatients] = useState([]);
  const [treatmentMaster, setTreatmentMaster] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & list helpers (behave like PatientListScreen)
  const PAGE_SIZE = 10;
  const [allPatients, setAllPatients] = useState([]);
  const [page, setPage] = useState(1);

  // Column visibility & export (match PatientListScreen)
  const HIDDEN_COLUMNS = ["id", "photo", "created_at", "updated_at"];

  const formatHeader = (key) => key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const safeString = (val) => (val === null || val === undefined ? "" : String(val));

  const [columns, setColumns] = useState([]);
  const [visibleCols, setVisibleCols] = useState([]);
  const [showColsModal, setShowColsModal] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState(initialPatient);
  const [patientSearch, setPatientSearch] = useState("");
  const [filteredPatients, setFilteredPatients] = useState([]);

  const [diagnosis, setDiagnosis] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTreatments, setSelectedTreatments] = useState([]);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (patientSearch.trim() === "") setFilteredPatients(patients);
    else {
      const s = patientSearch.toLowerCase();
      setFilteredPatients(
        patients.filter(
          (p) => (p.name && p.name.toLowerCase().includes(s)) || (p.id && p.id.toString().includes(s)) || (p.phone_number && p.phone_number.includes(s))
        )
      );
    }
  }, [patientSearch, patients]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [patientsRes, chargesRes] = await Promise.all([getPatients(), getTreatmentCharges()]);

      if (patientsRes.ok) {
        let data = [];
        if (Array.isArray(patientsRes.data)) data = patientsRes.data;
        else if (patientsRes.data.data) data = patientsRes.data.data;
        setAllPatients(data);
        setPatients(data);
        setFilteredPatients(data);

        // Detect columns from first row (same behaviour as PatientListScreen)
        if (data.length > 0 && columns.length === 0) {
          const keys = Object.keys(data[0]).filter((k) => !HIDDEN_COLUMNS.includes(k));
          const cols = keys.map((k) => ({ key: k, label: formatHeader(k) }));
          setColumns(cols);
          setVisibleCols(keys);
        }
      }

      if (chargesRes.ok) {
        setTreatmentMaster(chargesRes.data);
      }
    } catch (err) {
      console.error("NEW TREAT LOAD ERROR", err);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const addTreatment = (item) => {
    if (!selectedTreatments.find((t) => t.id === item.id)) {
      setSelectedTreatments([...selectedTreatments, item]);
    }
    setShowTreatmentModal(false);
  };

  const removeTreatment = (id) => setSelectedTreatments(selectedTreatments.filter((t) => t.id !== id));

  const toggleColumn = (key) => {
    setVisibleCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const exportToCSV = async () => {
    if (filteredPatients.length === 0) {
      Alert.alert("No Data", "No patients to export");
      return;
    }

    try {
      const activeCols = columns.filter((c) => visibleCols.includes(c.key));

      const headers = activeCols.map((c) => c.label).join(",");
      const rows = filteredPatients.map((item) =>
        activeCols
          .map((c) => `"${safeString(item[c.key]).replace(/"/g, '""')}"`)
          .join(",")
      );

      const csv = [headers, ...rows].join("\n");

      // WEB DOWNLOAD
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "patients.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        return;
      }

      // MOBILE SHARE
      const fileUri = FileSystem.documentDirectory + "patients.csv";

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Patients",
      });
    } catch (err) {
      Alert.alert("Error", "Failed to export file");
    }
  };

  const handleSave = async () => {
    if (!selectedPatient) return Alert.alert("Validation", "Please select a patient.");
    if (!diagnosis.trim()) return Alert.alert("Validation", "Please enter diagnosis.");

    try {
      setSubmitting(true);
      const items = selectedTreatments.map((t) => ({ treatment_name: t.treatment_name, cost: t.cost }));
      const payload = {
        patient_id: selectedPatient.id,
        diagnosis,
        treatment_plan: "Master-Detail Visit",
        doctor_name: doctorName || "Self",
        notes,
        items,
      };

      const response = await registerTreatment(payload);
      if (response.ok) {
        Alert.alert("Success", "Treatment recorded.");
        // notify parent screen to reload history
        navigation.navigate("Home", { screen: "Patient Treatment", params: { newTreatment: true, patient: selectedPatient } });
      } else {
        const err = response.data?.detail || response.data?.message || "Failed to register treatment.";
        Alert.alert("Error", err);
      }
    } catch (err) {
      console.error("SAVE NEW TREATMENT ERR", err);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New Treatment</Text>
        <TouchableOpacity onPress={handleSave} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color={theme.primary} /> : <Icon name="checkmark-done" size={26} color={theme.primary} />}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="always">
        {/* Patient selection (paginated list like PatientListScreen) */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Select Patient *</Text>

          <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Icon name="search" size={20} color={theme.subText} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search patients by name / id / phone"
              placeholderTextColor={theme.subText}
              value={patientSearch}
              onChangeText={(text) => setPatientSearch(text)}
            />
            {patientSearch.length > 0 && (
              <TouchableOpacity onPress={() => setPatientSearch("")}>
                <Icon name="close-circle" size={18} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>

          {/* List header + actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ flex: 3, fontWeight: '700', color: theme.text }}>Name</Text>
              <Text style={{ flex: 1, fontWeight: '700', color: theme.text }}>ID</Text>
              <Text style={{ flex: 2, fontWeight: '700', color: theme.text }}>Phone</Text>
              <Text style={{ width: 90, textAlign: 'right', fontWeight: '700', color: theme.text }}>Action</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setShowColsModal(true)} style={{ padding: 8 }}>
                <Icon name="options" size={20} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={exportToCSV} style={{ padding: 8 }}>
                <Icon name="download" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rows */}
          {filteredPatients.length === 0 ? (
            <View style={{ padding: 16 }}><Text style={{ color: theme.subText }}>No patients found.</Text></View>
          ) : (
            <View>
              {filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'center' }}>
                  <View style={{ flex: 3 }}>
                    <Text style={{ color: theme.text, fontWeight: '600' }}>{p.name}</Text>
                    <Text style={{ color: theme.subText, fontSize: 12 }}>{p.city}</Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.subText }}>{p.id}</Text>
                  <Text style={{ flex: 2, color: theme.subText }}>{p.phone_number}</Text>
                  <View style={{ width: 90, alignItems: 'flex-end' }}>
                    <TouchableOpacity onPress={() => { setSelectedPatient(p); setPatientSearch(""); }} style={[styles.addBtn, { backgroundColor: theme.primary + '10' }]}>
                      <Text style={{ color: theme.primary, fontWeight: '600' }}>Select</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Pagination */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, alignItems: 'center' }}>
                <TouchableOpacity disabled={page === 1} onPress={() => setPage(1)} style={{ padding: 8 }}>
                  <Text style={{ color: page === 1 ? '#999' : theme.primary }}>First</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={page === 1} onPress={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: 8 }}>
                  <Text style={{ color: page === 1 ? '#999' : theme.primary }}>Prev</Text>
                </TouchableOpacity>
                <Text style={{ marginHorizontal: 8, color: theme.text }}>Page {page} of {Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE))}</Text>

                {/* Export button (small) */}
                <TouchableOpacity onPress={exportToCSV} style={{ padding: 8, marginLeft: 12 }}>
                  <Text style={{ color: theme.primary }}>Export CSV</Text>
                </TouchableOpacity>

                <TouchableOpacity disabled={page === Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE))} onPress={() => setPage((p) => p + 1)} style={{ padding: 8 }}>
                  <Text style={{ color: page === Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE)) ? '#999' : theme.primary }}>Next</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={page === Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE))} onPress={() => setPage(Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE)))} style={{ padding: 8 }}>
                  <Text style={{ color: page === Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE)) ? '#999' : theme.primary }}>Last</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* DIAGNOSIS */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Diagnosis *</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} placeholder="Enter diagnosis..." placeholderTextColor={theme.subText} value={diagnosis} onChangeText={setDiagnosis} />
        </View>

        {/* Treatments */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={[styles.label, { color: theme.text }]}>Treatments</Text>
            <TouchableOpacity onPress={() => setShowTreatmentModal(true)} style={[styles.addBtn, { backgroundColor: theme.primary + '15' }]}>
              <Icon name="add-circle" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: '600', marginLeft: 4 }}>Add Treatment</Text>
            </TouchableOpacity>
          </View>

          {selectedTreatments.length === 0 ? (
            <View style={[styles.emptyContainer, { borderColor: theme.border }]}>
              <Icon name="medkit-outline" size={40} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>No treatments added yet.</Text>
            </View>
          ) : (
            <View style={styles.treatmentList}>
              {selectedTreatments.map((t) => (
                <View key={t.id} style={[styles.treatmentItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.treatmentName, { color: theme.text }]}>{t.treatment_name}</Text>
                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>₹{t.cost}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeTreatment(t.id)} style={styles.deleteBtn}><Icon name="close-circle" size={22} color="#ff4444" /></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Physiotherapist Name </Text>
          <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]} placeholder="Attending Doctor..." placeholderTextColor={theme.subText} value={doctorName} onChangeText={setDoctorName} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.text }]}>Notes</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border, height: 100 }]} placeholder="Observations or follow-up instructions..." placeholderTextColor={theme.subText} value={notes} onChangeText={setNotes} multiline />
        </View>

        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={handleSave} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Save Treatment</Text>}
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>

      {/* TREATMENT MODAL */}
      <Modal visible={showTreatmentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Treatment</Text>
              <TouchableOpacity onPress={() => setShowTreatmentModal(false)}><Icon name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <FlatList
              data={treatmentMaster}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.listItem, { borderBottomColor: theme.border }]} onPress={() => addTreatment(item)}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>{item.treatment_name}</Text>
                  <Text style={{ color: theme.primary, fontWeight: "600" }}>₹{item.cost}</Text>
                </TouchableOpacity>
              )}
            />

            {/* helper functions/modal logic */}
          </View>
        </View>
      </Modal>

      {/* Columns modal (top-level) */}
      <Modal visible={showColsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Columns</Text>
              <TouchableOpacity onPress={() => setShowColsModal(false)}><Icon name="close" size={24} color={theme.text} /></TouchableOpacity>
            </View>

            {columns.map((c) => (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={{ color: theme.text }}>{c.label}</Text>
                <Switch value={visibleCols.includes(c.key)} onValueChange={() => toggleColumn(c.key)} />
              </View>
            ))}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    elevation: 3,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  backBtn: { padding: 5 },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  selector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
  },
  flexRow: { flexDirection: "row", alignItems: "center" },
  selectedText: { fontSize: 16, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    marginTop: 5,
  },
  emptyText: { textAlign: "center", marginTop: 10, fontSize: 14 },
  treatmentList: { marginTop: 5 },
  treatmentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  treatmentName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
  deleteBtn: { padding: 4 },
  mainBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mainBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: "90%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
    height: 45,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  listItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  initialCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  initialText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    elevation: 2,
  },
  changeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dropdownContainer: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 250,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 5,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
    marginBottom: 15,
    elevation: 1,
  },
  sessionInfo: {
    marginBottom: 10,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sessionDiag: {
    fontSize: 13,
    fontWeight: "600",
  },
  itemsTable: {
    marginTop: 5,
  },
  tableSubHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 4,
    marginBottom: 4,
  },
  headCol: {
    fontSize: 11,
    fontWeight: "bold",
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  rowCol: {
    fontSize: 12,
    flex: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 6,
  },
  totalText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  totalVal: {
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default NewPatientTreatment;

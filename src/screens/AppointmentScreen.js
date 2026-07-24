// src/screens/AppointmentScreen.js
import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
const MODAL_SCROLL_HEIGHT = MODAL_MAX_HEIGHT - 90;
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemeContext } from "../theme/ThemeContext";
import {
  getPatients,
  bookAppointment,
  getAppointments,
  updateAppointment,
  cancelAppointment,
} from "../services/api";

const pad = (n) => String(n).padStart(2, "0");

const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Display time as 12-hr with AM/PM, e.g. "05:30 PM"
const toTimeStr12 = (d) => {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${pad(h)}:${pad(m)} ${ap}`;
};

// Parse "hh:mm AM/PM" -> "HH:MM" (24-hr) for building the appointment_date, or null if invalid
const to24Hour = (timeStr) => {
  const m = (timeStr || "").trim().match(/^(\d{1,2}):([0-5]\d)\s?(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (h < 1 || h > 12) return null;
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${pad(h)}:${min}`;
};

const isValidTime12 = (timeStr) => to24Hour(timeStr) !== null;

const DATE_CHIPS = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "+2 Days", offset: 2 },
];

const TIME_CHIPS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:30 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:30 PM",
];

const STATUS_COLORS = {
  Scheduled: "#3b82f6",
  Completed: "#22c55e",
  Cancelled: "#ef4444",
};

export default function AppointmentScreen() {
  const navigation = useNavigation();
  const { theme, mode } = useContext(ThemeContext);
  const isDark = mode === "dark";

  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showBookModal, setShowBookModal] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);
  const [activeAppt, setActiveAppt] = useState(null);

  // Booking form state
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formDate, setFormDate] = useState(toDateStr(new Date()));
  const [formTime, setFormTime] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAppointments = useCallback(async (date) => {
    try {
      const res = await getAppointments({ date });
      if (res.ok) {
        const data = res.data?.data || [];
        setAppointments(data);
      } else {
        setAppointments([]);
      }
    } catch (e) {
      console.error("LOAD APPOINTMENTS ERROR", e);
      setAppointments([]);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const res = await getPatients();
      if (res.ok) {
        let data = [];
        if (Array.isArray(res.data)) data = res.data;
        else if (res.data?.data) data = res.data.data;
        setPatients(data);
      }
    } catch (e) {
      console.error("LOAD PATIENTS ERROR", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAppointments(selectedDate), loadPatients()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadAppointments(selectedDate);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments(selectedDate);
    }, [selectedDate, loadAppointments])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments(selectedDate);
    setRefreshing(false);
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.phone_number || "").includes(q) ||
          String(p.id || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [patientSearch, patients]);

  const resetBookForm = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setFormDate(toDateStr(new Date()));
    setFormTime("");
    setDoctorName("");
    setNotes("");
  };

  const openBookModal = () => {
    resetBookForm();
    setFormDate(selectedDate);
    setShowBookModal(true);
  };

  const handleBook = async () => {
    if (!selectedPatient) {
      Alert.alert("Validation", "Please select a patient.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      Alert.alert("Validation", "Please enter a valid date as YYYY-MM-DD.");
      return;
    }
    const time24 = to24Hour(formTime);
    if (!time24) {
      Alert.alert("Validation", "Please enter a valid time as hh:mm AM/PM (e.g. 05:30 PM).");
      return;
    }

    try {
      setSubmitting(true);
      const appointment_date = `${formDate}T${time24}:00`;
      const res = await bookAppointment({
        patient_id: selectedPatient.id,
        appointment_date,
        doctor_name: doctorName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.ok) {
        setShowBookModal(false);
        resetBookForm();
        Alert.alert("Success", "Appointment booked successfully.");
        loadAppointments(selectedDate);
      } else {
        const msg = res.data?.detail || res.data?.message || "Failed to book appointment.";
        Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    } catch (e) {
      console.error("BOOK APPOINTMENT ERROR", e);
      Alert.alert("Error", "An unexpected error occurred while booking.");
    } finally {
      setSubmitting(false);
    }
  };

  const openFixModal = (appt) => {
    setActiveAppt(appt);
    const d = new Date(appt.appointment_date);
    setFormDate(toDateStr(d));
    setFormTime(toTimeStr12(d));
    setDoctorName(appt.doctor_name || "");
    setNotes(appt.notes || "");
    setShowFixModal(true);
  };

  const handleFixSave = async () => {
    if (!activeAppt) return;
    const time24 = to24Hour(formTime);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate) || !time24) {
      Alert.alert("Validation", "Please enter a valid date and time (hh:mm AM/PM).");
      return;
    }
    try {
      setSubmitting(true);
      const appointment_date = `${formDate}T${time24}:00`;
      const res = await updateAppointment(activeAppt.id, {
        appointment_date,
        doctor_name: doctorName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.ok) {
        setShowFixModal(false);
        setActiveAppt(null);
        loadAppointments(selectedDate);
      } else {
        Alert.alert("Error", "Failed to update appointment.");
      }
    } catch (e) {
      console.error("FIX APPOINTMENT ERROR", e);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (appt, status) => {
    try {
      const res = await updateAppointment(appt.id, { status });
      if (res.ok) {
        loadAppointments(selectedDate);
      } else {
        Alert.alert("Error", "Failed to update status.");
      }
    } catch (e) {
      console.error("STATUS UPDATE ERROR", e);
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  const handleCancel = (appt) => {
    Alert.alert("Cancel Appointment", `Cancel appointment for ${appt.patient_name || "this patient"}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await cancelAppointment(appt.id);
            if (res.ok) {
              loadAppointments(selectedDate);
            } else {
              Alert.alert("Error", "Failed to cancel appointment.");
            }
          } catch (e) {
            console.error("CANCEL APPOINTMENT ERROR", e);
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }) => {
    const d = new Date(item.appointment_date);
    const statusColor = STATUS_COLORS[item.status] || "#94a3b8";

    return (
      <View
        style={[
          styles.apptCard,
          {
            backgroundColor: theme.card,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
          },
        ]}
      >
        <View style={styles.apptTopRow}>
          <View style={styles.apptTimeWrap}>
            <Icon name="time-outline" size={16} color={theme.primary} />
            <Text style={[styles.apptTime, { color: theme.text }]}>{toTimeStr12(d)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={[styles.apptPatient, { color: theme.text }]}>
          {item.patient_name || "Unknown Patient"}
        </Text>
        <Text style={[styles.apptSub, { color: theme.subText }]}>
          {item.patient_phone || ""} {item.doctor_name ? `• Dr. ${item.doctor_name}` : ""}
        </Text>
        {!!item.notes && (
          <Text style={[styles.apptNotes, { color: theme.subText }]} numberOfLines={2}>
            {item.notes}
          </Text>
        )}

        {item.status === "Scheduled" && (
          <View style={styles.apptActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary + "18" }]}
              onPress={() => openFixModal(item)}
            >
              <Icon name="create-outline" size={16} color={theme.primary} />
              <Text style={[styles.actionBtnText, { color: theme.primary }]}>Fix / Reschedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#22c55e18" }]}
              onPress={() => handleStatusChange(item, "Completed")}
            >
              <Icon name="checkmark-circle-outline" size={16} color="#22c55e" />
              <Text style={[styles.actionBtnText, { color: "#22c55e" }]}>Complete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#ef444418" }]}
              onPress={() => handleCancel(item)}
            >
              <Icon name="close-circle-outline" size={16} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={isDark ? ["#0b1220", "#0f172a", "#020617"] : ["#f8fafc", "#eef2ff", "#f1f5f9"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Appointments</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>
              Daily appointment booking & fixing
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
            onPress={openBookModal}
          >
            <Icon name="add" size={20} color="#fff" />
            <Text style={styles.bookBtnText}>Book</Text>
          </TouchableOpacity>
        </View>

        {/* Date chips */}
        <View style={styles.chipRow}>
          {DATE_CHIPS.map((c) => {
            const d = new Date();
            d.setDate(d.getDate() + c.offset);
            const dateStr = toDateStr(d);
            const active = selectedDate === dateStr;
            return (
              <TouchableOpacity
                key={c.label}
                onPress={() => setSelectedDate(dateStr)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
                  },
                ]}
              >
                <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "700", fontSize: 13 }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.center}>
            <Icon name="calendar-outline" size={48} color={theme.subText} />
            <Text style={{ color: theme.subText, marginTop: 12 }}>
              No appointments for {selectedDate}
            </Text>
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderAppointment}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </SafeAreaView>

      {/* Book Appointment Modal */}
      <Modal visible={showBookModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Book Appointment</Text>
              <TouchableOpacity onPress={() => setShowBookModal(false)}>
                <Icon name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: MODAL_SCROLL_HEIGHT }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
            >
              <BookForm
                theme={theme}
                isDark={isDark}
                selectedPatient={selectedPatient}
                setSelectedPatient={setSelectedPatient}
                patientSearch={patientSearch}
                setPatientSearch={setPatientSearch}
                filteredPatients={filteredPatients}
                formDate={formDate}
                setFormDate={setFormDate}
                formTime={formTime}
                setFormTime={setFormTime}
                doctorName={doctorName}
                setDoctorName={setDoctorName}
                notes={notes}
                setNotes={setNotes}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleBook}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Book Appointment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fix / Reschedule Modal */}
      <Modal visible={showFixModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Fix Appointment{activeAppt ? ` - ${activeAppt.patient_name || ""}` : ""}
              </Text>
              <TouchableOpacity onPress={() => setShowFixModal(false)}>
                <Icon name="close-circle" size={28} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: MODAL_SCROLL_HEIGHT }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
            >
              <DateTimeFields
                theme={theme}
                isDark={isDark}
                formDate={formDate}
                setFormDate={setFormDate}
                formTime={formTime}
                setFormTime={setFormTime}
              />

              <FieldLabel theme={theme} label="Doctor / Physiotherapist" />
              <TextField theme={theme} isDark={isDark} value={doctorName} onChangeText={setDoctorName} placeholder="Doctor name" />

              <FieldLabel theme={theme} label="Notes" />
              <TextField theme={theme} isDark={isDark} value={notes} onChangeText={setNotes} placeholder="Notes" />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleFixSave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FieldLabel({ theme, label }) {
  return <Text style={[styles.fieldLabel, { color: theme.subText }]}>{label}</Text>;
}

function TextField({ theme, isDark, ...props }) {
  return (
    <View
      style={[
        styles.inputWrap,
        { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" },
      ]}
    >
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.textInput, { color: theme.text }]}
        {...props}
      />
    </View>
  );
}

function DateTimeFields({ theme, isDark, formDate, setFormDate, formTime, setFormTime }) {
  return (
    <>
      <FieldLabel theme={theme} label="Date (YYYY-MM-DD)" />
      <TextField theme={theme} isDark={isDark} value={formDate} onChangeText={setFormDate} placeholder="2026-07-23" />
      <View style={styles.chipRowSmall}>
        {DATE_CHIPS.map((c) => {
          const d = new Date();
          d.setDate(d.getDate() + c.offset);
          const dateStr = toDateStr(d);
          return (
            <TouchableOpacity
              key={c.label}
              onPress={() => setFormDate(dateStr)}
              style={[styles.miniChip, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }]}
            >
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FieldLabel theme={theme} label="Time (hh:mm AM/PM)" />
      <TextField theme={theme} isDark={isDark} value={formTime} onChangeText={setFormTime} placeholder="10:00 AM" />
      <View style={styles.chipRowSmall}>
        {TIME_CHIPS.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setFormTime(t)}
            style={[styles.miniChip, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }]}
          >
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function BookForm({
  theme,
  isDark,
  selectedPatient,
  setSelectedPatient,
  patientSearch,
  setPatientSearch,
  filteredPatients,
  formDate,
  setFormDate,
  formTime,
  setFormTime,
  doctorName,
  setDoctorName,
  notes,
  setNotes,
}) {
  return (
    <View>
      <FieldLabel theme={theme} label="Patient" />
      {selectedPatient ? (
        <View style={[styles.selectedPatientRow, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{selectedPatient.name}</Text>
            <Text style={{ color: theme.subText, fontSize: 12 }}>
              {selectedPatient.id} • {selectedPatient.phone_number}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedPatient(null)}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextField
            theme={theme}
            isDark={isDark}
            value={patientSearch}
            onChangeText={setPatientSearch}
            placeholder="Search patient by name / phone / ID"
          />
          {filteredPatients.length > 0 && (
            <View style={styles.searchResults}>
              {filteredPatients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.searchResultItem}
                  onPress={() => {
                    setSelectedPatient(p);
                    setPatientSearch("");
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: "600" }}>{p.name}</Text>
                  <Text style={{ color: theme.subText, fontSize: 12 }}>{p.phone_number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <DateTimeFields
        theme={theme}
        isDark={isDark}
        formDate={formDate}
        setFormDate={setFormDate}
        formTime={formTime}
        setFormTime={setFormTime}
      />

      <FieldLabel theme={theme} label="Doctor / Physiotherapist" />
      <TextField theme={theme} isDark={isDark} value={doctorName} onChangeText={setDoctorName} placeholder="Doctor name" />

      <FieldLabel theme={theme} label="Notes" />
      <TextField theme={theme} isDark={isDark} value={notes} onChangeText={setNotes} placeholder="Notes" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  bookBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  apptCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      web: { boxShadow: "0px 8px 20px rgba(0,0,0,0.08)" },
    }),
  },
  apptTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  apptTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  apptTime: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  apptPatient: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  apptSub: {
    fontSize: 12,
    marginTop: 2,
  },
  apptNotes: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: "italic",
  },
  apptActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 22,
    maxHeight: MODAL_MAX_HEIGHT,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "900",
    flexShrink: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
  },
  textInput: {
    fontSize: 14,
    fontWeight: "600",
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  chipRowSmall: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedPatientRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
  },
  searchResults: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    overflow: "hidden",
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.08)",
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    marginBottom: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});

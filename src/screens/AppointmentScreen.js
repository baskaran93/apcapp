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
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

// Tracks live keyboard height so modal ScrollViews can size themselves to
// whatever space is actually left, instead of a fixed height that either
// overflows off-screen when the keyboard is up or (if made flex-based)
// collapses to zero when it isn't.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemeContext } from "../theme/ThemeContext";
import { AuthContext } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import {
  getPatients,
  bookAppointment,
  getAppointments,
  updateAppointment,
  cancelAppointment,
  getUsers,
  registerEnquiry,
  getEnquiries,
  convertEnquiryToPatient,
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

// "17 Aug · 05:30 PM" — used in the History list, which spans multiple days
const toDateTimeStr12 = (d) => {
  const datePart = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${datePart} · ${toTimeStr12(d)}`;
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
  const { permissions } = useContext(AuthContext);
  const canAdd = hasPermission(permissions, "appointments", "add");
  const canEdit = hasPermission(permissions, "appointments", "edit");
  const canDelete = hasPermission(permissions, "appointments", "delete");
  const canAddPatients = hasPermission(permissions, "patients", "add");
  const isDark = mode === "dark";

  const keyboardHeight = useKeyboardHeight();
  const modalScrollMaxHeight = keyboardHeight > 0
    ? Math.max(180, SCREEN_HEIGHT - keyboardHeight - 160)
    : MODAL_MAX_HEIGHT - 90;

  const [viewMode, setViewMode] = useState("day"); // "day" | "history"
  const [showJumpDatePicker, setShowJumpDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [historyAppointments, setHistoryAppointments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const [showBookModal, setShowBookModal] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);
  const [activeAppt, setActiveAppt] = useState(null);

  // Booking form state
  const [bookMode, setBookMode] = useState("patient"); // "patient" | "enquiry"
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [enquirySearch, setEnquirySearch] = useState("");
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [newEnquiryName, setNewEnquiryName] = useState("");
  const [newEnquiryPhone, setNewEnquiryPhone] = useState("");
  const [newEnquiryAlt, setNewEnquiryAlt] = useState("");
  const [newEnquiryReason, setNewEnquiryReason] = useState("");
  const [creatingEnquiry, setCreatingEnquiry] = useState(false);
  const [formDate, setFormDate] = useState(toDateStr(new Date()));
  const [formTime, setFormTime] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doctorUsers, setDoctorUsers] = useState([]);

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

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await getAppointments({ before_date: toDateStr(new Date()) });
      if (res.ok) {
        setHistoryAppointments(res.data?.data || []);
      } else {
        setHistoryAppointments([]);
      }
    } catch (e) {
      console.error("LOAD APPOINTMENT HISTORY ERROR", e);
      setHistoryAppointments([]);
    } finally {
      setHistoryLoading(false);
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

  const loadEnquiries = useCallback(async () => {
    try {
      const res = await getEnquiries({ status: "Open" });
      if (res.ok) {
        setEnquiries(res.data?.data || []);
      }
    } catch (e) {
      console.error("LOAD ENQUIRIES ERROR", e);
    }
  }, []);

  // Physiotherapists selectable for an appointment are Manage Users accounts
  // whose designation is "Doctor" (designation is the job title, separate
  // from the login role used for app access).
  const loadDoctorUsers = useCallback(async () => {
    try {
      const res = await getUsers();
      if (res.ok) {
        const users = res.data?.data || [];
        setDoctorUsers(users.filter((u) => (u.designation_name || "").toLowerCase().includes("doctor")));
      }
    } catch (e) {
      console.error("LOAD DOCTOR USERS ERROR", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAppointments(selectedDate), loadPatients(), loadEnquiries(), loadDoctorUsers()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    loadAppointments(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === "history") loadHistory();
  }, [viewMode, loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadAppointments(selectedDate);
      loadEnquiries();
      if (viewMode === "history") loadHistory();
    }, [selectedDate, loadAppointments, loadEnquiries, viewMode, loadHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === "history") {
      await loadHistory();
    } else {
      await loadAppointments(selectedDate);
    }
    setRefreshing(false);
  };

  // Refreshes whichever list is currently on screen (Day view or History)
  // after a booking/edit/status/convert action.
  const refreshCurrentView = useCallback(() => {
    if (viewMode === "history") {
      loadHistory();
    } else {
      loadAppointments(selectedDate);
    }
  }, [viewMode, loadHistory, loadAppointments, selectedDate]);

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

  const filteredEnquiries = useMemo(() => {
    if (!enquirySearch.trim()) return [];
    const q = enquirySearch.toLowerCase();
    return enquiries
      .filter(
        (e) =>
          (e.name || "").toLowerCase().includes(q) ||
          (e.phone_number || "").includes(q) ||
          String(e.id || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [enquirySearch, enquiries]);

  const filteredHistory = useMemo(() => {
    const sorted = [...historyAppointments].sort(
      (a, b) => new Date(b.appointment_date) - new Date(a.appointment_date)
    );
    if (!historySearch.trim()) return sorted;
    const q = historySearch.toLowerCase();
    return sorted.filter(
      (a) =>
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.patient_phone || "").includes(q)
    );
  }, [historyAppointments, historySearch]);

  const resetBookForm = () => {
    setBookMode("patient");
    setSelectedPatient(null);
    setPatientSearch("");
    setSelectedEnquiry(null);
    setEnquirySearch("");
    setNewEnquiryName("");
    setNewEnquiryPhone("");
    setNewEnquiryAlt("");
    setNewEnquiryReason("");
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

  const handleCreateEnquiry = async () => {
    if (!newEnquiryName.trim() || !newEnquiryPhone.trim()) {
      Alert.alert("Validation", "Please enter the enquirer's name and phone number.");
      return;
    }
    try {
      setCreatingEnquiry(true);
      const res = await registerEnquiry({
        name: newEnquiryName.trim(),
        phone_number: newEnquiryPhone.trim(),
        alternative_number: newEnquiryAlt.trim() || undefined,
        reason: newEnquiryReason.trim() || undefined,
      });
      if (res.ok && res.data?.data) {
        const created = res.data.data;
        setEnquiries((prev) => [created, ...prev]);
        setSelectedEnquiry(created);
        setNewEnquiryName("");
        setNewEnquiryPhone("");
        setNewEnquiryAlt("");
        setNewEnquiryReason("");
      } else {
        const msg = res.data?.detail || res.data?.message || "Failed to save enquiry.";
        Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    } catch (e) {
      console.error("CREATE ENQUIRY ERROR", e);
      Alert.alert("Error", "An unexpected error occurred while saving the enquiry.");
    } finally {
      setCreatingEnquiry(false);
    }
  };

  const handleBook = async () => {
    if (bookMode === "patient" && !selectedPatient) {
      Alert.alert("Validation", "Please select a patient.");
      return;
    }
    if (bookMode === "enquiry" && !selectedEnquiry) {
      Alert.alert("Validation", "Please select or add an enquiry.");
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
        patient_id: bookMode === "patient" ? selectedPatient.id : undefined,
        enquiry_id: bookMode === "enquiry" ? selectedEnquiry.id : undefined,
        appointment_date,
        doctor_name: doctorName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.ok) {
        setShowBookModal(false);
        resetBookForm();
        Alert.alert("Success", "Appointment booked successfully.");
        refreshCurrentView();
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

  const handleConvertEnquiry = (appt) => {
    Alert.alert(
      "Convert to Patient",
      `Register ${appt.patient_name || "this enquiry"} as a full patient? A new patient ID will be created and this appointment will be linked to it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          onPress: async () => {
            try {
              const res = await convertEnquiryToPatient(appt.enquiry_id);
              if (res.ok) {
                Alert.alert("Success", `Converted to patient ${res.data?.data?.patient_id || ""}.`);
                refreshCurrentView();
                loadPatients();
                loadEnquiries();
              } else {
                const msg = res.data?.detail || res.data?.message || "Failed to convert enquiry.";
                Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
              }
            } catch (e) {
              console.error("CONVERT ENQUIRY ERROR", e);
              Alert.alert("Error", "An unexpected error occurred while converting.");
            }
          },
        },
      ]
    );
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
        refreshCurrentView();
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
        refreshCurrentView();
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
              refreshCurrentView();
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
            <Text style={[styles.apptTime, { color: theme.text }]}>
              {viewMode === "history" ? toDateTimeStr12(d) : toTimeStr12(d)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {item.is_enquiry && (
              <View style={[styles.statusBadge, { backgroundColor: "#a855f722" }]}>
                <Text style={[styles.statusText, { color: "#a855f7" }]}>Enquiry</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
            </View>
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

        {(item.status === "Scheduled" && (canEdit || canDelete)) || (item.is_enquiry && canAddPatients) ? (
          <View style={styles.apptActions}>
            {item.is_enquiry && canAddPatients && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#a855f718" }]}
                onPress={() => handleConvertEnquiry(item)}
              >
                <Icon name="person-add-outline" size={16} color="#a855f7" />
                <Text style={[styles.actionBtnText, { color: "#a855f7" }]}>Convert to Patient</Text>
              </TouchableOpacity>
            )}

            {item.status === "Scheduled" && canEdit && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.primary + "18" }]}
                onPress={() => openFixModal(item)}
              >
                <Icon name="create-outline" size={16} color={theme.primary} />
                <Text style={[styles.actionBtnText, { color: theme.primary }]}>Fix / Reschedule</Text>
              </TouchableOpacity>
            )}

            {item.status === "Scheduled" && canEdit && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#22c55e18" }]}
                onPress={() => handleStatusChange(item, "Completed")}
              >
                <Icon name="checkmark-circle-outline" size={16} color="#22c55e" />
                <Text style={[styles.actionBtnText, { color: "#22c55e" }]}>Complete</Text>
              </TouchableOpacity>
            )}

            {item.status === "Scheduled" && canDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#ef444418" }]}
                onPress={() => handleCancel(item)}
              >
                <Icon name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
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
              {viewMode === "history" ? "Previous appointment history" : "Daily appointment booking & fixing"}
            </Text>
          </View>
          {canAdd && (
            <TouchableOpacity
              style={[styles.bookBtn, { backgroundColor: theme.primary }]}
              onPress={openBookModal}
            >
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upcoming / History toggle */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity
            onPress={() => setViewMode("day")}
            style={[
              styles.viewToggleBtn,
              {
                backgroundColor: viewMode === "day" ? theme.primary : theme.card,
                borderColor: viewMode === "day" ? theme.primary : isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
              },
            ]}
          >
            <Icon name="calendar-outline" size={14} color={viewMode === "day" ? "#fff" : theme.subText} />
            <Text style={{ color: viewMode === "day" ? "#fff" : theme.text, fontWeight: "700", fontSize: 13 }}>
              Upcoming
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode("history")}
            style={[
              styles.viewToggleBtn,
              {
                backgroundColor: viewMode === "history" ? theme.primary : theme.card,
                borderColor: viewMode === "history" ? theme.primary : isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb",
              },
            ]}
          >
            <Icon name="time-outline" size={14} color={viewMode === "history" ? "#fff" : theme.subText} />
            <Text style={{ color: viewMode === "history" ? "#fff" : theme.text, fontWeight: "700", fontSize: 13 }}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "day" ? (
          <>
            {/* Date chips + jump-to-date */}
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

              <TouchableOpacity
                onPress={() => setShowJumpDatePicker(true)}
                style={[
                  styles.chip,
                  styles.jumpDateChip,
                  { backgroundColor: theme.card, borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" },
                ]}
              >
                <Icon name="calendar-number-outline" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>
            {showJumpDatePicker && (
              <DateTimePicker
                value={/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? new Date(`${selectedDate}T00:00:00`) : new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  setShowJumpDatePicker(Platform.OS === "ios");
                  if (event.type !== "dismissed" && date) {
                    setSelectedDate(toDateStr(date));
                  }
                  if (Platform.OS !== "ios") setShowJumpDatePicker(false);
                }}
              />
            )}

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
          </>
        ) : (
          <>
            {/* History search */}
            <View style={styles.historySearchWrap}>
              <View
                style={[
                  styles.historySearchInput,
                  { backgroundColor: theme.card, borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" },
                ]}
              >
                <Icon name="search-outline" size={16} color="#94a3b8" />
                <TextInput
                  value={historySearch}
                  onChangeText={setHistorySearch}
                  placeholder="Search history by patient name / phone"
                  placeholderTextColor="#94a3b8"
                  style={[styles.historySearchText, { color: theme.text }]}
                />
              </View>
            </View>

            {historyLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={styles.center}>
                <Icon name="time-outline" size={48} color={theme.subText} />
                <Text style={{ color: theme.subText, marginTop: 12 }}>
                  {historySearch.trim() ? "No matching appointments found" : "No previous appointments yet"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHistory}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderAppointment}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            )}
          </>
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
              style={{ maxHeight: modalScrollMaxHeight }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
            >
              <BookForm
                theme={theme}
                isDark={isDark}
                bookMode={bookMode}
                setBookMode={setBookMode}
                selectedPatient={selectedPatient}
                setSelectedPatient={setSelectedPatient}
                patientSearch={patientSearch}
                setPatientSearch={setPatientSearch}
                filteredPatients={filteredPatients}
                selectedEnquiry={selectedEnquiry}
                setSelectedEnquiry={setSelectedEnquiry}
                enquirySearch={enquirySearch}
                setEnquirySearch={setEnquirySearch}
                filteredEnquiries={filteredEnquiries}
                newEnquiryName={newEnquiryName}
                setNewEnquiryName={setNewEnquiryName}
                newEnquiryPhone={newEnquiryPhone}
                setNewEnquiryPhone={setNewEnquiryPhone}
                newEnquiryAlt={newEnquiryAlt}
                setNewEnquiryAlt={setNewEnquiryAlt}
                newEnquiryReason={newEnquiryReason}
                setNewEnquiryReason={setNewEnquiryReason}
                creatingEnquiry={creatingEnquiry}
                onCreateEnquiry={handleCreateEnquiry}
                formDate={formDate}
                setFormDate={setFormDate}
                formTime={formTime}
                setFormTime={setFormTime}
                doctorName={doctorName}
                setDoctorName={setDoctorName}
                doctorUsers={doctorUsers}
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
              style={{ maxHeight: modalScrollMaxHeight }}
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

              <DoctorField theme={theme} isDark={isDark} value={doctorName} onChange={setDoctorName} doctorUsers={doctorUsers} />

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
  // Midnight today, so the date picker's minimumDate excludes past dates
  // but still allows picking today.
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const dateValue = formDate && /^\d{4}-\d{2}-\d{2}$/.test(formDate)
    ? new Date(`${formDate}T00:00:00`)
    : todayMidnight;

  const timeValue = (() => {
    const time24 = to24Hour(formTime);
    const d = new Date();
    if (time24) {
      const [h, m] = time24.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(10, 0, 0, 0);
    }
    return d;
  })();

  return (
    <>
      <FieldLabel theme={theme} label="Date" />
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowDatePicker(true)}
        style={[styles.inputWrap, styles.pickerTrigger, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}
      >
        <Text style={[styles.textInput, { color: formDate ? theme.text : "#94a3b8" }]}>
          {formDate || "Select date"}
        </Text>
        <Icon name="calendar-outline" size={18} color="#94a3b8" />
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={todayMidnight}
          onChange={(event, date) => {
            setShowDatePicker(Platform.OS === "ios");
            if (event.type !== "dismissed" && date) {
              setFormDate(toDateStr(date));
            }
            if (Platform.OS !== "ios") setShowDatePicker(false);
          }}
        />
      )}
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

      <FieldLabel theme={theme} label="Time" />
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowTimePicker(true)}
        style={[styles.inputWrap, styles.pickerTrigger, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}
      >
        <Text style={[styles.textInput, { color: formTime ? theme.text : "#94a3b8" }]}>
          {formTime || "Select time"}
        </Text>
        <Icon name="time-outline" size={18} color="#94a3b8" />
      </TouchableOpacity>
      {showTimePicker && (
        <DateTimePicker
          value={timeValue}
          mode="time"
          is24Hour={false}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowTimePicker(Platform.OS === "ios");
            if (event.type !== "dismissed" && date) {
              setFormTime(toTimeStr12(date));
            }
            if (Platform.OS !== "ios") setShowTimePicker(false);
          }}
        />
      )}
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

// Physiotherapist picker — mirrors the Mode of Referral / Expense Type
// bottom-sheet picker pattern used elsewhere in the app.
function DoctorField({ theme, isDark, value, onChange, doctorUsers }) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <>
      <FieldLabel theme={theme} label="Doctor / Physiotherapist" />
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowPicker(true)}
        style={[styles.inputWrap, styles.pickerTrigger, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}
      >
        <Text style={[styles.textInput, { color: value ? theme.text : "#94a3b8" }]} numberOfLines={1}>
          {value || "Select doctor"}
        </Text>
        <Icon name="chevron-down-outline" size={16} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Doctor / Physiotherapist</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Icon name="close" size={22} color={theme.subText} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {doctorUsers.length === 0 ? (
                <Text style={[styles.pickerEmptyText, { color: theme.subText }]}>
                  No users with the "Doctor" designation yet. Add one from Settings → Manage Users.
                </Text>
              ) : (
                doctorUsers.map((u) => {
                  const selected = value === u.username;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.pickerOptionRow}
                      onPress={() => {
                        onChange(u.username);
                        setShowPicker(false);
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: selected ? "800" : "600" }}>{u.username}</Text>
                      {selected && <Icon name="checkmark" size={18} color={isDark ? "#3b82f6" : "#2563eb"} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function BookForm({
  theme,
  isDark,
  bookMode,
  setBookMode,
  selectedPatient,
  setSelectedPatient,
  patientSearch,
  setPatientSearch,
  filteredPatients,
  selectedEnquiry,
  setSelectedEnquiry,
  enquirySearch,
  setEnquirySearch,
  filteredEnquiries,
  newEnquiryName,
  setNewEnquiryName,
  newEnquiryPhone,
  setNewEnquiryPhone,
  newEnquiryAlt,
  setNewEnquiryAlt,
  newEnquiryReason,
  setNewEnquiryReason,
  creatingEnquiry,
  onCreateEnquiry,
  formDate,
  setFormDate,
  formTime,
  setFormTime,
  doctorName,
  setDoctorName,
  doctorUsers,
  notes,
  setNotes,
}) {
  return (
    <View>
      <FieldLabel theme={theme} label="Booking For" />
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            {
              backgroundColor: bookMode === "patient" ? theme.primary : "transparent",
              borderColor: bookMode === "patient" ? theme.primary : isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
            },
          ]}
          onPress={() => setBookMode("patient")}
        >
          <Icon name="person-outline" size={15} color={bookMode === "patient" ? "#fff" : theme.subText} />
          <Text style={{ color: bookMode === "patient" ? "#fff" : theme.text, fontWeight: "700", fontSize: 13 }}>
            Existing Patient
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeToggleBtn,
            {
              backgroundColor: bookMode === "enquiry" ? theme.primary : "transparent",
              borderColor: bookMode === "enquiry" ? theme.primary : isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
            },
          ]}
          onPress={() => setBookMode("enquiry")}
        >
          <Icon name="help-circle-outline" size={15} color={bookMode === "enquiry" ? "#fff" : theme.subText} />
          <Text style={{ color: bookMode === "enquiry" ? "#fff" : theme.text, fontWeight: "700", fontSize: 13 }}>
            New Enquiry
          </Text>
        </TouchableOpacity>
      </View>

      {bookMode === "patient" ? (
        <>
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
                      <Text style={{ color: theme.subText, fontSize: 12 }}>{p.id} • {p.phone_number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <FieldLabel theme={theme} label="Enquiry" />
          {selectedEnquiry ? (
            <View style={[styles.selectedPatientRow, { backgroundColor: isDark ? "rgba(2,6,23,0.5)" : "#f8fafc" }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "700" }}>{selectedEnquiry.name}</Text>
                <Text style={{ color: theme.subText, fontSize: 12 }}>
                  {selectedEnquiry.id} • {selectedEnquiry.phone_number}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEnquiry(null)}>
                <Text style={{ color: "#ef4444", fontWeight: "700" }}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextField
                theme={theme}
                isDark={isDark}
                value={enquirySearch}
                onChangeText={setEnquirySearch}
                placeholder="Search open enquiries by name / phone / ID"
              />
              {filteredEnquiries.length > 0 && (
                <View style={styles.searchResults}>
                  {filteredEnquiries.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        setSelectedEnquiry(e);
                        setEnquirySearch("");
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: "600" }}>{e.name}</Text>
                      <Text style={{ color: theme.subText, fontSize: 12 }}>{e.id} • {e.phone_number}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.newEnquiryBox, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" }]}>
                <Text style={{ color: theme.subText, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>
                  Or add a new enquiry
                </Text>
                <TextField
                  theme={theme}
                  isDark={isDark}
                  value={newEnquiryName}
                  onChangeText={setNewEnquiryName}
                  placeholder="Name *"
                />
                <View style={{ height: 10 }} />
                <TextField
                  theme={theme}
                  isDark={isDark}
                  value={newEnquiryPhone}
                  onChangeText={setNewEnquiryPhone}
                  placeholder="Phone number *"
                  keyboardType="phone-pad"
                />
                <View style={{ height: 10 }} />
                <TextField
                  theme={theme}
                  isDark={isDark}
                  value={newEnquiryAlt}
                  onChangeText={setNewEnquiryAlt}
                  placeholder="Alternative number (optional)"
                  keyboardType="phone-pad"
                />
                <View style={{ height: 10 }} />
                <TextField
                  theme={theme}
                  isDark={isDark}
                  value={newEnquiryReason}
                  onChangeText={setNewEnquiryReason}
                  placeholder="Reason for enquiry (optional)"
                />
                <TouchableOpacity
                  style={[styles.addEnquiryBtn, { backgroundColor: theme.primary, opacity: creatingEnquiry ? 0.7 : 1 }]}
                  onPress={onCreateEnquiry}
                  disabled={creatingEnquiry}
                >
                  {creatingEnquiry ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="add-circle-outline" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Add Enquiry</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
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

      <DoctorField theme={theme} isDark={isDark} value={doctorName} onChange={setDoctorName} doctorUsers={doctorUsers} />

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
  viewToggleRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  viewToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  jumpDateChip: {
    paddingHorizontal: 12,
  },
  historySearchWrap: {
    paddingHorizontal: 20,
    marginTop: 14,
  },
  historySearchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  historySearchText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    ...Platform.select({ web: { outlineStyle: "none" } }),
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
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pickerTitle: { fontSize: 17, fontWeight: "900" },
  pickerOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  pickerEmptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
    lineHeight: 18,
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
  modeToggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  newEnquiryBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addEnquiryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 12,
    marginTop: 12,
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

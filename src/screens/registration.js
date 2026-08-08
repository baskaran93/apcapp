import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from "react-native";
import { createPatient, updatePatient, getReferralTypes } from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons as Icon } from "@expo/vector-icons";
import { ThemeContext } from "../theme/ThemeContext";
import { scanRegistrationForm } from "../utils/scanForm";

const { width } = Dimensions.get("window");

const Registration = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme, mode: themeMode } = useContext(ThemeContext);

  const { mode, patient } = route.params || {};
  const isDark = themeMode === "dark";
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [alternativeNumber, setAlternativeNumber] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [modeOfReferral, setModeOfReferral] = useState("");

  const [referralTypes, setReferralTypes] = useState([]);
  const [showReferralPicker, setShowReferralPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});

  const scrollRef = useRef(null);
  const contentRef = useRef(null);

  const cleanedPhone = useMemo(
    () => (phoneNumber || "").replace(/\D/g, ""),
    [phoneNumber]
  );

  const cleanedAltNumber = useMemo(
    () => (alternativeNumber || "").replace(/\D/g, ""),
    [alternativeNumber]
  );

  useEffect(() => {
    if (mode === "edit" && patient) {
      setName(patient.name || "");
      setPhoneNumber(patient.phone_number || "");
      setAlternativeNumber(patient.alternative_number || "");
      setAge(patient.age ? String(patient.age) : "");
      setAddress(patient.address || "");
      setCity(patient.city || "");
      setPincode(patient.pincode || "");
      setModeOfReferral(patient.mode_of_referral || "");
    }
  }, [mode, patient]);

  useEffect(() => {
    const loadReferralTypes = async () => {
      const res = await getReferralTypes();
      if (res.ok && Array.isArray(res.data)) {
        setReferralTypes(res.data);
      }
    };
    loadReferralTypes();
  }, []);

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Required";
    if (!cleanedPhone) e.phoneNumber = "Required";
    else if (cleanedPhone.length !== 10) e.phoneNumber = "10 digits";
    if (cleanedAltNumber && cleanedAltNumber.length !== 10) e.alternativeNumber = "10 digits";
    if (!age.trim()) e.age = "Required";
    if (pincode && pincode.length !== 6) e.pincode = "6 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleScanForm = async () => {
    try {
      setScanning(true);
      const fields = await scanRegistrationForm();
      if (!fields) return; // user cancelled the camera

      if (fields.name) setName(fields.name);
      if (fields.phone_number) setPhoneNumber(fields.phone_number);
      if (fields.age) setAge(fields.age);
      if (fields.address) setAddress(fields.address);
      if (fields.pincode) setPincode(fields.pincode);

      if (Object.keys(fields).length === 0) {
        Alert.alert("No text found", "Couldn't read the form. Please enter the details manually.");
      } else {
        Alert.alert("Scanned", "Fields filled from the form — please review them before saving, handwriting recognition isn't perfect.");
      }
    } catch (err) {
      Alert.alert("Scan failed", err.message || "Unable to scan the form.");
    } finally {
      setScanning(false);
    }
  };

  const handleSavePatient = async () => {
    setTouched({
      name: true,
      phoneNumber: true,
      alternativeNumber: true,
      age: true,
      pincode: true,
    });

    if (!validate()) return;

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Login expired");

      const payload = {
        name,
        phone_number: cleanedPhone,
        alternative_number: cleanedAltNumber,
        age: Number(age),
        address,
        city,
        pincode,
        mode_of_referral: modeOfReferral,
      };

      let res;
      if (mode === "edit")
        res = await updatePatient(patient.id || patient.pk, payload);
      else res = await createPatient(payload);

      if (res.ok) {
        Alert.alert("Success", "Patient details saved successfully");
        navigation.goBack();
      } else {
        const msg = res.data?.message || res.data?.detail || "Save failed";
        Alert.alert("Error", msg);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to connect to server");
    } finally {
      setSaving(false);
    }
  };

  const inputBg = isDark
    ? "rgba(15,23,42,0.75)"
    : "rgba(248,250,252,0.95)";

  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const errorBorder = "rgba(239,68,68,0.55)";

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* 🔥 TRENDING BACKGROUND */}
      <LinearGradient
        colors={isDark ? ["#020617", "#0b1220", "#111827"] : ["#f8fafc", "#eef2ff", "#f1f5f9"]}
        style={StyleSheet.absoluteFill}
      />

      {/* ✨ Decorative Blobs */}
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            backgroundColor: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.1)",
            top: -100,
            left: -80,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            backgroundColor: isDark ? "rgba(168,85,247,0.1)" : "rgba(168,85,247,0.08)",
            bottom: -150,
            right: -100,
          },
        ]}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContainer,
            isWeb && styles.containerWeb,
          ]}
        >
          {/* Glass Card */}
          <View
            ref={contentRef}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(2,6,23,0.7)" : "rgba(255,255,255,0.8)",
                borderColor: borderCol,
              },
            ]}
          >
            {mode !== "edit" && (
              <TouchableOpacity
                disabled={scanning}
                onPress={handleScanForm}
                activeOpacity={0.85}
                style={[
                  styles.scanBtn,
                  { borderColor: borderCol, backgroundColor: isDark ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.08)" },
                ]}
              >
                {scanning ? (
                  <ActivityIndicator color={isDark ? "#3b82f6" : "#2563eb"} />
                ) : (
                  <>
                    <Icon name="scan-outline" size={18} color={isDark ? "#3b82f6" : "#2563eb"} style={{ marginRight: 8 }} />
                    <Text style={[styles.scanBtnText, { color: isDark ? "#3b82f6" : "#2563eb" }]}>
                      Scan Paper Form
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.grid}>
              <Field
                icon="person-outline"
                {...f("Full Name", name, setName, errors.name)}
              />
              <Field
                icon="call-outline"
                keyboardType="phone-pad"
                {...f("Phone Number", phoneNumber, setPhoneNumber, errors.phoneNumber)}
              />
              <Field
                icon="phone-portrait-outline"
                keyboardType="phone-pad"
                {...f("Alternative Number (Optional)", alternativeNumber, setAlternativeNumber, errors.alternativeNumber)}
              />
              <Field
                icon="calendar-outline"
                keyboardType="numeric"
                {...f("Age", age, setAge, errors.age)}
              />
              <Field
                icon="business-outline"
                {...f("City", city, setCity)}
              />
              <Field
                icon="location-outline"
                full
                multiline
                numberOfLines={2}
                {...f("Full Address", address, setAddress)}
              />
              <Field
                icon="mail-unread-outline"
                keyboardType="numeric"
                {...f("Pincode", pincode, setPincode, errors.pincode)}
              />
              <SelectField
                icon="share-social-outline"
                label="Mode of Referral"
                value={modeOfReferral}
                placeholder="Select referral type"
                onPress={() => setShowReferralPicker(true)}
                inputBg={inputBg}
                borderCol={borderCol}
                theme={theme}
                isDark={isDark}
              />
            </View>

            <TouchableOpacity
              disabled={saving}
              onPress={handleSavePatient}
              activeOpacity={0.9}
              style={{ marginTop: 10 }}
            >
              <LinearGradient
                colors={isDark ? ["#2563eb", "#06b6d4"] : ["#2563eb", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, { opacity: saving ? 0.8 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveText}>
                      {mode === "edit" ? "Update Details" : "Register Patient"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footer, { color: isDark ? "#475569" : "#94a3b8" }]}>
            All fields are saved securely • APC Clinic ERP
          </Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={showReferralPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferralPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowReferralPicker(false)}>
          <Pressable
            style={[styles.pickerSheet, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}
            onPress={() => {}}
          >
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Mode of Referral</Text>
              <TouchableOpacity onPress={() => setShowReferralPicker(false)}>
                <Icon name="close" size={22} color={theme.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {referralTypes.length === 0 ? (
                <Text style={[styles.pickerEmptyText, { color: theme.subText }]}>
                  No referral types configured yet. Add them from Settings → Referral Type Master.
                </Text>
              ) : (
                referralTypes.map((rt) => {
                  const selected = modeOfReferral === rt.referral_type_name;
                  return (
                    <TouchableOpacity
                      key={rt.id}
                      style={styles.pickerOptionRow}
                      onPress={() => {
                        setModeOfReferral(rt.referral_type_name);
                        setShowReferralPicker(false);
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: selected ? "800" : "600" }}>
                        {rt.referral_type_name}
                      </Text>
                      {selected && (
                        <Icon name="checkmark" size={18} color={isDark ? "#3b82f6" : "#2563eb"} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  function f(label, value, setter, error) {
    return {
      label,
      value,
      onChangeText: setter,
      error,
      inputBg,
      borderCol,
      errorBorder,
      theme,
      isDark,
      scrollRef,
      contentRef,
    };
  }
};

/* FIELD COMPONENT */

function Field({
  label,
  value,
  onChangeText,
  error,
  icon,
  full,
  inputBg,
  borderCol,
  errorBorder,
  theme,
  isDark,
  scrollRef,
  contentRef,
  ...props
}) {
  const hasError = !!error;
  const [focus, setFocus] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setFocus(true);
    setTimeout(() => {
      if (inputRef.current && scrollRef?.current && contentRef?.current) {
        inputRef.current.measureLayout(
          contentRef.current,
          (x, y) => {
            scrollRef.current.scrollTo({ y: Math.max(y - 100, 0), animated: true });
          },
          () => {}
        );
      }
    }, 100);
  };

  return (
    <View style={[styles.field, full && { width: "100%" }]}>
      <Text style={[styles.fieldLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: inputBg,
            borderColor: hasError ? errorBorder : focus ? (isDark ? "#3b82f6" : "#2563eb") : borderCol,
            borderWidth: focus || hasError ? 1.5 : 1,
          },
        ]}
      >
        <Icon
          name={icon}
          size={18}
          color={focus ? (isDark ? "#3b82f6" : "#2563eb") : (isDark ? "#475569" : "#94a3b8")}
          style={styles.fieldIcon}
        />
        <TextInput
          ref={inputRef}
          placeholder=""
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={() => setFocus(false)}
          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
          style={[styles.input, { color: theme.text }]}
          {...props}
        />
      </View>
      {hasError && (
        <View style={styles.errorRow}>
          <Icon name="alert-circle" size={12} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function SelectField({ label, icon, value, placeholder, onPress, inputBg, borderCol, theme, isDark }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: isDark ? "#94a3b8" : "#64748b" }]}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: borderCol }]}
      >
        <Icon
          name={icon}
          size={18}
          color={isDark ? "#475569" : "#94a3b8"}
          style={styles.fieldIcon}
        />
        <Text
          numberOfLines={1}
          style={[styles.input, { color: value ? theme.text : (isDark ? "#475569" : "#94a3b8") }]}
        >
          {value || placeholder}
        </Text>
        <Icon name="chevron-down-outline" size={16} color={isDark ? "#475569" : "#94a3b8"} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  containerWeb: {
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  blob: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.6,
  },
  card: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0px 20px 50px rgba(0,0,0,0.08)",
      },
    }),
  },
  scanBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  scanBtnText: {
    fontWeight: "800",
    fontSize: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  field: {
    width: width > 600 ? "48.5%" : "100%",
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrap: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  fieldIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    height: "100%",
    ...Platform.select({
      web: { outlineStyle: "none" }
    }),
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginLeft: 4,
    gap: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "600",
  },
  saveBtn: {
    height: 56,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 25,
  },

  /* Mode of Referral picker */
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
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
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
});

export default Registration;
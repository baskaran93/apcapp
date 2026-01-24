import React, { useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { ThemeContext } from "../theme/ThemeContext";
import { createPatient } from "../services/api";

const EMPTY_FORM = {
  name: "",
  mobile: "",
  pincode: "",
  city: "",
  address: "",
  age: "",
  referral: "",
};

const PatientProfileScreen = () => {
  const navigation = useNavigation();
  const { theme, mode } = useContext(ThemeContext);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 🔹 ALWAYS RESET FORM WHEN SCREEN OPENS
  useFocusEffect(
    useCallback(() => {
      setForm(EMPTY_FORM);
    }, [])
  );

  const handleChange = (key, value) => {
    setForm({ ...form, [key]: value });
  };

  // 🔹 SAVE PATIENT FUNCTION
  const handleSavePatient = async () => {
    if (!form.name || !form.mobile) {
      Alert.alert("Validation", "Name and Mobile are required");
      return;
    }

    try {
      setSaving(true);

      const response = await createPatient(form);

      if (response.ok) {
        // 🎉 SUCCESS MESSAGE
        Alert.alert("Success", "Patient registered successfully", [
          {
            text: "OK",
            onPress: () => {
              // 🔙 GO BACK TO PATIENT LIST (NOT DASHBOARD)
              navigation.navigate("Patient List");
            },
          },
        ]);
      } else {
        const msg =
          response.data?.detail ||
          response.data?.message ||
          "Failed to save patient";
        Alert.alert("Error", msg);
      }
    } catch (error) {
      console.error("SAVE ERROR 👉", error);
      Alert.alert("Network Error", "Unable to save patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.card}
      />

      {/* 🔹 HEADER */}
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
          Add Patient
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, shadowColor: "#000" },
          ]}
        >
          <Field
            label="Name *"
            placeholder="Enter name"
            value={form.name}
            onChange={(v) => handleChange("name", v)}
            theme={theme}
          />

          <Field
            label="Mobile Number *"
            placeholder="Enter mobile"
            keyboardType="numeric"
            value={form.mobile}
            onChange={(v) => handleChange("mobile", v)}
            theme={theme}
          />

          <Field
            label="Pincode"
            placeholder="Enter pincode"
            keyboardType="numeric"
            value={form.pincode}
            onChange={(v) => handleChange("pincode", v)}
            theme={theme}
          />

          <Field
            label="City"
            placeholder="Enter city"
            value={form.city}
            onChange={(v) => handleChange("city", v)}
            theme={theme}
          />

          <Field
            label="Address"
            placeholder="Enter address"
            value={form.address}
            onChange={(v) => handleChange("address", v)}
            multiline
            theme={theme}
          />

          <Field
            label="Age"
            placeholder="Enter age"
            keyboardType="numeric"
            value={form.age}
            onChange={(v) => handleChange("age", v)}
            theme={theme}
          />

          <Field
            label="Referral"
            placeholder="Doctor / Friend / Online"
            value={form.referral}
            onChange={(v) => handleChange("referral", v)}
            theme={theme}
          />

          {/* 🔹 SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={handleSavePatient}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save Patient</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* 🔹 REUSABLE FIELD */
const Field = ({ label, onChange, theme, ...props }) => (
  <View style={styles.fieldBlock}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <TextInput
      {...props}
      onChangeText={onChange}
      style={[
        styles.input,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
          color: theme.text,
        },
        props.multiline && { height: 80, textAlignVertical: "top" },
      ]}
      placeholderTextColor={theme.subText}
    />
  </View>
);

export default PatientProfileScreen;

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    elevation: 2,
  },

  backBtn: {
    position: "absolute",
    left: 15,
    padding: 6,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  container: {
    padding: 16,
  },

  card: {
    borderRadius: 14,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  fieldBlock: {
    marginBottom: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },

  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },

  saveBtn: {
    marginTop: 25,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

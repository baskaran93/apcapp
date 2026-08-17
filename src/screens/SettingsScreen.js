import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons as Icon } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { AuthContext } from "../context/AuthContext";
import { ThemeContext } from "../theme/ThemeContext";
import { changePassword } from "../services/api";

/* =========================================================
   Logout Confirm Modal
========================================================= */
function LogoutModal({ visible, onClose, onConfirm, isDark }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}
          onPress={() => {}}
        >
          <View style={styles.iconCircle}>
            <Icon name="log-out-outline" size={26} color="#fff" />
          </View>

          <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#0f172a" }]}>
            Logout?
          </Text>
          <Text style={[styles.modalSubtitle, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            Are you sure you want to logout?
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0" },
              ]}
              onPress={onClose}
            >
              <Text style={{ color: isDark ? "#fff" : "#0f172a", fontWeight: "700" }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmLogoutBtn} onPress={onConfirm}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* =========================================================
   Password Field (kept outside ChangePasswordModal so it isn't
   redefined - and remounted, dropping focus - on every keystroke)
========================================================= */
function PasswordField({ label, icon, value, onChangeText, show, setShow, isDark }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: isDark ? "rgba(15,23,42,0.75)" : "rgba(248,250,252,0.95)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" },
        ]}
      >
        <Icon name={icon} size={18} color={isDark ? "#94a3b8" : "#64748b"} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholder={label}
          placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
          style={[styles.textInput, { color: isDark ? "#fff" : "#0f172a" }]}
        />
        <TouchableOpacity onPress={() => setShow(!show)}>
          <Icon
            name={show ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={isDark ? "#94a3b8" : "#64748b"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* =========================================================
   Change Password Modal
========================================================= */
function ChangePasswordModal({ visible, onClose, isDark, theme }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  const notify = (title, message) => {
    if (Platform.OS === "web") window.alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  };

  const handleSave = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      notify("Validation", "Please fill in all fields.");
      return;
    }
    if (newPassword.length < 4) {
      notify("Validation", "New password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("Validation", "New password and confirm password do not match.");
      return;
    }

    try {
      setSaving(true);
      const response = await changePassword(oldPassword, newPassword);
      if (response.ok) {
        notify("Success", "Password changed successfully.");
        resetAndClose();
      } else {
        const message =
          response.data?.detail || response.data?.message || "Failed to change password.";
        notify("Error", message);
      }
    } catch (error) {
      notify("Network Error", "Unable to connect to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={styles.sheetOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={[styles.sheetCard, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#0f172a" }]}>
              Change Password
            </Text>
            <TouchableOpacity onPress={resetAndClose}>
              <Icon name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PasswordField
              label="Current Password"
              icon="lock-closed-outline"
              value={oldPassword}
              onChangeText={setOldPassword}
              show={showOld}
              setShow={setShowOld}
              isDark={isDark}
            />
            <PasswordField
              label="New Password"
              icon="key-outline"
              value={newPassword}
              onChangeText={setNewPassword}
              show={showNew}
              setShow={setShowNew}
              isDark={isDark}
            />
            <PasswordField
              label="Confirm New Password"
              icon="checkmark-circle-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              show={showConfirm}
              setShow={setShowConfirm}
              isDark={isDark}
            />

            <TouchableOpacity disabled={saving} onPress={handleSave} activeOpacity={0.9}>
              <LinearGradient
                colors={isDark ? ["#2563eb", "#06b6d4"] : ["#2563eb", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, { opacity: saving ? 0.85 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Update Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* =========================================================
   Setting Row (module-level for the same reason as PasswordField)
========================================================= */
function SettingRow({ icon, label, danger, onPress, isDark, theme }) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)" },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: danger ? "rgba(239,68,68,0.12)" : (isDark ? "rgba(255,255,255,0.10)" : "rgba(37,99,235,0.10)") },
        ]}
      >
        <Icon name={icon} size={20} color={danger ? "#ef4444" : theme.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? "#ef4444" : theme.text }]}>{label}</Text>
      <Icon name="chevron-forward" size={20} color={isDark ? "#64748b" : "#94a3b8"} />
    </TouchableOpacity>
  );
}

/* =========================================================
   Settings Screen
========================================================= */
const SettingsScreen = () => {
  const navigation = useNavigation();
  const { setUserToken, userRole } = useContext(AuthContext);
  const { theme, mode } = useContext(ThemeContext);
  const isDark = mode === "dark";
  const isAdmin = userRole === "admin";

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [changePwdVisible, setChangePwdVisible] = useState(false);

  const handleLogoutConfirm = () => {
    setLogoutVisible(false);
    setUserToken(null);
    navigation.replace("Login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: theme.subText }]}>ACCOUNT</Text>

        <SettingRow
          icon="key-outline"
          label="Change Password"
          onPress={() => setChangePwdVisible(true)}
          isDark={isDark}
          theme={theme}
        />
        <SettingRow
          icon="log-out-outline"
          label="Logout"
          danger
          onPress={() => setLogoutVisible(true)}
          isDark={isDark}
          theme={theme}
        />

        {isAdmin && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.subText, marginTop: 18 }]}>
              ADMINISTRATION
            </Text>

            <SettingRow
              icon="person-add-outline"
              label="Manage Users"
              onPress={() => navigation.navigate("Manage Users")}
              isDark={isDark}
              theme={theme}
            />
            <SettingRow
              icon="options-outline"
              label="Menu Rights"
              onPress={() => navigation.navigate("Menu Rights")}
              isDark={isDark}
              theme={theme}
            />
            <SettingRow
              icon="briefcase-outline"
              label="Designation Master"
              onPress={() => navigation.navigate("Designation Master")}
              isDark={isDark}
              theme={theme}
            />
            <SettingRow
              icon="share-social-outline"
              label="Referral Type Master"
              onPress={() => navigation.navigate("Referral Type Master")}
              isDark={isDark}
              theme={theme}
            />
            <SettingRow
              icon="pricetag-outline"
              label="Expense Master"
              onPress={() => navigation.navigate("Expense Master")}
              isDark={isDark}
              theme={theme}
            />
          </>
        )}
      </ScrollView>

      <LogoutModal
        visible={logoutVisible}
        isDark={isDark}
        onClose={() => setLogoutVisible(false)}
        onConfirm={handleLogoutConfirm}
      />

      <ChangePasswordModal
        visible={changePwdVisible}
        isDark={isDark}
        theme={theme}
        onClose={() => setChangePwdVisible(false)}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;

/* =========================================================
   Styles
========================================================= */
const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },

  /* Logout modal */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    padding: 18,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 16,
    fontWeight: "600",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "#ef4444",
  },

  /* Change password sheet */
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputWrap: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    ...Platform.select({
      web: { outlineStyle: "none" },
    }),
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});

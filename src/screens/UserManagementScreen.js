import React, { useCallback, useContext, useState } from "react";
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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons as Icon } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { ThemeContext } from "../theme/ThemeContext";
import { getUsers, registerUser, updateUser, getDesignations } from "../services/api";

const ROLE_OPTIONS = ["admin", "doctor", "receptionist"];

const ROLE_COLORS = {
  admin: "#7c3aed",
  doctor: "#2563eb",
  receptionist: "#0d9488",
};

function notify(title, message) {
  if (Platform.OS === "web") window.alert(`${title}: ${message}`);
  else Alert.alert(title, message);
}

function DesignationSelector({ designations, designationId, onChange, isDark, theme }) {
  if (!designations.length) {
    return (
      <Text style={{ color: isDark ? "#64748b" : "#94a3b8", fontSize: 13, fontStyle: "italic" }}>
        No designations yet. Add one from Settings {'>'} Designation Master.
      </Text>
    );
  }
  return (
    <View style={styles.designationRow}>
      <TouchableOpacity
        onPress={() => onChange(null)}
        style={[
          styles.designationChip,
          {
            backgroundColor: !designationId ? theme.primary : (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
            borderColor: !designationId ? theme.primary : (isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb"),
          },
        ]}
      >
        <Text style={{ color: !designationId ? "#fff" : theme.text, fontWeight: "700" }}>None</Text>
      </TouchableOpacity>
      {designations.map((d) => {
        const active = designationId === d.id;
        return (
          <TouchableOpacity
            key={d.id}
            onPress={() => onChange(d.id)}
            style={[
              styles.designationChip,
              {
                backgroundColor: active ? theme.primary : (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
                borderColor: active ? theme.primary : (isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb"),
              },
            ]}
          >
            <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "700" }}>{d.designation_name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AddUserModal({ visible, onClose, onCreated, isDark, theme, designations }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("receptionist");
  const [designationId, setDesignationId] = useState(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setRole("receptionist");
    setDesignationId(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) {
      notify("Validation", "Please enter a username and password.");
      return;
    }
    try {
      setSaving(true);
      const res = await registerUser(username.trim(), password, role, designationId);
      if (res.ok) {
        notify("Success", `User "${username.trim()}" created as ${role}.`);
        close();
        onCreated();
      } else {
        notify("Error", res.data?.detail || res.data?.message || "Failed to create user.");
      }
    } catch (e) {
      notify("Network Error", "Unable to connect to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={close}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheetCard, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: isDark ? "#fff" : "#0f172a" }]}>Add New User</Text>
            <TouchableOpacity onPress={close}>
              <Icon name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Username</Text>
            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(15,23,42,0.75)" : "rgba(248,250,252,0.95)", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" }]}>
              <Icon name="person-outline" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="Username"
                placeholderTextColor="#94a3b8"
                style={[styles.textInput, { color: isDark ? "#fff" : "#0f172a" }]}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>Password</Text>
            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(15,23,42,0.75)" : "rgba(248,250,252,0.95)", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" }]}>
              <Icon name="lock-closed-outline" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                style={[styles.textInput, { color: isDark ? "#fff" : "#0f172a" }]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => {
                const active = role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? ROLE_COLORS[r] : (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
                        borderColor: active ? ROLE_COLORS[r] : (isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb"),
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "700", textTransform: "capitalize" }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>Designation</Text>
            <DesignationSelector
              designations={designations}
              designationId={designationId}
              onChange={setDesignationId}
              isDark={isDark}
              theme={theme}
            />

            <TouchableOpacity disabled={saving} onPress={handleCreate} activeOpacity={0.9} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={isDark ? ["#2563eb", "#06b6d4"] : ["#2563eb", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, { opacity: saving ? 0.85 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create User</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditUserModal({ visible, user, onClose, onSaved, isDark, theme, designations }) {
  const [role, setRole] = useState(user?.role || "receptionist");
  const [designationId, setDesignationId] = useState(user?.designation_id || null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync whenever a different user is opened for editing
  React.useEffect(() => {
    setRole(user?.role || "receptionist");
    setDesignationId(user?.designation_id || null);
    setNewPassword("");
    setShowPassword(false);
  }, [user]);

  const close = () => {
    setNewPassword("");
    setShowPassword(false);
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const res = await updateUser(user.id, {
        role,
        designationId,
        newPassword: newPassword.trim() || undefined,
      });
      if (res.ok) {
        notify("Success", `User "${user.username}" updated.`);
        close();
        onSaved();
      } else {
        notify("Error", res.data?.detail || res.data?.message || "Failed to update user.");
      }
    } catch (e) {
      notify("Network Error", "Unable to connect to server");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={close}>
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheetCard, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: isDark ? "#fff" : "#0f172a" }]}>Edit User</Text>
            <TouchableOpacity onPress={close}>
              <Icon name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569" }]}>Username</Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" },
              ]}
            >
              <Icon name="person-outline" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <Text style={[styles.textInput, { color: isDark ? "#94a3b8" : "#64748b" }]}>{user.username}</Text>
            </View>

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>Role</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((r) => {
                const active = role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? ROLE_COLORS[r] : (isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
                        borderColor: active ? ROLE_COLORS[r] : (isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb"),
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : theme.text, fontWeight: "700", textTransform: "capitalize" }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>Designation</Text>
            <DesignationSelector
              designations={designations}
              designationId={designationId}
              onChange={setDesignationId}
              isDark={isDark}
              theme={theme}
            />

            <Text style={[styles.fieldLabel, { color: isDark ? "#cbd5e1" : "#475569", marginTop: 14 }]}>
              Reset Password (optional)
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: isDark ? "rgba(15,23,42,0.75)" : "rgba(248,250,252,0.95)", borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb" }]}>
              <Icon name="lock-closed-outline" size={18} color={isDark ? "#94a3b8" : "#64748b"} />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholder="Leave blank to keep current password"
                placeholderTextColor="#94a3b8"
                style={[styles.textInput, { color: isDark ? "#fff" : "#0f172a" }]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity disabled={saving} onPress={handleSave} activeOpacity={0.9} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={isDark ? ["#2563eb", "#06b6d4"] : ["#2563eb", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveBtn, { opacity: saving ? 0.85 : 1 }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const UserManagementScreen = () => {
  const { theme, mode } = useContext(ThemeContext);
  const isDark = mode === "dark";

  const [users, setUsers] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUsers();
      if (res.ok) setUsers(res.data?.data || []);
    } catch (e) {
      // ignore, keep previous list
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDesignations = useCallback(async () => {
    try {
      const res = await getDesignations();
      if (res.ok) setDesignations(res.data || []);
    } catch (e) {
      // ignore, keep previous list
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
      loadDesignations();
    }, [loadUsers, loadDesignations])
  );

  const renderUser = ({ item }) => (
    <View style={[styles.userRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)" }]}>
      <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] || theme.primary }]}>
        <Text style={styles.avatarText}>{(item.username || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.username, { color: theme.text }]}>{item.username}</Text>
        {item.designation_name && (
          <Text style={[styles.designationText, { color: theme.subText }]}>{item.designation_name}</Text>
        )}
      </View>
      <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || theme.primary) + "20" }]}>
        <Text style={{ color: ROLE_COLORS[item.role] || theme.primary, fontWeight: "800", fontSize: 12, textTransform: "capitalize" }}>
          {item.role}
        </Text>
      </View>
      <TouchableOpacity onPress={() => setEditingUser(item)} style={styles.rowEditBtn}>
        <Icon name="create-outline" size={18} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Staff Accounts</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
        >
          <Icon name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add User</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 40, color: theme.subText }}>No users found.</Text>
          }
        />
      )}

      <AddUserModal
        visible={modalVisible}
        isDark={isDark}
        theme={theme}
        designations={designations}
        onClose={() => setModalVisible(false)}
        onCreated={loadUsers}
      />

      <EditUserModal
        visible={!!editingUser}
        user={editingUser}
        isDark={isDark}
        theme={theme}
        designations={designations}
        onClose={() => setEditingUser(null)}
        onSaved={loadUsers}
      />
    </SafeAreaView>
  );
};

export default UserManagementScreen;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  username: { fontSize: 15, fontWeight: "700" },
  designationText: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rowEditBtn: {
    marginLeft: 10,
    padding: 4,
  },

  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
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
  sheetTitle: { fontSize: 18, fontWeight: "900" },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
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
    ...Platform.select({ web: { outlineStyle: "none" } }),
  },
  roleRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  roleChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  designationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  designationChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});

import React, { useState, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Text,
  SafeAreaView,
  TextInput,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  View,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons as Icon } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import { loginUser } from "../services/api";

const LoginBgimg = require("../../assets/images/logo.png");
const { width } = Dimensions.get("window");

const Login = () => {
  // ✅ FIX: include setUserName
  const { setUserToken, setUserName, setUserRole } = useContext(AuthContext);

  const navigation = useNavigation();
  const theme = useColorScheme();

  const isDark = theme === "dark";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      if (Platform.OS === 'web') {
        window.alert("Please enter username and password");
      } else {
        Alert.alert("Validation Error", "Please enter username and password");
      }
      return;
    }

    try {
      setLoading(true);

      const response = await loginUser(username, password);

      if (response.ok) {
        const token = response.data.access_token;

        if (!token) {
          if (Platform.OS === 'web') {
            window.alert("Error: Token not received from server");
          } else {
            Alert.alert("Error", "Token not received from server");
          }
          setLoading(false);
          return;
        }

        const role = response.data.role || "receptionist";

        // ✅ Save token
        await AsyncStorage.setItem("token", token);

        // ✅ IMPORTANT: Save username for sidebar
        await AsyncStorage.setItem("username", username);

        // ✅ Save role so the sidebar/screens can gate access
        await AsyncStorage.setItem("role", role);

        // ✅ Update global context
        setUserToken(token);
        setUserName(username);
        setUserRole(role);

        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });
      } else {
        const message =
          response.data.detail ||
          response.data.message ||
          "Invalid username or password";

        if (Platform.OS === 'web') {
          window.alert("Login Failed: " + message);
        } else {
          Alert.alert("Login Failed", message);
        }
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert("Network Error: Unable to connect to server");
      } else {
        Alert.alert("Network Error", "Unable to connect to server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 🔥 TRENDING BACKGROUND */}
      <LinearGradient
        colors={
          isDark
            ? ["#020617", "#0b1220", "#111827"]
            : ["#f8fafc", "#eef2ff", "#f1f5f9"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ✨ Decorative Blobs */}
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            backgroundColor: isDark
              ? "rgba(59,130,246,0.18)"
              : "rgba(59,130,246,0.16)",
            top: -120,
            left: -90,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            backgroundColor: isDark
              ? "rgba(168,85,247,0.16)"
              : "rgba(168,85,247,0.14)",
            bottom: -130,
            right: -110,
          },
        ]}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
        {/* ===== Glass Card ===== */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? "rgba(2,6,23,0.75)"
                : "rgba(255,255,255,0.82)",
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
            },
          ]}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={LoginBgimg} style={styles.logo} />
          </View>

          <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>
            Welcome Back 👋
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: isDark ? "#94a3b8" : "#64748b" },
            ]}
          >
            Login to continue to ERP Dashboard
          </Text>

          {/* Username */}
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.75)"
                  : "rgba(248,250,252,0.95)",
                borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb",
              },
            ]}
          >
            <Icon
              name="person-outline"
              size={18}
              color={isDark ? "#94a3b8" : "#64748b"}
            />

            <TextInput
              placeholder="Username"
              placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
              style={[styles.input, { color: isDark ? "#fff" : "#0f172a" }]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.75)"
                  : "rgba(248,250,252,0.95)",
                borderColor: isDark ? "rgba(255,255,255,0.10)" : "#e5e7eb",
              },
            ]}
          >
            <Icon
              name="lock-closed-outline"
              size={18}
              color={isDark ? "#94a3b8" : "#64748b"}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
              style={[styles.input, { color: isDark ? "#fff" : "#0f172a" }]}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
              activeOpacity={0.8}
            >
              <Icon
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            disabled={loading}
            onPress={handleLogin}
            activeOpacity={0.9}
            style={{ width: "100%", marginTop: 10 }}
          >
            <LinearGradient
              colors={
                isDark ? ["#2563eb", "#06b6d4"] : ["#2563eb", "#7c3aed"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.gradientButton,
                { opacity: loading ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer */}
          <Text
            style={[
              styles.footerText,
              { color: isDark ? "#64748b" : "#94a3b8" },
            ]}
          >
            © 2025 Insight Expertz • APC Clinic ERP
          </Text>
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default Login;

/* ========================= */
/* ===== STYLES ============ */
/* ========================= */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  blob: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 360,
  },

  card: {
    width: width > 650 ? 440 : "100%",
    borderRadius: 26,
    padding: 26,
    borderWidth: 1,

    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: "0px 20px 60px rgba(0,0,0,0.12)",
      },
    }),
  },

  logoWrap: {
    alignItems: "center",
    marginBottom: 8,
  },

  logo: {
    width: 160,
    height: 110,
    resizeMode: "contain",
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 4,
  },

  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
  },

  inputWrap: {
    width: "100%",
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  input: {
    flex: 1,
    height: 54,
    fontSize: 15,
    fontWeight: "700",
    ...Platform.select({
      web: { outlineStyle: "none" }
    }),
  },

  eyeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  gradientButton: {
    width: "100%",
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  footerText: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});

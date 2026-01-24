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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../../App";
import { loginUser } from "../services/api";

const LoginBgimg = require("../../assets/images/logo.png");
const { width } = Dimensions.get("window");

const Login = () => {
  const { setUserToken } = useContext(AuthContext);
  const navigation = useNavigation();
  const theme = useColorScheme(); // 🌙 auto dark/light

  const isDark = theme === "dark";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      if (typeof window !== "undefined") {
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
          Alert.alert("Error", "Token not received from server");
          setLoading(false);
          return;
        }

        await AsyncStorage.setItem("token", token);
        setUserToken(token);

        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });

      } else {
        const message =
          response.data.detail ||
          response.data.message ||
          "Invalid username or password";

        Alert.alert("Login Failed", message);
      }

    } catch (error) {
      Alert.alert("Network Error", "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0f172a" : "#f5f7fb" },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: isDark ? "#020617" : "#fff" },
        ]}
      >
        <Image source={LoginBgimg} style={styles.logo} />

        <Text style={[styles.title, { color: isDark ? "#fff" : "#222" }]}>
          Welcome Back 👋
        </Text>
        <Text style={styles.subtitle}>Login to continue</Text>

        {/* Username */}
        <TextInput
          placeholder="Username"
          placeholderTextColor={isDark ? "#94a3b8" : "#999"}
          style={[
            styles.input,
            {
              backgroundColor: isDark ? "#0f172a" : "#fafafa",
              color: isDark ? "#fff" : "#000",
              borderColor: isDark ? "#334155" : "#e0e0e0",
            },
          ]}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        {/* Password */}
        <View
          style={[
            styles.passwordContainer,
            {
              backgroundColor: isDark ? "#0f172a" : "#fafafa",
              borderColor: isDark ? "#334155" : "#e0e0e0",
            },
          ]}
        >
          <TextInput
            placeholder="Password"
            placeholderTextColor={isDark ? "#94a3b8" : "#999"}
            style={[
              styles.passwordInput,
              { color: isDark ? "#fff" : "#000" },
            ]}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.eye}>{showPassword ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {/* 🎨 GRADIENT PROFESSIONAL BUTTON */}
        <TouchableOpacity disabled={loading} onPress={handleLogin} style={{ width: "100%" }}>
          <LinearGradient
            colors={isDark ? ["#0ea5e9", "#2563eb"] : ["#2563eb", "#06b6d4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerText}>© 2025 Insight Expertz</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    width: width > 600 ? 420 : "90%",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  logo: {
    width: 160,
    height: 120,
    resizeMode: "contain",
    marginBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
  },

  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 25,
  },

  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },

  passwordContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
  },

  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
  },

  eye: {
    fontSize: 20,
    paddingHorizontal: 15,
  },

  gradientButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  footerText: {
    marginTop: 20,
    fontSize: 12,
    color: "#94a3b8",
  },
});

export default Login;

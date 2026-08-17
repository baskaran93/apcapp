import "react-native-gesture-handler";
import React, { useState, useEffect, Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { AuthContext } from "./src/context/AuthContext";
import { getMyPermissions } from "./src/services/api";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => { });

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Crashed 😢</Text>
          <Text style={styles.errorText}>
            {this.state.error ? this.state.error.toString() : "Unknown error"}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [permissions, setPermissions] = useState(null);
  const [isReady, setIsReady] = useState(false);

  console.log("[App] Rendering full application component...");

  useEffect(() => {
    console.log("[App] Effect running. Initializing...");

    const prepare = async () => {
      try {
        // Restore a previously logged-in session so the app doesn't force
        // a fresh login on every relaunch/web-reload.
        const [storedToken, storedUsername, storedRole] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("username"),
          AsyncStorage.getItem("role"),
        ]);

        if (storedToken) {
          setUserToken(storedToken);
          setUserName(storedUsername || "");
          setUserRole(storedRole || "");
          try {
            const permsRes = await getMyPermissions();
            setPermissions(permsRes.ok ? permsRes.data.data : null);
          } catch (e) {
            setPermissions(null);
          }
        }

        console.log("[App] Hiding splash screen manually...");
        await SplashScreen.hideAsync();
        console.log("[App] Splash screen hidden.");
      } catch (e) {
        console.warn("[App] Error hiding splash screen:", e);
      } finally {
        setIsReady(true);
      }
    };

    prepare();

    // Fallback timer to force ready state and hide splash
    const timer = setTimeout(() => {
      console.log("[App] Fallback timer triggered.");
      SplashScreen.hideAsync().catch(() => { });
      setIsReady(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    console.log("[App] Not ready yet, showing nothing...");
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthContext.Provider
            value={{
              userToken,
              setUserToken,
              userName,
              setUserName,
              userRole,
              setUserRole,
              permissions,
              setPermissions,
            }}
          >
            <ThemeProvider>
              <NavigationContainer
                onReady={() => console.log("[App] Navigation Container Ready")}
                onStateChange={(state) => console.log("[App] Navigation State Changed")}
              >
                {userToken ? <AppNavigator /> : <AuthNavigator />}
              </NavigationContainer>
            </ThemeProvider>
          </AuthContext.Provider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff"
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "red"
  },
  errorText: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    marginBottom: 20
  },
  retryBtn: {
    padding: 12,
    backgroundColor: "#2563eb",
    borderRadius: 8
  }
});

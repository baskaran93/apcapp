// App.js (FINAL GLOBAL VERSION)

import React, { useState, createContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import "react-native-gesture-handler";
import { ThemeProvider } from "./src/theme/ThemeContext";
import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

export const AuthContext = createContext();

export default function App() {
  const [userToken, setUserToken] = useState(null); // start logged out

  return (
    <AuthContext.Provider value={{ userToken, setUserToken }}>
      🔥{/* GLOBAL THEME PROVIDER */}
      <ThemeProvider>
        <NavigationContainer>
          {userToken ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

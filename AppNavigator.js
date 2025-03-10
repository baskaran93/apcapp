import React, { useContext } from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";
import { View, Text, Button } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { AuthContext } from "./App";
import LoginScreen from "./src/screens/login";
import DashboardScreen from "./src/screens/DashboardScreen";
import PatientProfileScreen from "./src/screens/registration";

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

// ✅ Logout Screen (Handles Logout)
const LogoutScreen = ({ navigation }) => {
  const { setUserToken } = useContext(AuthContext);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Are you sure you want to log out?</Text>
      <Button
        title="Logout"
        onPress={() => {
          setUserToken(null);
          navigation.replace("Login");
        }}
      />
    </View>
  );
};

// ✅ Drawer Navigator (Sidebar)
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true, // ✅ Ensure header is shown to see menu
        drawerStyle: { width: 250 }, // ✅ Adjust drawer width
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Patient Profile"
        component={PatientProfileScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Logout"
        component={LogoutScreen}
        options={{
          drawerIcon: ({ color, size }) => (
            <Icon name="logout" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

// ✅ Stack Navigator (Ensures Drawer is inside a Screen)
function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Home"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default AppNavigator;

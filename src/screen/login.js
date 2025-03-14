import React, { useState, useContext } from "react";
import { 
  Text, 
  SafeAreaView, 
  TextInput, 
  StyleSheet, 
  StatusBar, 
  Image,
  TouchableOpacity ,
  Dimensions
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../../App"; // ✅ Import Auth Context
const LoginBgimg = require("../../assets/images/logo.png");

const Login = () => {
  const { setUserToken } = useContext(AuthContext); // ✅ Get login function
  const navigation = useNavigation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4A90E2" barStyle="light-content" />
      <Image source={LoginBgimg} style={styles.logo} />
      <Text style={styles.welcomeText}>Welcome to Login</Text>

      <TextInput 
        placeholder="Enter Username" 
        placeholderTextColor="#777"
        style={styles.input} 
        value={username} 
        onChangeText={setUsername} 
      />

      <TextInput 
        placeholder="Enter Password" 
        placeholderTextColor="#777"
        style={styles.input} 
        secureTextEntry 
        value={password} 
        onChangeText={setPassword} 
      />

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          setUserToken("loggedin"); // ✅ Set login state
          navigation.reset({ index: 0, routes: [{ name: "Home" }] }); // ✅ Navigate to Drawer
        }}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};
const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  
  logo: {
    width: width > 600 ? 400 : 300,
    height: width > 600 ? 300 : 200,
    resizeMode: "contain",
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  input: {
    width: "90%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingLeft: 15,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#4A90E2",
    paddingVertical: 12,
    borderRadius: 8,
    width: "90%",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default Login;

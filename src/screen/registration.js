import React from "react";
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native"; // Import navigation hook
import { useForm, Controller } from "react-hook-form";
import Icon from "react-native-vector-icons/Ionicons"; // Import Icon Library

const LoginBgimg = require("../../assets/images/logo.png");

const Registration = () => {
  const navigation = useNavigation(); // Access navigation
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const onSubmit = (data) => console.log("Form Data:", data);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.avoidingView}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Back Button */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-back" size={30} color="black" />
            </TouchableOpacity>

            <Image source={LoginBgimg} style={styles.logo} />
            <Text style={styles.title}>Visitor Registration</Text>

            <View style={styles.formContainer}>
              {/* Name */}
              <Text style={styles.label}>Name *</Text>
              <Controller
                control={control}
                rules={{ required: "Name is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="name"
              />
              {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

              {/* Mobile Number */}
              <Text style={styles.label}>Mobile Number (10 digits only) *</Text>
              <Controller
                control={control}
                rules={{
                  required: "Mobile number is required",
                  pattern: {
                    value: /^[0-9]{10}$/,
                    message: "Enter a valid 10-digit number",
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter mobile number"
                    keyboardType="numeric"
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="mobile"
              />
              {errors.mobile && <Text style={styles.error}>{errors.mobile.message}</Text>}

              {/* Pincode */}
              <Text style={styles.label}>Pincode *</Text>
              <Controller
                control={control}
                rules={{ required: "Pincode is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter pincode"
                    keyboardType="numeric"
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="pincode"
              />
              {errors.pincode && <Text style={styles.error}>{errors.pincode.message}</Text>}

              {/* City */}
              <Text style={styles.label}>City *</Text>
              <Controller
                control={control}
                rules={{ required: "City is required" }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter city"
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="city"
              />
              {errors.city && <Text style={styles.error}>{errors.city.message}</Text>}

              {/* Email */}
              <Text style={styles.label}>Email ID *</Text>
              <Controller
                control={control}
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email",
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email ID"
                    keyboardType="email-address"
                    onChangeText={onChange}
                    value={value}
                  />
                )}
                name="email"
              />
              {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

              {/* Submit Button */}
              <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  avoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  backButton: {
    position: "absolute",
    top: 50, // Adjust according to your UI
    left: 20,
    zIndex: 10,
  },
  logo: {
    width: width > 600 ? 400 : 300,
    height: width > 600 ? 300 : 200,
    resizeMode: "contain",
    marginBottom: 20,
  },
  title: {
    fontSize: width > 600 ? 26 : 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "red",
  },
  formContainer: {
    width: width > 600 ? "50%" : "90%", // Adjust form width for larger screens
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
    fontSize: width > 600 ? 18 : 16,
  },
  error: {
    color: "red",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "red",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default Registration;

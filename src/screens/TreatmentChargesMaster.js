import React, { useEffect, useState, useContext } from "react";
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { getTreatmentCharges, addTreatmentCharge } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const TreatmentChargesMaster = () => {
    const navigation = useNavigation();
    const { theme, mode } = useContext(ThemeContext);

    const [charges, setCharges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [treatmentName, setTreatmentName] = useState("");
    const [cost, setCost] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    /* 🔹 LOAD CHARGES */
    const loadCharges = async () => {
        try {
            setLoading(true);
            const response = await getTreatmentCharges();
            if (response.ok) {
                setCharges(response.data);
            } else {
                Alert.alert("Error", "Failed to load treatment charges");
            }
        } catch (error) {
            console.error("API ERROR ", error);
            Alert.alert("Network Error", "Unable to fetch treatment charges");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadCharges();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadCharges();
    };

    /* ➕ ADD CHARGE */
    const handleAddCharge = async () => {
        if (!treatmentName.trim() || !cost.trim()) {
            Alert.alert("Validation", "Treatment Name and Cost are required.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                treatment_name: treatmentName,
                cost: parseFloat(cost),
                description: description,
            };

            const response = await addTreatmentCharge(payload);
            if (response.ok) {
                Alert.alert("Success", "Treatment charge added successfully.");
                setModalVisible(false);
                setTreatmentName("");
                setCost("");
                setDescription("");
                loadCharges();
            } else {
                Alert.alert("Error", "Failed to add treatment charge.");
            }
        } catch (error) {
            console.error("ADD ERROR", error);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    /* 🔹 RENDER ITEM */
    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.treatmentName, { color: theme.text }]}>{item.treatment_name}</Text>
                <Text style={[styles.cost, { color: theme.primary }]}>₹{item.cost}</Text>
            </View>
            {item.description && (
                <Text style={[styles.description, { color: theme.subText }]}>{item.description}</Text>
            )}
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
            <StatusBar
                barStyle={mode === "dark" ? "light-content" : "dark-content"}
                backgroundColor={theme.card}
            />

            {/* HEADER */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Treatment Charges</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtnHeader}>
                    <Icon name="add" size={26} color={theme.primary} />
                </TouchableOpacity>
            </View>

            {/* BODY */}
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <FlatList
                    data={charges}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: "center", marginTop: 50, color: theme.subText }}>
                            No treatment charges found.
                        </Text>
                    }
                />
            </View>

            {/* ADD MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Add New Charge</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Treatment Name *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={treatmentName}
                                onChangeText={setTreatmentName}
                                placeholder="e.g. Root Canal"
                                placeholderTextColor={theme.subText}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Cost (₹) *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={cost}
                                onChangeText={setCost}
                                placeholder="e.g. 5000"
                                placeholderTextColor={theme.subText}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Description</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, height: 80 }]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Optional details..."
                                placeholderTextColor={theme.subText}
                                multiline
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                            onPress={handleAddCharge}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Charge</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        height: 55,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        elevation: 3,
    },
    headerTitle: { fontSize: 18, fontWeight: "700" },
    backBtn: { padding: 5 },
    addBtnHeader: { padding: 5 },
    container: { flex: 1, padding: 15 },
    card: {
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 5,
    },
    treatmentName: { fontSize: 16, fontWeight: "600" },
    cost: { fontSize: 16, fontWeight: "700" },
    description: { fontSize: 14, fontStyle: "italic" },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    modalTitle: { fontSize: 20, fontWeight: "bold" },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 14, marginBottom: 5, fontWeight: "500" },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    saveBtn: {
        marginTop: 10,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

export default TreatmentChargesMaster;

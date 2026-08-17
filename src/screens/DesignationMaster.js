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
    StatusBar,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDesignations, addDesignation, updateDesignation, deleteDesignation } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";

const DesignationMaster = () => {
    const navigation = useNavigation();
    const { theme, mode } = useContext(ThemeContext);

    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDesignation, setEditingDesignation] = useState(null);

    // Form State
    const [designationName, setDesignationName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadDesignations = async () => {
        try {
            setLoading(true);
            const response = await getDesignations();
            if (response.ok) {
                setDesignations(response.data);
            } else {
                Alert.alert("Error", "Failed to load designations");
            }
        } catch (error) {
            console.error("API ERROR ", error);
            Alert.alert("Network Error", "Unable to fetch designations");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDesignations();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadDesignations();
    };

    const openAddModal = () => {
        setEditingDesignation(null);
        setDesignationName("");
        setDescription("");
        setModalVisible(true);
    };

    const openEditModal = (designation) => {
        setEditingDesignation(designation);
        setDesignationName(designation.designation_name);
        setDescription(designation.description || "");
        setModalVisible(true);
    };

    const handleSaveDesignation = async () => {
        if (!designationName.trim()) {
            Alert.alert("Validation", "Designation Name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                designation_name: designationName.trim(),
                description: description,
            };

            const response = editingDesignation
                ? await updateDesignation(editingDesignation.id, payload)
                : await addDesignation(payload);

            if (response.ok) {
                Alert.alert("Success", editingDesignation ? "Designation updated successfully." : "Designation added successfully.");
                setModalVisible(false);
                setEditingDesignation(null);
                setDesignationName("");
                setDescription("");
                loadDesignations();
            } else {
                Alert.alert("Error", response.data?.detail || "Failed to save designation.");
            }
        } catch (error) {
            console.error("SAVE ERROR", error);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDesignation = (designation) => {
        const doDelete = async () => {
            const res = await deleteDesignation(designation.id);
            if (res.ok) {
                loadDesignations();
            } else {
                Alert.alert("Error", res.data?.detail || "Failed to delete designation.");
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm(`Delete "${designation.designation_name}"?`)) doDelete();
        } else {
            Alert.alert("Delete Designation", `Delete "${designation.designation_name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: doDelete },
            ]);
        }
    };

    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.designationName, { color: theme.text }]}>{item.designation_name}</Text>
            </View>
            {item.description && (
                <Text style={[styles.description, { color: theme.subText }]}>{item.description}</Text>
            )}
            <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.rowActionBtn}>
                    <Icon name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteDesignation(item)} style={styles.rowActionBtn}>
                    <Icon name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
            </View>
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Designation Master</Text>
                <TouchableOpacity onPress={openAddModal} style={styles.addBtnHeader}>
                    <Icon name="add" size={26} color={theme.primary} />
                </TouchableOpacity>
            </View>

            {/* BODY */}
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <FlatList
                    data={designations}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: "center", marginTop: 50, color: theme.subText }}>
                            No designations found.
                        </Text>
                    }
                />
            </View>

            {/* ADD / EDIT MODAL */}
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
                            <Text style={[styles.modalTitle, { color: theme.text }]}>
                                {editingDesignation ? "Edit Designation" : "Add New Designation"}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Designation Name *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={designationName}
                                onChangeText={setDesignationName}
                                placeholder="e.g. Physiotherapist"
                                placeholderTextColor={theme.subText}
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
                            onPress={handleSaveDesignation}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>{editingDesignation ? "Update Designation" : "Save Designation"}</Text>
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
    addBtnHeader: { padding: 5, width: 36 },
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
    designationName: { fontSize: 16, fontWeight: "600" },
    description: { fontSize: 14, fontStyle: "italic" },
    rowActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
        marginTop: 10,
    },
    rowActionBtn: { padding: 4 },

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

export default DesignationMaster;

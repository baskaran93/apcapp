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
import { getExpenseTypes, addExpenseType, updateExpenseType, deleteExpenseType } from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";

const ExpenseMaster = () => {
    const navigation = useNavigation();
    const { theme, mode } = useContext(ThemeContext);

    const [expenseTypes, setExpenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingExpenseType, setEditingExpenseType] = useState(null);

    // Form State
    const [expenseTypeName, setExpenseTypeName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadExpenseTypes = async () => {
        try {
            setLoading(true);
            const response = await getExpenseTypes();
            if (response.ok) {
                setExpenseTypes(response.data);
            } else {
                Alert.alert("Error", "Failed to load expense types");
            }
        } catch (error) {
            console.error("API ERROR ", error);
            Alert.alert("Network Error", "Unable to fetch expense types");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadExpenseTypes();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadExpenseTypes();
    };

    const openAddModal = () => {
        setEditingExpenseType(null);
        setExpenseTypeName("");
        setDescription("");
        setModalVisible(true);
    };

    const openEditModal = (expenseType) => {
        setEditingExpenseType(expenseType);
        setExpenseTypeName(expenseType.expense_type_name);
        setDescription(expenseType.description || "");
        setModalVisible(true);
    };

    const handleSaveExpenseType = async () => {
        if (!expenseTypeName.trim()) {
            Alert.alert("Validation", "Expense Type Name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                expense_type_name: expenseTypeName.trim(),
                description: description,
            };

            const response = editingExpenseType
                ? await updateExpenseType(editingExpenseType.id, payload)
                : await addExpenseType(payload);

            if (response.ok) {
                Alert.alert("Success", editingExpenseType ? "Expense type updated successfully." : "Expense type added successfully.");
                setModalVisible(false);
                setEditingExpenseType(null);
                setExpenseTypeName("");
                setDescription("");
                loadExpenseTypes();
            } else {
                Alert.alert("Error", response.data?.detail || "Failed to save expense type.");
            }
        } catch (error) {
            console.error("SAVE ERROR", error);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpenseType = (expenseType) => {
        const doDelete = async () => {
            const res = await deleteExpenseType(expenseType.id);
            if (res.ok) {
                loadExpenseTypes();
            } else {
                Alert.alert("Error", res.data?.detail || "Failed to delete expense type.");
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm(`Delete "${expenseType.expense_type_name}"?`)) doDelete();
        } else {
            Alert.alert("Delete Expense Type", `Delete "${expenseType.expense_type_name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: doDelete },
            ]);
        }
    };

    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.expenseTypeName, { color: theme.text }]}>{item.expense_type_name}</Text>
            </View>
            {item.description && (
                <Text style={[styles.description, { color: theme.subText }]}>{item.description}</Text>
            )}
            <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.rowActionBtn}>
                    <Icon name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteExpenseType(item)} style={styles.rowActionBtn}>
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Expense Master</Text>
                <TouchableOpacity onPress={openAddModal} style={styles.addBtnHeader}>
                    <Icon name="add" size={26} color={theme.primary} />
                </TouchableOpacity>
            </View>

            {/* BODY */}
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <FlatList
                    data={expenseTypes}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: "center", marginTop: 50, color: theme.subText }}>
                            No expense types found.
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
                                {editingExpenseType ? "Edit Expense Type" : "Add New Expense Type"}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.text }]}>Expense Type Name *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={expenseTypeName}
                                onChangeText={setExpenseTypeName}
                                placeholder="e.g. Clinic Rent"
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
                            onPress={handleSaveExpenseType}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>{editingExpenseType ? "Update Expense Type" : "Save Expense Type"}</Text>
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
    expenseTypeName: { fontSize: 16, fontWeight: "600" },
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

export default ExpenseMaster;

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
    Pressable,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    getOfficeExpenses,
    addOfficeExpense,
    updateOfficeExpense,
    deleteOfficeExpense,
    getExpenseTypes,
} from "../services/api";
import { ThemeContext } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons as Icon } from "@expo/vector-icons";

const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DATE_CHIPS = [
    { label: "Today", offset: 0 },
    { label: "Yesterday", offset: -1 },
];

const OfficeExpensesScreen = () => {
    const navigation = useNavigation();
    const { theme, mode } = useContext(ThemeContext);
    const isDark = mode === "dark";

    const [expenses, setExpenses] = useState([]);
    const [expenseTypes, setExpenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);

    // Form State
    const [expenseDate, setExpenseDate] = useState(toDateStr(new Date()));
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [remarks, setRemarks] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadExpenses = async () => {
        try {
            setLoading(true);
            const response = await getOfficeExpenses();
            if (response.ok) {
                setExpenses(Array.isArray(response.data) ? response.data : []);
            } else {
                Alert.alert("Error", "Failed to load expenses");
            }
        } catch (error) {
            console.error("API ERROR ", error);
            Alert.alert("Network Error", "Unable to fetch expenses");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadExpenseTypes = async () => {
        const res = await getExpenseTypes();
        if (res.ok && Array.isArray(res.data)) setExpenseTypes(res.data);
    };

    useEffect(() => {
        loadExpenses();
        loadExpenseTypes();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadExpenses();
    };

    const resetForm = () => {
        setExpenseDate(toDateStr(new Date()));
        setDescription("");
        setAmount("");
        setRemarks("");
    };

    const openAddModal = () => {
        setEditingExpense(null);
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (expense) => {
        setEditingExpense(expense);
        setExpenseDate(expense.expense_date);
        setDescription(expense.description || "");
        setAmount(String(expense.amount ?? ""));
        setRemarks(expense.remarks || "");
        setModalVisible(true);
    };

    const handleSaveExpense = async () => {
        if (!expenseDate.trim()) {
            Alert.alert("Validation", "Date is required.");
            return;
        }
        if (!description.trim()) {
            Alert.alert("Validation", "Description is required.");
            return;
        }
        if (!amount.trim() || isNaN(Number(amount))) {
            Alert.alert("Validation", "Enter a valid amount.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                expense_date: expenseDate.trim(),
                description: description.trim(),
                amount: Number(amount),
                remarks: remarks.trim(),
            };

            const response = editingExpense
                ? await updateOfficeExpense(editingExpense.id, payload)
                : await addOfficeExpense(payload);

            if (response.ok) {
                setModalVisible(false);
                setEditingExpense(null);
                resetForm();
                loadExpenses();
            } else {
                Alert.alert("Error", response.data?.detail || "Failed to save expense.");
            }
        } catch (error) {
            console.error("SAVE ERROR", error);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpense = (expense) => {
        const doDelete = async () => {
            const res = await deleteOfficeExpense(expense.id);
            if (res.ok) {
                loadExpenses();
            } else {
                Alert.alert("Error", res.data?.detail || "Failed to delete expense.");
            }
        };

        if (Platform.OS === "web") {
            if (window.confirm(`Delete "${expense.description}" (₹${expense.amount})?`)) doDelete();
        } else {
            Alert.alert("Delete Expense", `Delete "${expense.description}" (₹${expense.amount})?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: doDelete },
            ]);
        }
    };

    const renderItem = ({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.expenseDesc, { color: theme.text }]}>{item.description}</Text>
                    <Text style={[styles.expenseDate, { color: theme.subText }]}>{item.expense_date}</Text>
                </View>
                <Text style={[styles.amount, { color: theme.primary }]}>₹{item.amount}</Text>
            </View>
            {item.remarks && (
                <Text style={[styles.remarks, { color: theme.subText }]}>{item.remarks}</Text>
            )}
            <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.rowActionBtn}>
                    <Icon name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteExpense(item)} style={styles.rowActionBtn}>
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

    const inputBg = isDark ? "rgba(2,6,23,0.5)" : theme.background;

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={theme.card}
            />

            {/* HEADER */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Office Expenses</Text>
                <TouchableOpacity onPress={openAddModal} style={styles.addBtnHeader}>
                    <Icon name="add" size={26} color={theme.primary} />
                </TouchableOpacity>
            </View>

            {/* BODY */}
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <FlatList
                    data={expenses}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: "center", marginTop: 50, color: theme.subText }}>
                            No expenses recorded yet.
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
                                {editingExpense ? "Edit Expense" : "Add New Expense"}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>Date *</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: theme.border }]}
                                    value={expenseDate}
                                    onChangeText={setExpenseDate}
                                    placeholder="2026-08-07"
                                    placeholderTextColor={theme.subText}
                                />
                                <View style={styles.chipRow}>
                                    {DATE_CHIPS.map((c) => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + c.offset);
                                        const dateStr = toDateStr(d);
                                        return (
                                            <TouchableOpacity
                                                key={c.label}
                                                onPress={() => setExpenseDate(dateStr)}
                                                style={[styles.miniChip, { borderColor: theme.border }]}
                                            >
                                                <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>{c.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>Description *</Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setShowTypePicker(true)}
                                    style={[styles.input, styles.selectInput, { backgroundColor: inputBg, borderColor: theme.border }]}
                                >
                                    <Text style={{ color: description ? theme.text : theme.subText, fontSize: 16 }} numberOfLines={1}>
                                        {description || "Select expense type"}
                                    </Text>
                                    <Icon name="chevron-down-outline" size={16} color={theme.subText} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>Amount (₹) *</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: theme.border }]}
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="e.g. 15000"
                                    placeholderTextColor={theme.subText}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.text }]}>Remarks</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: inputBg, color: theme.text, borderColor: theme.border, height: 80 }]}
                                    value={remarks}
                                    onChangeText={setRemarks}
                                    placeholder="Optional details..."
                                    placeholderTextColor={theme.subText}
                                    multiline
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                                onPress={handleSaveExpense}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>{editingExpense ? "Update Expense" : "Save Expense"}</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Expense Type Picker */}
            <Modal
                visible={showTypePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTypePicker(false)}
            >
                <Pressable style={styles.pickerOverlay} onPress={() => setShowTypePicker(false)}>
                    <Pressable
                        style={[styles.pickerSheet, { backgroundColor: isDark ? "#0f172a" : "#ffffff" }]}
                        onPress={() => {}}
                    >
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: theme.text }]}>Expense Type</Text>
                            <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                                <Icon name="close" size={22} color={theme.subText} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                            {expenseTypes.length === 0 ? (
                                <Text style={[styles.pickerEmptyText, { color: theme.subText }]}>
                                    No expense types configured yet. Add them from Settings → Expense Master.
                                </Text>
                            ) : (
                                expenseTypes.map((et) => {
                                    const selected = description === et.expense_type_name;
                                    return (
                                        <TouchableOpacity
                                            key={et.id}
                                            style={styles.pickerOptionRow}
                                            onPress={() => {
                                                setDescription(et.expense_type_name);
                                                setShowTypePicker(false);
                                            }}
                                        >
                                            <Text style={{ color: theme.text, fontWeight: selected ? "800" : "600" }}>
                                                {et.expense_type_name}
                                            </Text>
                                            {selected && (
                                                <Icon name="checkmark" size={18} color={isDark ? "#3b82f6" : "#2563eb"} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
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
        alignItems: "flex-start",
        marginBottom: 5,
    },
    expenseDesc: { fontSize: 16, fontWeight: "600" },
    expenseDate: { fontSize: 12, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: "700" },
    remarks: { fontSize: 14, fontStyle: "italic" },
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
        maxHeight: "88%",
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
    selectInput: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    chipRow: {
        flexDirection: "row",
        gap: 8,
        marginTop: 8,
    },
    miniChip: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    saveBtn: {
        marginTop: 10,
        padding: 15,
        borderRadius: 10,
        alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

    /* Expense type picker */
    pickerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    pickerSheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 32,
    },
    pickerHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    pickerTitle: { fontSize: 17, fontWeight: "900" },
    pickerOptionRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(148,163,184,0.25)",
    },
    pickerEmptyText: {
        fontSize: 13,
        textAlign: "center",
        paddingVertical: 24,
        lineHeight: 18,
    },
});

export default OfficeExpensesScreen;

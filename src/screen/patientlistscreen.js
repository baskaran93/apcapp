import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

const PatientListScreen = ({ navigation }) => {
  // Dummy patient data
  const [patients, setPatients] = useState([
    { id: '1', name: 'John Doe', age: 32 },
    { id: '2', name: 'Jane Smith', age: 28 },
  ]);

  return (
    <View style={styles.container}>
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.age}>Age: {item.age}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  item: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  name: { fontSize: 18, fontWeight: 'bold' },
  age: { fontSize: 14, color: 'gray' },
});

export default PatientListScreen;

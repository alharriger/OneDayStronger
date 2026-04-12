import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';

// Placeholder — implemented in Phase 3 (Workstream 3D)
export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Session history — coming in Phase 3</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.base,
    padding: Spacing.screenHorizontal,
    paddingTop: 60,
  },
  title: { ...Typography.h1, color: Colors.text.primary },
  subtitle: { ...Typography.body, color: Colors.text.secondary, marginTop: 8 },
});

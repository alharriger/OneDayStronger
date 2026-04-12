import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/theme';

// Placeholder — implemented in Phase 3 (Workstream 3C)
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.subtitle}>Check-in and workout — coming in Phase 3</Text>
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

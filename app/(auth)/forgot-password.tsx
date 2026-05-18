import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme';
import { FormField, Button } from '@/components/ui';
import { resetPassword } from '@/lib/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await resetPassword(email.trim());

    setLoading(false);

    if (result.error) {
      setError('Something went wrong. Please try again.');
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmContainer}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={[styles.subtitle, { marginTop: 16 }]}>
            Tap the link in the email to set a new password, then come back and sign in.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={styles.switchRow}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              <Text style={styles.switchLink}>Back to sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to set a new password.
            </Text>
          </View>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
            error={error ?? undefined}
          />

          <Button
            label="Send reset link"
            onPress={handleReset}
            loading={loading}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.switchRow}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              <Text style={styles.switchLink}>Back to sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.base },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: Spacing.screenHorizontal,
    paddingTop: Spacing.space10,
    gap: Spacing.space6,
  },
  header: { gap: Spacing.space2 },
  title: { ...Typography.display, color: Colors.text.primary },
  subtitle: { ...Typography.bodyLarge, color: Colors.text.secondary },
  switchRow: { alignItems: 'center', paddingVertical: Spacing.space2 },
  switchText: { ...Typography.body, color: Colors.text.secondary },
  switchLink: { color: Colors.primary },
  confirmContainer: {
    flex: 1,
    padding: Spacing.screenHorizontal,
    paddingTop: Spacing.space10,
    gap: Spacing.space4,
  },
  emailHighlight: { color: Colors.text.primary, fontWeight: '600' },
});

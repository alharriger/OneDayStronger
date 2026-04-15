import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme';
import { FormField, Button } from '@/components/ui';
import { signUp } from '@/lib/auth';

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSignUp() {
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await signUp(email.trim(), password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmContainer}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={[styles.subtitle, { marginTop: 16 }]}>
            Tap the link in the email, then come back and sign in.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={styles.switchRow}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              <Text style={styles.switchLink}>Go to sign in</Text>
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
            <Text style={styles.title}>Get started</Text>
            <Text style={styles.subtitle}>
              Create your account to begin your recovery plan
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@example.com"
            />
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 8 characters"
              error={error ?? undefined}
            />
          </View>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              One Day Stronger is an educational tool and is not a substitute for
              professional medical care.
            </Text>
          </View>

          <Button
            label="Create Account"
            onPress={handleSignUp}
            loading={loading}
          />

          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.switchRow}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchLink}>Sign in</Text>
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
  form: { gap: Spacing.space4 },
  disclaimer: {
    backgroundColor: Colors.bg.surface,
    borderRadius: 8,
    padding: Spacing.space3,
  },
  disclaimerText: { ...Typography.bodySmall, color: Colors.text.secondary },
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

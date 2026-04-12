import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/theme';
import { FormField, Button } from '@/components/ui';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await signIn(email.trim(), password);

    setLoading(false);

    if (result.error) {
      setError('Incorrect email or password. Please try again.');
      return;
    }

    // Root layout handles navigation after auth state change
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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your recovery</Text>
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
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              error={error ?? undefined}
            />
          </View>

          <Button
            label="Sign In"
            onPress={handleSignIn}
            loading={loading}
          />

          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            style={styles.switchRow}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              New here?{' '}
              <Text style={styles.switchLink}>Create an account</Text>
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
  switchRow: { alignItems: 'center', paddingVertical: Spacing.space2 },
  switchText: { ...Typography.body, color: Colors.text.secondary },
  switchLink: { color: Colors.primary },
});

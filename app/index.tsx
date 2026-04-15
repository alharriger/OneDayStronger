/**
 * Root route for expo-router.
 *
 * expo-router requires a concrete file at app/index.tsx so that the `/`
 * route is matched. Without this file the router shows "Unmatched route"
 * on initial load before the root layout's auth gate can redirect.
 *
 * All real routing decisions live in app/_layout.tsx.
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(auth)/login" />;
}

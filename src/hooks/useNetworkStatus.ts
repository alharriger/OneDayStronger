/**
 * useNetworkStatus — wraps @react-native-community/netinfo to expose a
 * stable `isOnline` boolean. Initialises to `true` (optimistic) and updates
 * on the first event from NetInfo.
 */
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true);
    });
    return unsubscribe;
  }, []);

  return { isOnline };
}

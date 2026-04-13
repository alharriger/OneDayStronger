import { renderHook, act } from '@testing-library/react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// ─── Mock @react-native-community/netinfo ─────────────────────────────────────

type NetInfoChangeHandler = (state: { isConnected: boolean | null }) => void;
let capturedListener: NetInfoChangeHandler | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((handler: NetInfoChangeHandler) => {
      capturedListener = handler;
      return jest.fn(); // unsubscribe fn
    }),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useNetworkStatus', () => {
  beforeEach(() => {
    capturedListener = null;
    jest.clearAllMocks();
    // Re-wire the mock so capturedListener is captured
    const NetInfo = require('@react-native-community/netinfo').default;
    NetInfo.addEventListener.mockImplementation((handler: NetInfoChangeHandler) => {
      capturedListener = handler;
      return jest.fn();
    });
  });

  it('initialises as online (optimistic default)', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('updates to offline when NetInfo fires isConnected: false', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      capturedListener?.({ isConnected: false });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('updates to online when NetInfo fires isConnected: true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      capturedListener?.({ isConnected: false });
    });
    act(() => {
      capturedListener?.({ isConnected: true });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('treats isConnected: null as offline', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      capturedListener?.({ isConnected: null });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('registers the NetInfo listener on mount', () => {
    const NetInfo = require('@react-native-community/netinfo').default;
    renderHook(() => useNetworkStatus());
    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  });
});

/**
 * Tests for the Sign Up screen.
 *
 * Covers:
 * - Form validation (empty email, short password)
 * - Successful signup transitions to email confirmation screen
 * - signUp errors surface to the user
 * - Email confirmation screen renders the correct email address
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import SignUpScreen from '../../app/(auth)/signup';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/lib/auth', () => ({
  signUp: jest.fn(),
}));

import { signUp } from '@/lib/auth';
const mockSignUp = signUp as jest.Mock;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignUpScreen — form', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    expect(() => render(<SignUpScreen />)).not.toThrow();
  });

  it('displays the Get started title', () => {
    render(<SignUpScreen />);
    expect(screen.getByText('Get started')).toBeTruthy();
  });

  it('displays the Create Account button', () => {
    render(<SignUpScreen />);
    expect(screen.getByText('Create Account')).toBeTruthy();
  });

  it('shows error when email is empty and Create Account is pressed', async () => {
    render(<SignUpScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(screen.getByText(/valid email/i)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'short');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(screen.getByText(/at least 8 characters/i)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls signUp with email and password when form is valid', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'u1' }, error: null });
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows signUp error message when signUp fails', async () => {
    mockSignUp.mockResolvedValue({ user: null, error: 'Email already registered' });
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'existing@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(screen.getByText('Email already registered')).toBeTruthy();
  });
});

describe('SignUpScreen — email confirmation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the confirmation screen after successful signup', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'u1' }, error: null });
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'amber@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(screen.getByText('Check your email')).toBeTruthy();
  });

  it('shows the entered email address on the confirmation screen', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'u1' }, error: null });
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'amber@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    expect(screen.getByText('amber@example.com')).toBeTruthy();
  });

  it('"Go to sign in" link navigates to login', async () => {
    mockSignUp.mockResolvedValue({ user: { id: 'u1' }, error: null });
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'amber@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await act(async () => {
      fireEvent.press(screen.getByText('Create Account'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Go to sign in'));
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});

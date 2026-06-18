/**
 * Unit tests for SOSScreen.
 *
 * Feature: aegispath-phase2-phase3
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2, 11.3
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SOSScreen from '../screens/SOSScreen';
import { useRouteStore } from '../stores/useRouteStore';

// Mock sendSOS service
jest.mock('../services/sendSOS', () => ({
  sendSOS: jest.fn().mockResolvedValue(undefined),
}));

import { sendSOS } from '../services/sendSOS';

const mockNavigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Reset store state
  useRouteStore.setState({ sosActive: false });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SOSScreen', () => {
  it('calls sendSOS once on mount', () => {
    render(<SOSScreen navigation={mockNavigation} />);
    expect(sendSOS).toHaveBeenCalledTimes(1);
  });

  it('shows "Sending Alert…" text initially (done === false)', () => {
    const { getByText } = render(<SOSScreen navigation={mockNavigation} />);
    expect(getByText('Sending Alert…')).toBeTruthy();
  });

  it('does not show checkmark initially', () => {
    const { queryByText } = render(<SOSScreen navigation={mockNavigation} />);
    expect(queryByText('✓')).toBeNull();
  });

  it('shows checkmark and "Alert Sent" after 1500ms', () => {
    const { getByText, queryByText } = render(
      <SOSScreen navigation={mockNavigation} />
    );

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(getByText('✓')).toBeTruthy();
    expect(getByText('Alert Sent')).toBeTruthy();
  });

  it('hides "Sending Alert…" after 1500ms', () => {
    const { queryByText } = render(<SOSScreen navigation={mockNavigation} />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(queryByText('Sending Alert…')).toBeNull();
  });

  it('shows "I\'m Safe Now" button after 1500ms', () => {
    const { getByText } = render(<SOSScreen navigation={mockNavigation} />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(getByText("I'm Safe Now")).toBeTruthy();
  });

  it('"I\'m Safe Now" calls setSosActive(false) and navigates to Home', () => {
    const { getByText } = render(<SOSScreen navigation={mockNavigation} />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    fireEvent.press(getByText("I'm Safe Now"));

    expect(useRouteStore.getState().sosActive).toBe(false);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Home');
  });

  it('"I\'m Safe Now" calls navigate exactly once', () => {
    const { getByText } = render(<SOSScreen navigation={mockNavigation} />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    fireEvent.press(getByText("I'm Safe Now"));

    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('does not crash on mount (null-safe)', () => {
    expect(() =>
      render(<SOSScreen navigation={mockNavigation} />)
    ).not.toThrow();
  });

  it('cleans up the timer on unmount without crashing', () => {
    const { unmount } = render(<SOSScreen navigation={mockNavigation} />);
    expect(() => {
      act(() => {
        unmount();
      });
    }).not.toThrow();
  });
});

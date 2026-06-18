/**
 * Unit tests for SOSButton component.
 *
 * Feature: aegispath-phase2-phase3
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SOSButton from '../components/SOSButton';
import { colors } from '../config/colors';

describe('SOSButton', () => {
  it('renders the "SOS" text', () => {
    const { getByText } = render(<SOSButton onLongPress={() => {}} />);
    expect(getByText('SOS')).toBeTruthy();
  });

  it('invokes onLongPress callback when a long press fires', () => {
    const onLongPress = jest.fn();
    const { getByTestId } = render(<SOSButton onLongPress={onLongPress} />);

    fireEvent(getByTestId('sos-button'), 'longPress');

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('is positioned absolutely in the bottom-right corner', () => {
    const { getByTestId } = render(<SOSButton onLongPress={() => {}} />);

    const button = getByTestId('sos-button');

    // Flatten the style array to a single object for inspection
    const flatStyle = [button.props.style].flat().reduce(
      (acc, s) => (s ? { ...acc, ...s } : acc),
      {}
    );

    expect(flatStyle.position).toBe('absolute');
    expect(flatStyle.bottom).toBe(32);
    expect(flatStyle.right).toBe(24);
  });

  it('has the correct red background colour', () => {
    const { getByTestId } = render(<SOSButton onLongPress={() => {}} />);

    const button = getByTestId('sos-button');

    const flatStyle = [button.props.style].flat().reduce(
      (acc, s) => (s ? { ...acc, ...s } : acc),
      {}
    );

    expect(flatStyle.backgroundColor).toBe(colors.highRisk);
  });

  it('renders as a circle (borderRadius 999, equal width and height)', () => {
    const { getByTestId } = render(<SOSButton onLongPress={() => {}} />);

    const button = getByTestId('sos-button');

    const flatStyle = [button.props.style].flat().reduce(
      (acc, s) => (s ? { ...acc, ...s } : acc),
      {}
    );

    expect(flatStyle.borderRadius).toBe(999);
    expect(flatStyle.width).toBe(64);
    expect(flatStyle.height).toBe(64);
  });

  it('renders "SOS" text in white with correct font weight and size', () => {
    const { getByText } = render(<SOSButton onLongPress={() => {}} />);

    const sosText = getByText('SOS');

    const flatStyle = [sosText.props.style].flat().reduce(
      (acc, s) => (s ? { ...acc, ...s } : acc),
      {}
    );

    expect(flatStyle.color).toBe('#FFFFFF');
    expect(flatStyle.fontWeight).toBe('800');
    expect(flatStyle.fontSize).toBe(16);
  });
});

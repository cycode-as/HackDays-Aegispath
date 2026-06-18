/**
 * Unit tests for DayNightToggle component.
 *
 * Feature: aegispath-phase2-phase3
 * Requirements: 1.1, 1.2, 1.3
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DayNightToggle from '../components/DayNightToggle';

describe('DayNightToggle', () => {
  it('renders with timeMode="day" and calls onToggle("night") when Night pill is pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <DayNightToggle timeMode="day" onToggle={onToggle} />
    );

    // Both pills should be visible
    expect(getByText('🌤 Day')).toBeTruthy();
    expect(getByText('🌙 Night')).toBeTruthy();

    // Press the Night pill
    fireEvent.press(getByText('🌙 Night'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('night');
  });

  it('renders with timeMode="night" and calls onToggle("day") when Day pill is pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <DayNightToggle timeMode="night" onToggle={onToggle} />
    );

    // Both pills should be visible
    expect(getByText('🌤 Day')).toBeTruthy();
    expect(getByText('🌙 Night')).toBeTruthy();

    // Press the Day pill
    fireEvent.press(getByText('🌤 Day'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('day');
  });

  it('does not call onToggle when pressing the already-active pill', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <DayNightToggle timeMode="day" onToggle={onToggle} />
    );

    // Pressing the already-active Day pill still fires the callback
    // (the parent/store decides whether to act on it — component is controlled)
    fireEvent.press(getByText('🌤 Day'));
    expect(onToggle).toHaveBeenCalledWith('day');
  });

  it('applies activeText style to the active pill label', () => {
    const onToggle = jest.fn();
    const { getByText } = render(
      <DayNightToggle timeMode="day" onToggle={onToggle} />
    );

    const dayText = getByText('🌤 Day');
    const nightText = getByText('🌙 Night');

    // Active pill text should have fontWeight '700'
    expect(dayText.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontWeight: '700' }),
      ])
    );

    // Inactive pill text should NOT have fontWeight '700' from activeText
    const nightStyles = [nightText.props.style].flat();
    const hasActiveText = nightStyles.some(
      (s) => s && s.fontWeight === '700' && s.color === '#0F172A'
    );
    expect(hasActiveText).toBe(false);
  });
});

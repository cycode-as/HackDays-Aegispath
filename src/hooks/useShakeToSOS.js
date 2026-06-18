/**
 * useShakeToSOS — Shake gesture detection with configurable countdown.
 *
 * Does NOT immediately trigger SOS.
 * Instead: "Emergency gesture detected. Activating SOS in 15 seconds."
 * User can cancel within the window.
 *
 * Usage:
 *   const { shakeAlert, cancelShakeSOS } = useShakeToSOS(navigation);
 *   // Render <ShakeSOSAlert visible={shakeAlert} onCancel={cancelShakeSOS} />
 */

import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD  = 2.5;   // G-force threshold
const SHAKE_COOLDOWN   = 2000;  // ms between shake detections
const SOS_COUNTDOWN    = 15;    // seconds before auto-trigger

export function useShakeToSOS(onTrigger) {
  const [shakeDetected, setShakeDetected] = useState(false);
  const [countdown, setCountdown]         = useState(SOS_COUNTDOWN);
  const lastShakeTime = useRef(0);
  const countdownRef  = useRef(null);
  const countRef      = useRef(SOS_COUNTDOWN);

  useEffect(() => {
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const total = Math.sqrt(x * x + y * y + z * z);
      const now   = Date.now();
      if (total > SHAKE_THRESHOLD && now - lastShakeTime.current > SHAKE_COOLDOWN) {
        lastShakeTime.current = now;
        triggerShakeAlert();
      }
    });
    return () => sub.remove();
  }, []);

  const triggerShakeAlert = () => {
    if (shakeDetected) return; // already counting down
    countRef.current = SOS_COUNTDOWN;
    setCountdown(SOS_COUNTDOWN);
    setShakeDetected(true);

    countdownRef.current = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        clearInterval(countdownRef.current);
        setShakeDetected(false);
        onTrigger?.();
      }
    }, 1000);
  };

  const cancelShakeSOS = () => {
    clearInterval(countdownRef.current);
    setShakeDetected(false);
    setCountdown(SOS_COUNTDOWN);
  };

  return { shakeDetected, countdown, cancelShakeSOS };
}

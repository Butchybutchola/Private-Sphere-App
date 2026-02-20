/**
 * Panic Gesture Provider
 *
 * Implements the "Quick-Exit" safety feature.
 * A triple-tap anywhere on the screen instantly locks the app
 * behind biometric authentication.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface PanicGestureContextValue {
  isPanicLocked: boolean;
  triggerPanic: () => void;
  unlock: () => void;
}

const PanicGestureContext = createContext<PanicGestureContextValue | null>(null);

const TRIPLE_TAP_TIMEOUT = 500; // ms between taps
const REQUIRED_TAPS = 3;

export function PanicGestureProvider({ children }: { children: ReactNode }) {
  const [isPanicLocked, setIsPanicLocked] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPanic = useCallback(() => {
    setIsPanicLocked(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const unlock = useCallback(() => {
    setIsPanicLocked(false);
  }, []);

  const handleTap = useCallback(() => {
    tapCount.current += 1;

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    if (tapCount.current >= REQUIRED_TAPS) {
      tapCount.current = 0;
      triggerPanic();
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, TRIPLE_TAP_TIMEOUT);
  }, [triggerPanic]);

  return (
    <PanicGestureContext.Provider value={{ isPanicLocked, triggerPanic, unlock }}>
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.container}>{children}</View>
      </TouchableWithoutFeedback>
    </PanicGestureContext.Provider>
  );
}

export function usePanicGesture() {
  const ctx = useContext(PanicGestureContext);
  if (!ctx) throw new Error('usePanicGesture must be used within PanicGestureProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

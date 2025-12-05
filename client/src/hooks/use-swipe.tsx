import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeOptions {
  threshold?: number;
  preventDefaultOnSwipe?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipe(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const { threshold = 50, preventDefaultOnSwipe = false } = options;
  const touchState = useRef<TouchState | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!touchState.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    const deltaTime = Date.now() - touchState.current.startTime;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (deltaTime < 500 && (absX > threshold || absY > threshold)) {
      if (absX > absY) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
          if (preventDefaultOnSwipe) e.preventDefault();
        } else {
          handlers.onSwipeLeft?.();
          if (preventDefaultOnSwipe) e.preventDefault();
        }
      } else {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
          if (preventDefaultOnSwipe) e.preventDefault();
        } else {
          handlers.onSwipeUp?.();
          if (preventDefaultOnSwipe) e.preventDefault();
        }
      }
    }

    touchState.current = null;
  }, [handlers, threshold, preventDefaultOnSwipe]);

  const onTouchCancel = useCallback(() => {
    touchState.current = null;
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    handlers: {
      onTouchStart,
      onTouchEnd,
      onTouchCancel,
    },
  };
}

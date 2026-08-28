import { useRef } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeOptions) {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > threshold) {
      if (distance > 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}

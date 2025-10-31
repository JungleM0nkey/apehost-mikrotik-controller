import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number;
  decimals?: number;
  onComplete?: () => void;
}

/**
 * Custom hook for animated number counting
 * Counts from start to end over specified duration
 */
export const useCountUp = ({
  start = 0,
  end,
  duration = 1000,
  decimals = 0,
  onComplete,
}: UseCountUpOptions): number => {
  const [count, setCount] = useState(start);

  useEffect(() => {
    // If already at target, no animation needed
    if (start === end) {
      setCount(end);
      onComplete?.();
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + duration;
    const range = end - start;

    // Use easeOutQuad easing function for smooth deceleration
    const easeOutQuad = (t: number): number => t * (2 - t);

    const updateCount = () => {
      const now = Date.now();

      if (now >= endTime) {
        setCount(end);
        onComplete?.();
        return;
      }

      const progress = (now - startTime) / duration;
      const easedProgress = easeOutQuad(progress);
      const currentCount = start + range * easedProgress;

      setCount(Number(currentCount.toFixed(decimals)));
      requestAnimationFrame(updateCount);
    };

    const animationFrame = requestAnimationFrame(updateCount);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [start, end, duration, decimals, onComplete]);

  return count;
};

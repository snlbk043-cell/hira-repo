import { useEffect, useRef, useState } from 'react';

/** Animates numeric transitions with an ease-out curve. Returns null through as null. */
export function useCountUp(target: number | null, duration = 650): number | null {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      prevRef.current = null;
      return;
    }
    const from = prevRef.current ?? target;
    prevRef.current = target;
    if (from === target) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

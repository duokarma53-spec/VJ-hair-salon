import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

export function AnimatedCounter({ from = 0, to, duration = 1, prefix = '', suffix = '' }: { from?: number, to: number, duration?: number, prefix?: string, suffix?: string }) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      onUpdate(value) {
        setCount(Math.floor(value));
      },
    });
    return () => controls.stop();
  }, [from, to, duration]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

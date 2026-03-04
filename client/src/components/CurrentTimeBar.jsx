import { useState, useEffect } from 'react';
import { currentTimePH } from '../utils/time.js';

export default function CurrentTimeBar({ hourBlocks }) {
  const [now, setNow] = useState(currentTimePH());

  useEffect(() => {
    const interval = setInterval(() => setNow(currentTimePH()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate position as percentage across the grid
  const [h, m] = now.split(':').map(Number);
  const startHour = 7;
  const endHour = 22;
  const totalMinutes = (endHour - startHour) * 60;
  const currentMinutes = (h - startHour) * 60 + m;

  if (currentMinutes < 0 || currentMinutes > totalMinutes) return null;

  const percentage = (currentMinutes / totalMinutes) * 100;

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
      style={{ left: `${percentage}%` }}
    >
      <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
    </div>
  );
}

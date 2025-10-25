import React from 'react';
import styles from './TrafficIndicator.module.css';

export interface TrafficIndicatorProps {
  direction: 'rx' | 'tx';
  rate: number; // bytes per second
  active: boolean;
}

export const TrafficIndicator: React.FC<TrafficIndicatorProps> = ({
  direction,
  rate,
  active
}) => {
  // Rate-adaptive speed: faster animation for higher traffic
  const getSpeedClass = (): string => {
    if (!active) return 'inactive';
    if (rate > 10_000_000) return 'fast'; // >10 MB/s
    if (rate > 1_000_000) return 'normal'; // >1 MB/s
    return 'slow';
  };

  const speedClass = getSpeedClass();

  // DEBUG: Log to console to verify data
  React.useEffect(() => {
    console.log(`TrafficIndicator ${direction}:`, { rate, active, speedClass });
  }, [direction, rate, active, speedClass]);

  return (
    <div
      className={`${styles.trafficIndicator} ${styles[direction]} ${styles[speedClass]}`}
      aria-hidden="true"
      role="presentation"
      title={`${direction.toUpperCase()}: ${rate} bytes/sec (${speedClass})`}
    >
      <div className={`${styles.pixel} ${styles.pixel1}`} />
      <div className={`${styles.pixel} ${styles.pixel2}`} />
      <div className={`${styles.pixel} ${styles.pixel3}`} />
      <div className={`${styles.pixel} ${styles.pixel4}`} />
    </div>
  );
};

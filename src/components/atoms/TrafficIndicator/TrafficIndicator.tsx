import React from 'react';

export interface TrafficIndicatorProps {
  direction: 'rx' | 'tx';
  rate: number; // bytes per second
  active: boolean;
}

// Minimum traffic threshold to trigger animation (1 KB/s)
// Prevents animation on protocol overhead/keepalive packets
const TRAFFIC_THRESHOLD = 1024;

export const TrafficIndicator: React.FC<TrafficIndicatorProps> = ({
  direction,
  rate,
  active
}) => {
  const color = direction === 'rx' ? '0, 255, 136' : '0, 136, 255';
  const hasSignificantTraffic = rate > TRAFFIC_THRESHOLD;

  // State 1: Interface is DOWN - show gray static pixels
  if (!active) {
    return (
      <div style={{ display: 'inline-flex', gap: '3px', marginRight: '8px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '3px',
              opacity: 0.2,
              backgroundColor: '#555'
            }}
          />
        ))}
      </div>
    );
  }

  // State 2: Interface is UP but no significant traffic - show colored static pixels
  if (!hasSignificantTraffic) {
    return (
      <div style={{ display: 'inline-flex', gap: '3px', marginRight: '8px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '3px',
              opacity: 0.6,
              backgroundColor: `rgb(${color})`,
              boxShadow: `0 0 4px rgba(${color}, 0.3)`
            }}
          />
        ))}
      </div>
    );
  }

  // State 3: Interface is UP with significant traffic - show colored pulsing pixels
  // Rate-adaptive animation timing
  const duration = rate > 10_000_000 ? 600 : rate > 1_000_000 ? 1000 : 1600;
  const scale = rate > 10_000_000 ? 1.6 : rate > 1_000_000 ? 1.4 : 1.2;
  const delays = [0, duration * 0.25, duration * 0.5, duration * 0.75];

  return (
    <div style={{ display: 'inline-flex', gap: '3px', marginRight: '8px' }}>
      {delays.map((delay, i) => (
        <div
          key={i}
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '3px',
            backgroundColor: `rgb(${color})`,
            boxShadow: `0 0 6px rgba(${color}, 0.4)`,
            animation: `pulse ${duration}ms ease-in-out infinite`,
            animationDelay: `${delay}ms`,
            // @ts-ignore - CSS variable
            '--scale': scale.toString()
          }}
        />
      ))}
    </div>
  );
};

import React from 'react';
import styles from './Slider.module.css';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  'aria-label'?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  formatValue = (v) => v.toString(),
  'aria-label': ariaLabel
}) => {
  return (
    <div className={styles.container}>
      <input
        type="range"
        className={styles.slider}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className={styles.value}>{formatValue(value)}</span>
    </div>
  );
};

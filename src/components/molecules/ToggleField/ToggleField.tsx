import React from 'react';
import { Toggle } from '../../atoms/Toggle/Toggle';
import styles from './ToggleField.module.css';

export interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const ToggleField: React.FC<ToggleFieldProps> = ({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  icon
}) => {
  return (
    <div>
      <div className={styles.field}>
        <div className={styles.labelContainer}>
          <span className={styles.label}>{label}</span>
          {icon && <span className={styles.icon}>{icon}</span>}
        </div>
        <Toggle
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={label}
        />
      </div>
      {description && <div className={styles.description}>{description}</div>}
    </div>
  );
};

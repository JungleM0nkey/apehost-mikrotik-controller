import React from 'react';
import styles from './FormField.module.css';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  helpText,
  error,
  children
}) => {
  return (
    <div className={styles.field}>
      <label className={`${styles.label} ${required ? styles.required : ''}`}>
        {label}
      </label>
      {children}
      {error && <span className={styles.error}>{error}</span>}
      {!error && helpText && <span className={styles.helpText}>{helpText}</span>}
    </div>
  );
};

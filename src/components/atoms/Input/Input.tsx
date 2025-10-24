import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'terminal';
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  className,
  ...props
}) => {
  const classNames = [
    styles.input,
    variant === 'terminal' && styles.terminal,
    className
  ].filter(Boolean).join(' ');

  return <input className={classNames} {...props} />;
};

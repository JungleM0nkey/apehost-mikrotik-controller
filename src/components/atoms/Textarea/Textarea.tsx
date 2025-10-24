import React from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea: React.FC<TextareaProps> = ({ className, ...props }) => {
  const classNames = [styles.textarea, className].filter(Boolean).join(' ');

  return <textarea className={classNames} {...props} />;
};

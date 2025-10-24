import React from 'react';
import styles from './WarningBox.module.css';

export interface WarningBoxProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const WarningBox: React.FC<WarningBoxProps> = ({ icon, children }) => {
  return (
    <div className={styles.box}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export const WarningBoxText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={styles.text}>{children}</p>
);

export const WarningBoxHighlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className={styles.highlight}>{children}</strong>
);

export const WarningBoxLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children
}) => (
  <a href={href} className={styles.link} target="_blank" rel="noopener noreferrer">
    {children}
    <span className={styles.linkIcon}>→</span>
  </a>
);

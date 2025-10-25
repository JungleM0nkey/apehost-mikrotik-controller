import React from 'react';
import styles from './SettingsSection.module.css';

export interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  twoColumn?: boolean;
  id?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  twoColumn = false,
  id
}) => {
  return (
    <section className={styles.section} id={id}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={twoColumn ? styles.twoColumn : styles.content}>
        {children}
      </div>
    </section>
  );
};

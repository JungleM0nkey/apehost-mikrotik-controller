import React from 'react';
import { StatusBadge } from '../../atoms/StatusBadge/StatusBadge';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './RouterInfo.module.css';

export interface RouterInfoProps {
  router: RouterInfoType;
}

export const RouterInfo: React.FC<RouterInfoProps> = ({ router }) => {
  return (
    <div className={styles.container}>
      <p className={styles.name}>{router.name}</p>
      <p className={styles.ip}>{router.ipAddress}</p>
      <div className={styles.status}>
        <StatusBadge
          status={router.status}
          label={router.status === 'online' ? 'Online' : router.status === 'offline' ? 'Offline' : 'Connecting'}
        />
      </div>
    </div>
  );
};

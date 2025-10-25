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
      <p className={styles.name}>{router.model}</p>
      <p className={styles.ip}>
        {router.ipAddress}{router.subnet || ''}
      </p>
      {router.macAddress && (
        <p className={styles.ip}>MAC: {router.macAddress}</p>
      )}
      <div className={styles.status}>
        <StatusBadge
          status={router.status}
          label={router.status === 'online' ? 'Online' : router.status === 'offline' ? 'Offline' : 'Connecting'}
        />
      </div>
    </div>
  );
};

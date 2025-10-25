import React from 'react';
import { CloseOutlined, CloudServerOutlined } from '@ant-design/icons';
import { ServiceControl, ServiceInfo } from '../ServiceControl/ServiceControl';
import styles from './ServerModal.module.css';

export interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  frontendStatus: 'online' | 'offline';
  backendStatus: 'online' | 'offline' | 'connecting';
  frontendInfo?: ServiceInfo;
  backendInfo?: ServiceInfo;
  onBackendRestart?: () => void;
  onBackendShutdown?: () => void;
  onBackendRefresh?: () => void;
}

export const ServerModal: React.FC<ServerModalProps> = ({
  isOpen,
  onClose,
  frontendStatus,
  backendStatus,
  frontendInfo,
  backendInfo,
  onBackendRestart,
  onBackendShutdown,
  onBackendRefresh,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <CloudServerOutlined className={styles.titleIcon} />
            <h2>Server Status</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.serviceSection}>
            <h3 className={styles.sectionTitle}>Frontend Service</h3>
            <ServiceControl
              serviceName="Frontend"
              status={frontendStatus}
              serviceInfo={frontendInfo}
              expanded
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.serviceSection}>
            <h3 className={styles.sectionTitle}>Backend Service</h3>
            <ServiceControl
              serviceName="Backend"
              status={backendStatus}
              serviceInfo={backendInfo}
              onRestart={onBackendRestart}
              onShutdown={onBackendShutdown}
              onRefresh={onBackendRefresh}
              expanded
            />
          </div>
        </div>
      </div>
    </>
  );
};

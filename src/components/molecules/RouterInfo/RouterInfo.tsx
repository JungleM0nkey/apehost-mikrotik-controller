import React from 'react';
import { Badge, message } from 'antd';
import { RouterInfo as RouterInfoType } from '../../../types/router';
import styles from './RouterInfo.module.css';

export interface RouterInfoProps {
  router: RouterInfoType;
}

export const RouterInfo: React.FC<RouterInfoProps> = ({ router }) => {
  const [messageApi, contextHolder] = message.useMessage();

  const handleCopy = async (text: string, field: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      messageApi.success(`${field.toUpperCase()} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy:', err);
      messageApi.error('Failed to copy to clipboard');
    }
  };

  return (
    <>
      {contextHolder}
      <div className={styles.container}>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td className={styles.label}>Model</td>
              <td
                className={styles.value}
                onClick={() => handleCopy(router.model, 'model')}
                title="Click to copy"
              >
                {router.model}
              </td>
            </tr>
            <tr>
              <td className={styles.label}>IP</td>
              <td
                className={styles.value}
                onClick={() => handleCopy(`${router.ipAddress}${router.subnet || ''}`, 'ip')}
                title="Click to copy"
              >
                {router.ipAddress}{router.subnet || ''}
              </td>
            </tr>
            {router.macAddress && (
              <tr>
                <td className={styles.label}>MAC</td>
                <td
                  className={styles.value}
                  onClick={() => handleCopy(router.macAddress!, 'mac')}
                  title="Click to copy"
                >
                  {router.macAddress}
                </td>
              </tr>
            )}
            <tr>
              <td className={styles.label}>Status</td>
              <td className={styles.value}>
                <Badge
                  status={
                    router.status === 'online'
                      ? 'success'
                      : router.status === 'connecting'
                      ? 'processing'
                      : 'default'
                  }
                  text={
                    router.status === 'online'
                      ? 'Online'
                      : router.status === 'offline'
                      ? 'Offline'
                      : 'Connecting'
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
};

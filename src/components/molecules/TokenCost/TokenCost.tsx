import React, { useState } from 'react';
import { TokenUsage } from '../../../types/chat';
import { useCountUp } from '../../../hooks/useCountUp';
import styles from './TokenCost.module.css';

export interface TokenCostProps {
  tokenUsage: TokenUsage;
  showDetails?: boolean;
}

export const TokenCost: React.FC<TokenCostProps> = ({
  tokenUsage,
  showDetails = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  const totalTokens = useCountUp({
    start: 0,
    end: tokenUsage.totalTokens,
    duration: 800,
    decimals: 0,
  });

  const promptTokens = useCountUp({
    start: 0,
    end: tokenUsage.promptTokens,
    duration: 800,
    decimals: 0,
  });

  const completionTokens = useCountUp({
    start: 0,
    end: tokenUsage.completionTokens,
    duration: 800,
    decimals: 0,
  });

  const cost = tokenUsage.cost
    ? useCountUp({
        start: 0,
        end: tokenUsage.cost,
        duration: 800,
        decimals: 4,
      })
    : null;

  const toggleDetails = () => setIsExpanded(!isExpanded);

  return (
    <div className={styles.container}>
      <button
        className={styles.summary}
        onClick={toggleDetails}
        type="button"
        aria-expanded={isExpanded}
      >
        <span className={styles.icon}>T</span>
        <span className={styles.totalTokens}>{totalTokens.toLocaleString()}</span>
        {cost !== null && (
          <span className={styles.cost}>${cost.toFixed(4)}</span>
        )}
        <span className={`${styles.arrow} ${isExpanded ? styles.expanded : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Input:</span>
            <span className={styles.value}>{promptTokens.toLocaleString()}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.label}>Output:</span>
            <span className={styles.value}>{completionTokens.toLocaleString()}</span>
          </div>
          <div className={`${styles.detailRow} ${styles.total}`}>
            <span className={styles.label}>Total:</span>
            <span className={styles.value}>{totalTokens.toLocaleString()}</span>
          </div>
          {cost !== null && (
            <div className={`${styles.detailRow} ${styles.costRow}`}>
              <span className={styles.label}>Cost:</span>
              <span className={styles.value}>${cost.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

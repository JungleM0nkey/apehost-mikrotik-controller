import React from 'react';
import type { TokenUsage } from '../../../types/assistant';
import styles from './TokenCostBadge.module.css';

export interface TokenCostBadgeProps {
  usage: TokenUsage;
  compact?: boolean;
}

export const TokenCostBadge: React.FC<TokenCostBadgeProps> = ({
  usage,
  compact = false
}) => {
  if (!usage.cost) {
    // If no cost calculated, just show token counts
    return (
      <div className={styles.badge}>
        <div className={styles.tokens}>
          <span className={styles.tokenCount} title="Total tokens">
            {usage.totalTokens.toLocaleString()} tokens
          </span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={styles.badge}>
        <div className={styles.cost}>
          ${usage.cost.total.toFixed(4)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.badge}>
      <div className={styles.tokens}>
        <span className={styles.tokenCount} title="Prompt tokens">
          {usage.promptTokens.toLocaleString()}
        </span>
        <span className={styles.separator}>+</span>
        <span className={styles.tokenCount} title="Completion tokens">
          {usage.completionTokens.toLocaleString()}
        </span>
        <span className={styles.separator}>=</span>
        <span className={styles.tokenTotal} title="Total tokens">
          {usage.totalTokens.toLocaleString()}
        </span>
      </div>
      <div className={styles.cost} title={`Prompt: $${usage.cost.prompt.toFixed(4)} + Completion: $${usage.cost.completion.toFixed(4)}`}>
        ${usage.cost.total.toFixed(4)}
      </div>
    </div>
  );
};

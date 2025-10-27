/**
 * Learning Dashboard Page
 * Shows AI detection accuracy improvements and learning metrics
 */

import { useEffect, useState } from 'react';
import { Card, Statistic, Progress, Tag, Spin, Alert } from 'antd';
import styles from './LearningDashboardPage.module.css';

interface LearningStats {
  rule_name: string;
  display_name: string;
  total_detections: number;
  false_positive_rate: number;
  improvement_rules: number;
  accuracy_improvement: number;
  last_updated: number;
}

interface LearningResponse {
  success: boolean;
  data: {
    rules: LearningStats[];
    total_rules: number;
    average_fp_rate: number;
  };
  error?: string;
}

export function LearningDashboardPage() {
  const [stats, setStats] = useState<LearningStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avgFPRate, setAvgFPRate] = useState(0);

  useEffect(() => {
    fetchLearningStats();
  }, []);

  const fetchLearningStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agent/learning/stats');
      const data: LearningResponse = await response.json();

      if (data.success) {
        setStats(data.data.rules);
        setAvgFPRate(data.data.average_fp_rate);
      } else {
        setError(data.error || 'Failed to load learning statistics');
      }
    } catch (err) {
      setError('Failed to connect to learning system');
      console.error('[LearningDashboard] Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin size="large" />
          <p className={styles.loadingText}>Loading learning metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>AI Detection Improvements</h1>
          <p className={styles.subtitle}>
            Your feedback is making security detection smarter
          </p>
        </div>
      </header>

      <div className={styles.content}>
        {error && (
          <Alert
            type="error"
            message="Failed to Load Metrics"
            description={error}
            showIcon
            closable
            onClose={() => setError(null)}
            className={styles.errorAlert}
          />
        )}

        {stats.length === 0 && !error && (
          <Alert
            type="info"
            message="No Learning Data Yet"
            description="Learning metrics will appear here once users start providing feedback on security detections."
            showIcon
            className={styles.infoAlert}
          />
        )}

        {stats.length > 0 && (
          <>
            <div className={styles.summaryCard}>
              <Card className={styles.card}>
                <h2 className={styles.cardTitle}>Overall Performance</h2>
                <div className={styles.summaryStats}>
                  <Statistic
                    title="Active Detection Rules"
                    value={stats.length}
                    prefix="🔍"
                  />
                  <Statistic
                    title="Average False Positive Rate"
                    value={`${(avgFPRate * 100).toFixed(1)}%`}
                    suffix={avgFPRate < 0.2 ? '✅' : avgFPRate < 0.4 ? '⚠️' : '❌'}
                    valueStyle={{
                      color: avgFPRate < 0.2 ? '#10b981' : avgFPRate < 0.4 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                  <Statistic
                    title="Total Improvement Rules"
                    value={stats.reduce((sum, s) => sum + s.improvement_rules, 0)}
                    prefix="🎓"
                  />
                </div>
              </Card>
            </div>

            <div className={styles.metricsGrid}>
              {stats.map((metric) => (
                <Card key={metric.rule_name} className={styles.metricCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.metricTitle}>{metric.display_name}</h3>
                    <Tag color={metric.false_positive_rate < 0.1 ? 'success' : metric.false_positive_rate < 0.3 ? 'warning' : 'error'}>
                      {metric.false_positive_rate < 0.1 ? 'Excellent' : metric.false_positive_rate < 0.3 ? 'Good' : 'Needs Improvement'}
                    </Tag>
                  </div>

                  <div className={styles.statsRow}>
                    <Statistic
                      title="False Positive Rate"
                      value={`${(metric.false_positive_rate * 100).toFixed(1)}%`}
                      suffix={metric.false_positive_rate < 0.2 ? '✅' : '⚠️'}
                      valueStyle={{
                        color: metric.false_positive_rate < 0.2 ? '#10b981' : '#ef4444',
                        fontSize: '20px',
                      }}
                    />

                    <Statistic
                      title="Active Learning Rules"
                      value={metric.improvement_rules}
                      prefix="🎓"
                      valueStyle={{ fontSize: '20px' }}
                    />

                    <Statistic
                      title="Accuracy Improvement"
                      value={`${metric.accuracy_improvement > 0 ? '+' : ''}${metric.accuracy_improvement.toFixed(1)}%`}
                      prefix="📈"
                      valueStyle={{
                        color: metric.accuracy_improvement > 0 ? '#10b981' : '#6b6b6b',
                        fontSize: '20px',
                      }}
                    />
                  </div>

                  <div className={styles.progressSection}>
                    <div className={styles.progressLabel}>
                      <span>Detection Accuracy</span>
                      <span className={styles.progressValue}>
                        {(100 - metric.false_positive_rate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      percent={Math.min(100, (1 - metric.false_positive_rate) * 100)}
                      strokeColor={{
                        '0%': '#ef4444',
                        '50%': '#f59e0b',
                        '100%': '#10b981',
                      }}
                      showInfo={false}
                      strokeWidth={8}
                    />
                  </div>

                  <div className={styles.impact}>
                    <p className={styles.impactText}>
                      📊 Learned from <strong>{metric.total_detections}</strong> detection
                      {metric.total_detections !== 1 ? 's' : ''}
                    </p>
                    <p className={styles.updateText}>
                      Last updated: {formatDate(metric.last_updated)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

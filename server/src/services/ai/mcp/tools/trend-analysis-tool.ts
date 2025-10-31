/**
 * Trend Analysis MCP Tool
 * Phase 3: Advanced Intelligence
 *
 * Provides trend analysis and prediction capabilities for system metrics
 */

import { BaseMCPTool } from '../base-tool.js';
import type { ToolExecutionContext, ToolResult, ToolInputSchema } from '../types.js';
import { getAgentDatabase } from '../../../agent/database/agent-db.js';
import type { MetricDataPoint, TrendAnalysis } from '../../../agent/models/types.js';

export class TrendAnalysisTool extends BaseMCPTool {
  readonly name = 'get_trend_analysis';
  readonly description = `Analyze trends and predict future values for system metrics.

Actions:
- analyze: Perform trend analysis on a metric with predictions and anomaly detection
- list_metrics: List all available metrics for analysis

Use this tool to:
- Identify trends in system performance (CPU, memory, network)
- Predict future metric values (next hour, next day)
- Detect anomalies and unusual patterns
- Provide data-driven insights for capacity planning`;

  readonly inputSchema: ToolInputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['analyze', 'list_metrics'],
        description: 'The action to perform',
      },
      metric_name: {
        type: 'string',
        description: 'Name of the metric to analyze (for analyze action)',
      },
      hours: {
        type: 'number',
        description: 'Number of hours of historical data to analyze (default: 24)',
      },
      enable_prediction: {
        type: 'boolean',
        description: 'Enable future value prediction (default: true)',
      },
      anomaly_threshold: {
        type: 'number',
        description: 'Z-score threshold for anomaly detection (default: 2.5)',
      },
    },
    required: ['action'],
  };

  async execute(params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const action = params.action as string;

    try {
      switch (action) {
        case 'analyze':
          return await this.analyzeTrend(params, startTime);
        case 'list_metrics':
          return await this.listMetrics(startTime);
        default:
          return this.error(`Unknown action: ${action}`, startTime);
      }
    } catch (error: any) {
      console.error('[TrendAnalysisTool] Error:', error);
      return this.error(error.message || 'Unknown error occurred', Date.now() - startTime);
    }
  }

  private async analyzeTrend(params: Record<string, unknown>, startTime: number): Promise<ToolResult> {
    const metric_name = params.metric_name as string;
    const hours = (params.hours as number) || 24;
    const enable_prediction = params.enable_prediction !== false; // default true
    const anomaly_threshold = (params.anomaly_threshold as number) || 2.5;

    if (!metric_name) {
      return this.error('Missing required parameter: metric_name', startTime);
    }

    const agentDb = getAgentDatabase();
    const since = Date.now() - (hours * 60 * 60 * 1000);

    // Get historical data
    const dataPoints = agentDb.getMetricsHistory(metric_name, since);

    if (dataPoints.length === 0) {
      return this.error(`No data found for metric: ${metric_name}`, startTime);
    }

    if (dataPoints.length < 5) {
      return this.success({
        metric_name,
        data_points: dataPoints.length,
        message: 'Insufficient data for trend analysis (need at least 5 points)',
        current: dataPoints[0].metric_value,
      }, startTime);
    }

    // Sort by timestamp ascending for time-series analysis
    const sortedData = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate statistics
    const values = sortedData.map(d => d.metric_value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const current = sortedData[sortedData.length - 1].metric_value;

    // Calculate trend using linear regression
    const trend = this.calculateTrend(sortedData);

    // Predict future values if enabled
    let prediction: TrendAnalysis['prediction'] | undefined;
    if (enable_prediction && trend.confidence > 0.5) {
      const lastTimestamp = sortedData[sortedData.length - 1].timestamp;
      const oneHourAhead = lastTimestamp + (60 * 60 * 1000);
      const oneDayAhead = lastTimestamp + (24 * 60 * 60 * 1000);

      prediction = {
        next_hour: this.predictValue(sortedData, oneHourAhead, trend.slope),
        next_day: this.predictValue(sortedData, oneDayAhead, trend.slope),
        confidence: trend.confidence,
      };
    }

    // Detect anomalies using Z-score
    const anomalies = this.detectAnomalies(sortedData, anomaly_threshold);

    const analysis: TrendAnalysis = {
      metric_name,
      data_points: dataPoints.length,
      time_range: {
        start: sortedData[0].timestamp,
        end: sortedData[sortedData.length - 1].timestamp,
        duration_hours: hours,
      },
      statistics: {
        min,
        max,
        avg,
        current,
      },
      trend,
      prediction,
      anomalies,
    };

    return this.success({
      analysis,
      insights: this.generateInsights(analysis),
      recommendation: this.generateRecommendation(analysis),
    }, startTime);
  }

  private async listMetrics(startTime: number): Promise<ToolResult> {
    const agentDb = getAgentDatabase();
    const metricNames = agentDb.getMetricNames();

    return this.success({
      metrics: metricNames,
      count: metricNames.length,
      usage_hint: `Use analyze action with metric_name to get trend analysis`,
    }, startTime);
  }

  /**
   * Calculate trend direction and slope using linear regression
   */
  private calculateTrend(data: MetricDataPoint[]): TrendAnalysis['trend'] {
    if (data.length < 2) {
      return {
        direction: 'stable',
        slope: 0,
        confidence: 0,
      };
    }

    // Normalize timestamps to start from 0 (in hours)
    const startTime = data[0].timestamp;
    const normalizedData = data.map(d => ({
      x: (d.timestamp - startTime) / (60 * 60 * 1000), // hours since start
      y: d.metric_value,
    }));

    // Calculate linear regression: y = mx + b
    const n = normalizedData.length;
    const sumX = normalizedData.reduce((sum, d) => sum + d.x, 0);
    const sumY = normalizedData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = normalizedData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = normalizedData.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Calculate R² (coefficient of determination) for confidence
    const meanY = sumY / n;
    const ssTotal = normalizedData.reduce((sum, d) => sum + Math.pow(d.y - meanY, 2), 0);
    const ssResidual = normalizedData.reduce((sum, d) => {
      const predictedY = slope * d.x + (sumY - slope * sumX) / n;
      return sum + Math.pow(d.y - predictedY, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Determine direction based on slope and confidence
    let direction: 'increasing' | 'decreasing' | 'stable';
    const avgValue = sumY / n;
    const slopePercentage = Math.abs(slope) / avgValue * 100;

    if (rSquared < 0.3 || slopePercentage < 1) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      slope,
      confidence: Math.max(0, Math.min(1, rSquared)), // Clamp to [0, 1]
    };
  }

  /**
   * Predict future value using linear regression
   */
  private predictValue(data: MetricDataPoint[], targetTimestamp: number, slope: number): number {
    const startTime = data[0].timestamp;
    const hoursAhead = (targetTimestamp - startTime) / (60 * 60 * 1000);

    // Calculate intercept
    const n = data.length;
    const normalizedData = data.map(d => ({
      x: (d.timestamp - startTime) / (60 * 60 * 1000),
      y: d.metric_value,
    }));
    const sumX = normalizedData.reduce((sum, d) => sum + d.x, 0);
    const sumY = normalizedData.reduce((sum, d) => sum + d.y, 0);
    const intercept = (sumY - slope * sumX) / n;

    const predicted = slope * hoursAhead + intercept;

    // Clamp to reasonable values (can't be negative for most metrics)
    return Math.max(0, predicted);
  }

  /**
   * Detect anomalies using Z-score method
   */
  private detectAnomalies(
    data: MetricDataPoint[],
    threshold: number
  ): TrendAnalysis['anomalies'] {
    if (data.length < 3) {
      return [];
    }

    const values = data.map(d => d.metric_value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return []; // No variation, no anomalies
    }

    const anomalies: TrendAnalysis['anomalies'] = [];

    for (const point of data) {
      const zScore = (point.metric_value - mean) / stdDev;

      if (Math.abs(zScore) > threshold) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.metric_value,
          z_score: zScore,
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate human-readable insights from analysis
   */
  private generateInsights(analysis: TrendAnalysis): string[] {
    const insights: string[] = [];

    // Trend insights
    if (analysis.trend.confidence > 0.7) {
      if (analysis.trend.direction === 'increasing') {
        insights.push(`Strong upward trend detected (confidence: ${(analysis.trend.confidence * 100).toFixed(1)}%)`);
      } else if (analysis.trend.direction === 'decreasing') {
        insights.push(`Strong downward trend detected (confidence: ${(analysis.trend.confidence * 100).toFixed(1)}%)`);
      }
    } else if (analysis.trend.direction !== 'stable') {
      insights.push(`Weak ${analysis.trend.direction} trend (confidence: ${(analysis.trend.confidence * 100).toFixed(1)}%)`);
    } else {
      insights.push('Metric is stable with no significant trend');
    }

    // Current vs average
    const deviation = ((analysis.statistics.current - analysis.statistics.avg) / analysis.statistics.avg) * 100;
    if (Math.abs(deviation) > 20) {
      insights.push(`Current value is ${Math.abs(deviation).toFixed(1)}% ${deviation > 0 ? 'above' : 'below'} average`);
    }

    // Anomaly insights
    if (analysis.anomalies.length > 0) {
      insights.push(`${analysis.anomalies.length} anomaly(ies) detected in the time period`);
    }

    // Prediction insights
    if (analysis.prediction) {
      const hourChange = ((analysis.prediction.next_hour - analysis.statistics.current) / analysis.statistics.current) * 100;
      if (Math.abs(hourChange) > 5) {
        insights.push(`Predicted ${Math.abs(hourChange).toFixed(1)}% ${hourChange > 0 ? 'increase' : 'decrease'} in next hour`);
      }
    }

    return insights;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendation(analysis: TrendAnalysis): string {
    const metricType = analysis.metric_name.toLowerCase();

    // CPU/Memory warnings
    if (metricType.includes('cpu') || metricType.includes('memory')) {
      if (analysis.statistics.current > 80) {
        if (analysis.trend.direction === 'increasing') {
          return 'Critical: High usage with increasing trend. Consider scaling resources or optimizing workload.';
        }
        return 'Warning: High usage detected. Monitor closely for stability issues.';
      } else if (analysis.prediction && analysis.prediction.next_day > 80) {
        return 'Proactive: Usage predicted to exceed 80% within 24 hours. Plan capacity increase.';
      }
    }

    // Issue count warnings
    if (metricType.includes('issue')) {
      if (analysis.trend.direction === 'increasing' && analysis.trend.confidence > 0.6) {
        return 'Alert: Issue count trending upward. Investigate root causes to prevent system degradation.';
      }
    }

    // Error rate warnings
    if (metricType.includes('error')) {
      if (analysis.anomalies.length > 0) {
        return 'Alert: Error anomalies detected. Review recent changes and system logs.';
      }
    }

    // General health
    if (analysis.trend.direction === 'stable') {
      return 'System metric is stable and within normal operating range.';
    }

    return 'Continue monitoring. No immediate action required.';
  }
}

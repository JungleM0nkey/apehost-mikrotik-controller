import type { IDetectionRule, Issue, RouterState, Category, Severity } from '../models/types.js';
import { randomUUID } from 'crypto';

/**
 * Base class for detection rules
 * Provides common functionality for all rules
 */
export abstract class BaseDetectionRule implements IDetectionRule {
  abstract readonly name: string;
  abstract readonly category: Category;
  abstract readonly severity: Severity;
  abstract readonly description: string;

  /**
   * Detect issues in router state
   * Override this method in subclasses
   */
  abstract detect(state: RouterState): Promise<Issue | null>;

  /**
   * Helper method to create an issue
   */
  protected createIssue(
    title: string,
    description: string,
    recommendation?: string,
    confidence_score = 0.9
  ): Issue {
    return {
      id: randomUUID(),
      detected_at: Date.now(),
      severity: this.severity,
      category: this.category,
      title,
      description,
      recommendation,
      status: 'detected',
      confidence_score,
    };
  }
}

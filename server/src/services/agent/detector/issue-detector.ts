/**
 * Issue Detector Service
 * Runs all detection rules against router state and reports issues
 */

import type { RouterState, Issue, DetectionResult, IDetectionRule, Category } from '../models/types.js';
import { ALL_RULES, getRulesByCategory, getRuleByName } from '../rules/index.js';
import { getAgentDatabase } from '../database/agent-db.js';
import mikrotikService from '../../mikrotik.js';

export class IssueDetector {
  private rules: IDetectionRule[];
  private db = getAgentDatabase();

  constructor(rules?: IDetectionRule[]) {
    this.rules = rules || ALL_RULES;
  }

  /**
   * Collect current router state from all available MCP tools
   */
  private async collectRouterState(): Promise<RouterState> {
    const [
      routerStatus,
      interfaces,
      firewallRules,
      systemResources,
    ] = await Promise.all([
      mikrotikService.getRouterStatus().catch(() => null),
      mikrotikService.getInterfaces().catch(() => []),
      mikrotikService.getFirewallFilterRules().catch(() => []),
      mikrotikService.getSystemResources().catch(() => null),
    ]);

    return {
      router_info: routerStatus,
      interfaces: interfaces,
      firewall_rules: firewallRules,
      system_resources: systemResources,
      timestamp: Date.now(),
    };
  }

  /**
   * Run all detection rules against current router state
   */
  async detectIssues(categories?: Category[]): Promise<Issue[]> {
    const state = await this.collectRouterState();

    // Filter rules by category if specified
    const rulesToRun = categories && categories.length > 0
      ? this.rules.filter(rule => categories.includes(rule.category))
      : this.rules;

    const results = await Promise.all(
      rulesToRun.map(async (rule) => {
        const startTime = Date.now();
        try {
          const issue = await rule.detect(state);
          const executionTime = Date.now() - startTime;

          // Record detection in history (without issue_id - issue not saved yet)
          this.db.recordDetection({
            rule_name: rule.name,
            issue: issue || undefined,
            execution_time_ms: executionTime,
          });

          return issue;
        } catch (error) {
          console.error(`[IssueDetector] Rule ${rule.name} failed:`, error);
          return null;
        }
      })
    );

    // Filter out null results and return detected issues
    return results.filter((issue): issue is Issue => issue !== null);
  }

  /**
   * Run a specific detection rule by name
   */
  async detectByRule(ruleName: string): Promise<Issue | null> {
    const rule = getRuleByName(ruleName);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleName}`);
    }

    const state = await this.collectRouterState();
    const startTime = Date.now();

    try {
      const issue = await rule.detect(state);
      const executionTime = Date.now() - startTime;

      // Record detection in history (without issue_id - issue not saved yet)
      this.db.recordDetection({
        rule_name: rule.name,
        issue: issue || undefined,
        execution_time_ms: executionTime,
      });

      return issue;
    } catch (error) {
      console.error(`[IssueDetector] Rule ${ruleName} failed:`, error);
      throw error;
    }
  }

  /**
   * Deep scan - run all rules and store new issues in database
   * Returns both new and existing active issues
   */
  async performDeepScan(): Promise<{ newIssues: Issue[]; allActiveIssues: Issue[] }> {
    const detectedIssues = await this.detectIssues();
    const newIssues: Issue[] = [];

    for (const issue of detectedIssues) {
      // Check if similar issue already exists
      const existingIssue = this.db.findSimilarIssue(issue.title, issue.category);

      if (!existingIssue) {
        // New issue - store in database
        const createdIssue = this.db.createIssue(issue);
        newIssues.push(createdIssue);
        console.log(`[IssueDetector] New issue detected: ${issue.title}`);
      }
    }

    // Get all active issues
    const allActiveIssues = this.db.getIssues({ status: 'detected' });

    return { newIssues, allActiveIssues };
  }

}

// Singleton instance
let instance: IssueDetector | null = null;

export function getIssueDetector(): IssueDetector {
  if (!instance) {
    instance = new IssueDetector();
  }
  return instance;
}

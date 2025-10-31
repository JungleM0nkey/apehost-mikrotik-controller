import React, { useState } from 'react';
import { Tag } from 'antd';
import { ConversationMetadata } from '../../../utils/conversationStorage';
import styles from './SessionInfoPanel.module.css';

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  risk_level: 'safe' | 'read_only' | 'write' | 'dangerous';
}

export interface AIModelInfo {
  available: boolean;
  provider: string;
  model: string;
  context_window: number | string;
  features: {
    streaming: boolean;
    function_calling: boolean;
  };
  token_costs: {
    prompt_per_1m: number;
    completion_per_1m: number;
    note: string;
  };
}

export interface SessionInfoPanelProps {
  metadata: ConversationMetadata;
  tools: ToolDefinition[];
  modelInfo?: AIModelInfo | null;
  isLoading?: boolean;
  visibleSections?: {
    modelInfo?: boolean;
    sessionInfo?: boolean;
    mostUsedTools?: boolean;
    availableTools?: boolean;
  };
}

export const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  metadata,
  tools,
  modelInfo,
  isLoading = false,
  visibleSections = {
    modelInfo: true,
    sessionInfo: true,
    mostUsedTools: false,
    availableTools: true
  }
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  // Calculate session duration
  const sessionDuration = metadata.session_start
    ? Math.floor((Date.now() - metadata.session_start) / 1000)
    : 0;

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const toggleTool = (toolName: string) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Group tools by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolDefinition[]>);

  // Get risk level badge color
  const getRiskColor = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'safe':
        return '#10b981';
      case 'read_only':
        return '#14b8a6'; // Teal color that complements orange theme
      case 'write':
        return '#f59e0b';
      case 'dangerous':
        return '#ef4444';
      default:
        return '#6b6b6b';
    }
  };

  // Get most used tools
  const toolUsage = metadata.tools_called?.reduce((acc, call) => {
    acc[call.tool_name] = (acc[call.tool_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostUsedTools = Object.entries(toolUsage || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      {/* Collapse/Expand Button */}
      <button
        className={styles.collapseButton}
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={isCollapsed ? styles.chevronLeft : styles.chevronRight}
        >
          <path
            d="M6 12L10 8L6 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {!isCollapsed && (
        <>
          {/* Model Info Section */}
          {visibleSections.modelInfo && modelInfo && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>AI Model</h4>
              {modelInfo.available ? (
                <div className={styles.modelInfoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Model</span>
                    <span className={styles.value}>{modelInfo.model}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Provider</span>
                    <span className={styles.value}>{modelInfo.provider}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Context Window</span>
                    <span className={styles.value}>
                      {typeof modelInfo.context_window === 'number'
                        ? `${modelInfo.context_window.toLocaleString()}`
                        : modelInfo.context_window}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Token Cost</span>
                    <span className={styles.value}>
                      ${modelInfo.token_costs.prompt_per_1m}/${modelInfo.token_costs.completion_per_1m}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.unavailable}>AI Model Unavailable</div>
              )}
            </div>
          )}

          {/* Session Info Section */}
          {visibleSections.sessionInfo && (
          <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Session Info</h4>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Duration</span>
            <span className={styles.value}>{formatDuration(sessionDuration)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.label}>Tool Calls</span>
            <span className={styles.value}>{metadata.total_tool_calls || 0}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.label}>Commands</span>
            <span className={styles.value}>{metadata.total_commands || 0}</span>
          </div>
          {metadata.resolution_status && (
            <div className={styles.infoItem}>
              <span className={styles.label}>Status</span>
              <Tag
                color={
                  metadata.resolution_status === 'resolved'
                    ? 'success'
                    : metadata.resolution_status === 'investigating'
                    ? 'processing'
                    : 'error'
                }
              >
                {metadata.resolution_status}
              </Tag>
            </div>
          )}
        </div>
      </div>
          )}

      {/* Most Used Tools Section */}
      {visibleSections.mostUsedTools && mostUsedTools.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Most Used Tools</h4>
          <div className={styles.toolUsageList}>
            {mostUsedTools.map(([toolName, count]) => (
              <div key={toolName} className={styles.toolUsageItem}>
                <span className={styles.toolName}>{toolName}</span>
                <span className={styles.toolCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Tools Section */}
      {visibleSections.availableTools && (
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          Available Tools
          <span className={styles.toolCount}>{tools.length}</span>
        </h4>

        {isLoading ? (
          <div className={styles.loading}>Loading tools...</div>
        ) : (
          <div className={styles.toolsList}>
            {Object.entries(toolsByCategory).map(([category, categoryTools]) => {
              const isCategoryExpanded = expandedCategories.has(category);
              return (
                <div key={category} className={styles.toolCategory}>
                  <div
                    className={styles.categoryHeader}
                    onClick={() => toggleCategory(category)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.categoryHeaderLeft}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`${styles.categoryChevron} ${isCategoryExpanded ? styles.categoryChevronExpanded : ''}`}
                      >
                        <path
                          d="M3 4.5L6 7.5L9 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className={styles.categoryName}>{category}</span>
                    </div>
                    <span className={styles.categoryCount}>{categoryTools.length}</span>
                  </div>
                  {isCategoryExpanded && (
                    <div className={styles.categoryTools}>
                      {categoryTools.map((tool) => {
                        const isExpanded = expandedTools.has(tool.name);
                        return (
                          <div key={tool.name} className={styles.toolItem}>
                            <div
                              className={styles.toolHeader}
                              onClick={() => toggleTool(tool.name)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.toolHeaderLeft}>
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
                                >
                                  <path
                                    d="M3 4.5L6 7.5L9 4.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span className={styles.toolItemName}>{tool.name}</span>
                              </div>
                              <div
                                className={styles.riskBadge}
                                style={{ backgroundColor: getRiskColor(tool.risk_level) }}
                              >
                                {tool.risk_level}
                              </div>
                            </div>
                            {isExpanded && (
                              <p className={styles.toolDescription}>{tool.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Active Issues Section (if any) */}
      {metadata.active_issue_ids && metadata.active_issue_ids.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Active Issues</h4>
          <div className={styles.issuesList}>
            {metadata.active_issue_ids.map((issueId) => (
              <Tag key={issueId} color="warning">
                {issueId}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Identified Problems Section (if any) */}
      {metadata.identified_problems && metadata.identified_problems.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Identified Problems</h4>
          <ul className={styles.problemsList}>
            {metadata.identified_problems.map((problem, idx) => (
              <li key={idx} className={styles.problemItem}>
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </div>
  );
};

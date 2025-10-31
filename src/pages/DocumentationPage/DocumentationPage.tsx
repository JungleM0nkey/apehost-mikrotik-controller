import React, { useState, useEffect } from 'react';
import { Tabs, Alert, Spin, Tag } from 'antd';
import {
  BookOutlined,
  ApiOutlined,
  ToolOutlined,
  CodeOutlined
} from '@ant-design/icons';
import api from '../../services/api';
import styles from './DocumentationPage.module.css';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const DocumentationPage: React.FC = () => {
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMCPTools();
  }, []);

  const fetchMCPTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getMCPTools();
      setMcpTools(response.tools);
    } catch (err: any) {
      console.error('Failed to fetch MCP tools:', err);
      setError('Failed to load MCP tools documentation');
    } finally {
      setLoading(false);
    }
  };

  const renderAPIDocumentation = () => (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <ApiOutlined /> REST API Endpoints
      </h2>

      <div className={styles.apiGroup}>
        <h3 className={styles.apiGroupTitle}>Router Status & Information</h3>
        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/router/status</code>
          </div>
          <p className={styles.endpointDesc}>Get router system status including CPU, memory, uptime</p>
          <div className={styles.codeBlock}>
            <pre>{`// Response
{
  "cpu": 15,
  "memory": 45,
  "uptime": "5d 12h 30m",
  "version": "7.11.2",
  "model": "RB4011"
}`}</pre>
          </div>
        </div>

        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/router/info</code>
          </div>
          <p className={styles.endpointDesc}>Get detailed router information</p>
        </div>
      </div>

      <div className={styles.apiGroup}>
        <h3 className={styles.apiGroupTitle}>Network Interfaces</h3>
        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/router/interfaces</code>
          </div>
          <p className={styles.endpointDesc}>Get all network interfaces with traffic statistics</p>
        </div>
      </div>

      <div className={styles.apiGroup}>
        <h3 className={styles.apiGroupTitle}>DHCP Management</h3>
        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/router/dhcp/leases</code>
          </div>
          <p className={styles.endpointDesc}>Get all DHCP leases</p>
        </div>
      </div>

      <div className={styles.apiGroup}>
        <h3 className={styles.apiGroupTitle}>Service Information</h3>
        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/service/info</code>
          </div>
          <p className={styles.endpointDesc}>Get backend service information</p>
        </div>

        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/service/ai-info</code>
          </div>
          <p className={styles.endpointDesc}>Get AI model and provider information</p>
        </div>

        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="blue">GET</Tag>
            <code className={styles.endpointPath}>/api/service/mcp-tools</code>
          </div>
          <p className={styles.endpointDesc}>Get all available MCP AI tools</p>
        </div>
      </div>

      <div className={styles.apiGroup}>
        <h3 className={styles.apiGroupTitle}>AI Assistant</h3>
        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <Tag color="green">POST</Tag>
            <code className={styles.endpointPath}>/api/chat</code>
          </div>
          <p className={styles.endpointDesc}>Send message to AI assistant (streaming response)</p>
          <div className={styles.codeBlock}>
            <pre>{`// Request
{
  "message": "Show me DHCP leases",
  "conversationId": "uuid"
}

// Response: SSE stream
data: {"type":"content","text":"Getting DHCP leases..."}
data: {"type":"tool_use","name":"get_dhcp_leases"}
data: {"type":"content","text":"Here are the results..."}
data: [DONE]`}</pre>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMCPToolsDocumentation = () => (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <ToolOutlined /> AI MCP Tools ({mcpTools.length})
      </h2>

      {loading && (
        <div className={styles.loading}>
          <Spin size="large" />
          <p>Loading MCP tools...</p>
        </div>
      )}

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {!loading && !error && (
        <div className={styles.toolsList}>
          {mcpTools.map((tool) => (
            <div key={tool.name} className={styles.tool}>
              <div className={styles.toolHeader}>
                <h3 className={styles.toolName}>
                  <CodeOutlined /> {tool.name}
                </h3>
              </div>
              <p className={styles.toolDescription}>{tool.description}</p>

              {tool.inputSchema && (
                <>
                  <h4 className={styles.subheading}>Parameters:</h4>
                  <div className={styles.parameters}>
                    {Object.entries(tool.inputSchema.properties || {}).map(([paramName, paramDef]: [string, any]) => (
                      <div key={paramName} className={styles.parameter}>
                        <div className={styles.parameterHeader}>
                          <code className={styles.parameterName}>{paramName}</code>
                          {tool.inputSchema.required?.includes(paramName) && (
                            <Tag color="red" className={styles.requiredTag}>required</Tag>
                          )}
                          <Tag color="blue">{paramDef.type}</Tag>
                        </div>
                        {paramDef.description && (
                          <p className={styles.parameterDesc}>{paramDef.description}</p>
                        )}
                        {paramDef.enum && (
                          <div className={styles.enumValues}>
                            <strong>Allowed values:</strong>
                            {paramDef.enum.map((value: string) => (
                              <Tag key={value} className={styles.enumTag}>{value}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const tabItems = [
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined />
          REST API
        </span>
      ),
      children: renderAPIDocumentation(),
    },
    {
      key: 'mcp-tools',
      label: (
        <span>
          <ToolOutlined />
          AI Tools ({mcpTools.length})
        </span>
      ),
      children: renderMCPToolsDocumentation(),
    },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <BookOutlined /> API & AI Documentation
        </h1>
      </header>

      <div className={styles.content}>
        <Tabs items={tabItems} defaultActiveKey="api" />
      </div>
    </div>
  );
};

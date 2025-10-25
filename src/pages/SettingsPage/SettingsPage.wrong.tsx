import React, { useState, useEffect } from 'react';
import {
  Tabs, Form, Input, InputNumber, Switch, Select, Slider, Button,
  Card, Alert, Space, Divider, message, Spin, Typography, Tag,
  Radio
} from 'antd';
import {
  SettingOutlined, ApiOutlined, RobotOutlined, CodeOutlined,
  SafetyOutlined, LockOutlined, ExperimentOutlined, SaveOutlined,
  ReloadOutlined, CheckCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { ServerSettings, UISettings, defaultUISettings } from '../../types/settings';
import styles from './SettingsPage.module.css';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const SettingsPage: React.FC = () => {
  const [serverForm] = Form.useForm();
  const [uiForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [uiSettings, setUISettings] = useState<UISettings>(defaultUISettings);
  const [hasServerChanges, setHasServerChanges] = useState(false);
  const [hasUIChanges, setHasUIChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('server');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load server settings from API
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setServerSettings(data);
        serverForm.setFieldsValue(data);
      }

      // Load UI settings from localStorage
      const savedUISettings = localStorage.getItem('mikrotik-ui-settings');
      if (savedUISettings) {
        const parsed = JSON.parse(savedUISettings);
        setUISettings(parsed);
        uiForm.setFieldsValue(parsed);
      }
    } catch (error) {
      message.error('Failed to load settings');
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServerSave = async () => {
    try {
      setSaving(true);
      const values = await serverForm.validateFields();

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        const result = await response.json();
        message.success(
          <>
            <CheckCircleOutlined style={{ marginRight: 8 }} />
            Settings saved! Please restart the server for changes to take effect.
          </>,
          5
        );
        setServerSettings(result.settings);
        setHasServerChanges(false);
      } else {
        const error = await response.json();
        message.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      message.error('Failed to save settings');
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUISave = () => {
    try {
      const values = uiForm.getFieldsValue();
      localStorage.setItem('mikrotik-ui-settings', JSON.stringify(values));
      setUISettings(values);
      setHasUIChanges(false);
      message.success('UI settings saved!');
    } catch (error) {
      message.error('Failed to save UI settings');
      console.error('Failed to save UI settings:', error);
    }
  };

  const handleReset = () => {
    if (activeTab === 'server') {
      serverForm.setFieldsValue(serverSettings);
      setHasServerChanges(false);
    } else {
      uiForm.setFieldsValue(uiSettings);
      setHasUIChanges(false);
    }
    message.info('Changes discarded');
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} style={{ margin: 0 }}>
          <SettingOutlined style={{ marginRight: 12 }} />
          Settings
        </Title>
        <Paragraph style={{ marginTop: 8, marginBottom: 0, color: 'var(--color-text-secondary)' }}>
          Configure your MikroTik Dashboard server and UI preferences
        </Paragraph>
      </div>

      <div className={styles.content}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
          style={{ marginBottom: 24 }}
        >
          {/* Server Configuration Tab */}
          <TabPane
            tab={
              <span>
                <ApiOutlined />
                Server Configuration
                {hasServerChanges && <Tag color="orange" style={{ marginLeft: 8 }}>Unsaved</Tag>}
              </span>
            }
            key="server"
          >
            <Form
              form={serverForm}
              layout="vertical"
              onValuesChange={() => setHasServerChanges(true)}
            >
              {/* Server Settings */}
              <Card
                title={
                  <span>
                    <ExperimentOutlined style={{ marginRight: 8 }} />
                    Server Settings
                  </span>
                }
                style={{ marginBottom: 24 }}
              >
                <Form.Item
                  label="Server Port"
                  name={['server', 'port']}
                  tooltip="Port number for the backend server (1-65535)"
                  rules={[{ required: true, message: 'Port is required' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="CORS Origin"
                  name={['server', 'corsOrigin']}
                  tooltip="Allowed origin for cross-origin requests"
                  rules={[{ required: true, message: 'CORS origin is required' }]}
                >
                  <Input placeholder="http://localhost:5173" />
                </Form.Item>

                <Form.Item
                  label="Environment"
                  name={['server', 'nodeEnv']}
                  tooltip="Node environment mode"
                >
                  <Radio.Group>
                    <Radio value="development">Development</Radio>
                    <Radio value="production">Production</Radio>
                  </Radio.Group>
                </Form.Item>
              </Card>

              {/* MikroTik Connection */}
              <Card
                title={
                  <span>
                    <ApiOutlined style={{ marginRight: 8 }} />
                    MikroTik Connection
                  </span>
                }
                style={{ marginBottom: 24 }}
              >
                <Form.Item
                  label="Router IP Address / Hostname"
                  name={['mikrotik', 'host']}
                  tooltip="IP address or hostname of your MikroTik router"
                  rules={[{ required: true, message: 'Host is required' }]}
                >
                  <Input placeholder="192.168.88.1 or router.local" />
                </Form.Item>

                <Form.Item
                  label="API Port"
                  name={['mikrotik', 'port']}
                  tooltip="8728 for API, 8729 for API-SSL"
                  rules={[{ required: true, message: 'Port is required' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="Username"
                  name={['mikrotik', 'username']}
                  tooltip="RouterOS admin username"
                  rules={[{ required: true, message: 'Username is required' }]}
                >
                  <Input placeholder="admin" />
                </Form.Item>

                <Form.Item
                  label="Password"
                  name={['mikrotik', 'password']}
                  tooltip="RouterOS admin password"
                  rules={[{ required: true, message: 'Password is required' }]}
                >
                  <Input.Password placeholder="Enter password" />
                </Form.Item>

                <Alert
                  message="Security Notice"
                  description="Credentials are stored in .env file on the server. Keep this file secure and never commit it to version control."
                  type="warning"
                  showIcon
                  icon={<LockOutlined />}
                  style={{ marginTop: 16 }}
                />
              </Card>

              {/* LLM Configuration */}
              <Card
                title={
                  <span>
                    <RobotOutlined style={{ marginRight: 8 }} />
                    AI Assistant (LLM) Configuration
                  </span>
                }
                style={{ marginBottom: 24 }}
              >
                <Form.Item
                  label="LLM Provider"
                  name={['llm', 'provider']}
                  tooltip="Choose between Claude (cloud) or LM Studio (local)"
                >
                  <Radio.Group>
                    <Radio value="claude">Claude (Anthropic)</Radio>
                    <Radio value="lmstudio">LM Studio (Local)</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.llm?.provider !== curr.llm?.provider}>
                  {({ getFieldValue }) => {
                    const provider = getFieldValue(['llm', 'provider']);

                    if (provider === 'claude') {
                      return (
                        <>
                          <Divider />
                          <Title level={5}>Claude Configuration</Title>
                          <Form.Item
                            label="API Key"
                            name={['llm', 'claude', 'apiKey']}
                            tooltip="Get your API key from https://console.anthropic.com/"
                            rules={[{ required: provider === 'claude', message: 'API key required for Claude' }]}
                          >
                            <Input.Password placeholder="sk-ant-api03-..." />
                          </Form.Item>

                          <Form.Item
                            label="Model"
                            name={['llm', 'claude', 'model']}
                            tooltip="Claude model to use"
                          >
                            <Select>
                              <Option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</Option>
                              <Option value="claude-3-opus-20240229">Claude 3 Opus</Option>
                              <Option value="claude-3-haiku-20240307">Claude 3 Haiku</Option>
                            </Select>
                          </Form.Item>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <Divider />
                          <Title level={5}>LM Studio Configuration</Title>
                          <Form.Item
                            label="Server Endpoint"
                            name={['llm', 'lmstudio', 'endpoint']}
                            tooltip="LM Studio server URL (usually http://localhost:1234)"
                            rules={[{ required: provider === 'lmstudio', message: 'Endpoint required for LM Studio' }]}
                          >
                            <Input placeholder="http://localhost:1234" />
                          </Form.Item>

                          <Form.Item
                            label="Model Name"
                            name={['llm', 'lmstudio', 'model']}
                            tooltip="The model loaded in LM Studio"
                            rules={[{ required: provider === 'lmstudio', message: 'Model name required for LM Studio' }]}
                          >
                            <Input placeholder="Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf" />
                          </Form.Item>

                          <Alert
                            message="LM Studio Setup"
                            description="Download LM Studio from lmstudio.ai, load a model, and start the local server before using this option."
                            type="info"
                            showIcon
                            style={{ marginTop: 8 }}
                          />
                        </>
                      );
                    }
                  }}
                </Form.Item>

                <Divider />
                <Title level={5}>Assistant Behavior</Title>

                <Form.Item
                  label={
                    <span>
                      Temperature: <Text type="secondary">{serverForm.getFieldValue(['assistant', 'temperature'])?.toFixed(1) || 0.7}</Text>
                    </span>
                  }
                  name={['assistant', 'temperature']}
                  tooltip="Controls randomness (0 = focused, 2 = creative)"
                >
                  <Slider min={0} max={2} step={0.1} marks={{ 0: '0', 0.7: '0.7', 1: '1', 2: '2' }} />
                </Form.Item>

                <Form.Item
                  label="Max Tokens"
                  name={['assistant', 'maxTokens']}
                  tooltip="Maximum tokens per response"
                >
                  <InputNumber min={100} max={100000} step={256} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  label="System Prompt"
                  name={['assistant', 'systemPrompt']}
                  tooltip="Instructions for the AI assistant's behavior"
                >
                  <TextArea rows={4} placeholder="You are an expert MikroTik router assistant..." />
                </Form.Item>
              </Card>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleReset}
                  disabled={!hasServerChanges || saving}
                  icon={<ReloadOutlined />}
                >
                  Discard Changes
                </Button>
                <Button
                  type="primary"
                  onClick={handleServerSave}
                  disabled={!hasServerChanges}
                  loading={saving}
                  icon={<SaveOutlined />}
                >
                  Save Server Settings
                </Button>
              </div>
            </Form>
          </TabPane>

          {/* UI Preferences Tab */}
          <TabPane
            tab={
              <span>
                <CodeOutlined />
                UI Preferences
                {hasUIChanges && <Tag color="orange" style={{ marginLeft: 8 }}>Unsaved</Tag>}
              </span>
            }
            key="ui"
          >
            <Form
              form={uiForm}
              layout="vertical"
              onValuesChange={() => setHasUIChanges(true)}
            >
              {/* Terminal Configuration */}
              <Card
                title={
                  <span>
                    <CodeOutlined style={{ marginRight: 8 }} />
                    Terminal
                  </span>
                }
                style={{ marginBottom: 24 }}
              >
                <Form.Item
                  label="Font Family"
                  name={['terminal', 'fontFamily']}
                  tooltip="Monospace font for terminal display"
                >
                  <Select>
                    <Option value="JetBrains Mono">JetBrains Mono</Option>
                    <Option value="Fira Code">Fira Code</Option>
                    <Option value="Source Code Pro">Source Code Pro</Option>
                    <Option value="Consolas">Consolas</Option>
                    <Option value="Monaco">Monaco</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      Font Size: <Text type="secondary">{uiForm.getFieldValue(['terminal', 'fontSize'])}px</Text>
                    </span>
                  }
                  name={['terminal', 'fontSize']}
                >
                  <Slider min={8} max={24} marks={{ 8: '8px', 14: '14px', 24: '24px' }} />
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      Line Height: <Text type="secondary">{uiForm.getFieldValue(['terminal', 'lineHeight'])?.toFixed(1)}</Text>
                    </span>
                  }
                  name={['terminal', 'lineHeight']}
                >
                  <Slider min={1.0} max={2.0} step={0.1} marks={{ 1.0: '1.0', 1.5: '1.5', 2.0: '2.0' }} />
                </Form.Item>

                <Form.Item
                  label="Color Scheme"
                  name={['terminal', 'colorScheme']}
                  tooltip="Visual theme for the terminal"
                >
                  <Radio.Group>
                    <Radio value="dark-orange">Dark Orange</Radio>
                    <Radio value="classic-green">Classic Green</Radio>
                    <Radio value="cyan-blue">Cyan Blue</Radio>
                  </Radio.Group>
                </Form.Item>

                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Form.Item name={['terminal', 'syntaxHighlighting']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Enable Syntax Highlighting</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['terminal', 'lineNumbers']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Show Line Numbers</Text>
                      <Switch />
                    </div>
                  </Form.Item>
                </Space>

                <Form.Item
                  label="History Limit (lines)"
                  name={['terminal', 'historyLimit']}
                  tooltip="Number of command history entries to keep"
                  style={{ marginTop: 16 }}
                >
                  <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
                </Form.Item>
              </Card>

              {/* Display Settings */}
              <Card
                title="Display Settings"
                style={{ marginBottom: 24 }}
              >
                <Form.Item
                  label="Timezone"
                  name={['display', 'timezone']}
                  tooltip="Select your preferred timezone"
                >
                  <Select showSearch>
                    <Option value="America/New_York">Eastern Time (ET)</Option>
                    <Option value="America/Chicago">Central Time (CT)</Option>
                    <Option value="America/Denver">Mountain Time (MT)</Option>
                    <Option value="America/Los_Angeles">Pacific Time (PT)</Option>
                    <Option value="Europe/London">London (GMT/BST)</Option>
                    <Option value="Europe/Paris">Paris (CET/CEST)</Option>
                    <Option value="Asia/Tokyo">Tokyo (JST)</Option>
                    <Option value="UTC">UTC</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Time Format"
                  name={['display', 'timeFormat']}
                >
                  <Radio.Group>
                    <Radio value="12h">12-hour (AM/PM)</Radio>
                    <Radio value="24h">24-hour</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  label="Date Format"
                  name={['display', 'dateFormat']}
                  tooltip="Format for date display"
                >
                  <Select>
                    <Option value="MMM DD, YYYY">Jan 01, 2024</Option>
                    <Option value="DD/MM/YYYY">01/01/2024</Option>
                    <Option value="YYYY-MM-DD">2024-01-01</Option>
                  </Select>
                </Form.Item>
              </Card>

              {/* Behavior */}
              <Card
                title="AI Assistant Behavior"
                style={{ marginBottom: 24 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Form.Item name={['behavior', 'enableSuggestions']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text>Enable Command Suggestions</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Show AI-powered command suggestions</Text>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['behavior', 'showExplanations']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text>Show Command Explanations</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Display explanations for suggested commands</Text>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['behavior', 'autoExecuteSafe']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text>Auto-execute Safe Commands</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          <WarningOutlined style={{ color: '#fa8c16', marginRight: 4 }} />
                          Automatically run read-only commands
                        </Text>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['behavior', 'requireConfirmation']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text>Require Confirmation</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Ask before executing critical commands</Text>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>
                </Space>
              </Card>

              {/* Security */}
              <Card
                title={
                  <span>
                    <SafetyOutlined style={{ marginRight: 8 }} />
                    Security & Privacy
                  </span>
                }
                style={{ marginBottom: 24 }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Form.Item name={['security', 'storeCredentials']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Store Credentials Locally</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['security', 'encryptCredentials']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Encrypt Stored Credentials</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['security', 'enableAuditLogging']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Enable Audit Logging</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['security', 'logAiConversations']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Log AI Conversations</Text>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name={['security', 'logRouterCommands']} valuePropName="checked" noStyle>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text>Log Router Commands</Text>
                      <Switch />
                    </div>
                  </Form.Item>
                </Space>

                <Form.Item
                  label="Session Timeout (minutes)"
                  name={['security', 'sessionTimeout']}
                  tooltip="Auto-logout after inactivity"
                  style={{ marginTop: 16 }}
                >
                  <InputNumber min={5} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Card>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleReset}
                  disabled={!hasUIChanges}
                  icon={<ReloadOutlined />}
                >
                  Discard Changes
                </Button>
                <Button
                  type="primary"
                  onClick={handleUISave}
                  disabled={!hasUIChanges}
                  icon={<SaveOutlined />}
                >
                  Save UI Settings
                </Button>
              </div>
            </Form>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Tabs, Slider, Alert, Spin, message } from 'antd';
import { ConnectionStatusCard } from '../../components/molecules/ConnectionStatusCard/ConnectionStatusCard';
import { SettingsSection } from '../../components/organisms/SettingsSection/SettingsSection';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ToggleField } from '../../components/molecules/ToggleField/ToggleField';
import { Input } from '../../components/atoms/Input/Input';
import { Textarea } from '../../components/atoms/Textarea/Textarea';
import { Button } from '../../components/atoms/Button/Button';
import { ServerSettings, UISettings, defaultUISettings } from '../../types/settings';
import styles from './SettingsPage.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface TestResult {
  success: boolean;
  error?: string;
  routerInfo?: {
    name: string;
    model: string;
    version: string;
  };
  providerInfo?: {
    provider: string;
    model: string;
  };
}

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('server');

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Server Settings State
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
  const [hasServerChanges, setHasServerChanges] = useState(false);

  // Track original masked values
  const [originalMaskedPassword, setOriginalMaskedPassword] = useState<string>('');
  const [originalMaskedApiKey, setOriginalMaskedApiKey] = useState<string>('');
  const [originalMaskedCloudflareToken, setOriginalMaskedCloudflareToken] = useState<string>('');

  // Connection test state
  const [mikrotikTest, setMikrotikTest] = useState<TestResult | null>(null);
  const [llmTest, setLLMTest] = useState<TestResult | null>(null);
  const [testingMikrotik, setTestingMikrotik] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);

  // UI Settings State
  const [uiSettings, setUISettings] = useState<UISettings>(defaultUISettings);
  const [hasUIChanges, setHasUIChanges] = useState(false);

  // Map section IDs to their tabs
  const sectionToTabMap: Record<string, string> = {
    'server': 'server',
    'router-api': 'server',
    'ai-assistant': 'server',
    'terminal': 'ui',
    'display': 'ui',
    'security': 'ui',
    'ai-assistant-ui': 'ui'
  };

  // Handle deep linking to specific sections
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && sectionToTabMap[hash]) {
        const targetTab = sectionToTabMap[hash];
        setActiveTab(targetTab);

        // Only scroll if the hash is an actual section ID, not just a tab key
        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [sectionToTabMap]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setServerSettings(data);
        setOriginalMaskedPassword(data.mikrotik.password || '');
        setOriginalMaskedApiKey(data.llm.claude.apiKey || '');
        setOriginalMaskedCloudflareToken(data.llm.cloudflare.apiToken || '');
      }

      const savedUISettings = localStorage.getItem('mikrotik-ui-settings');
      if (savedUISettings) {
        setUISettings(JSON.parse(savedUISettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setNotification({
        type: 'error',
        message: 'Failed to load settings. Please refresh the page.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Test MikroTik connection
  const testMikroTikConnection = async () => {
    if (!serverSettings) return;

    setTestingMikrotik(true);
    setMikrotikTest(null);
    setNotification(null);

    try {
      const response = await fetch(`${API_URL}/api/setup/test-mikrotik`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: serverSettings.mikrotik.host,
          port: serverSettings.mikrotik.port.toString(),
          username: serverSettings.mikrotik.username,
          password: serverSettings.mikrotik.password,
        }),
      });

      const result = await response.json();
      setMikrotikTest(result);

      if (result.success) {
        setNotification({
          type: 'success',
          message: `Connected to ${result.routerInfo.name} (${result.routerInfo.model})`
        });
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Connection test failed'
        });
      }
    } catch (err: any) {
      const errorResult = { success: false, error: err.message };
      setMikrotikTest(errorResult);
      setNotification({
        type: 'error',
        message: 'Failed to test connection: ' + err.message
      });
    } finally {
      setTestingMikrotik(false);
    }
  };

  // Test LLM connection
  const testLLMConnection = async () => {
    if (!serverSettings) return;

    setTestingLLM(true);
    setLLMTest(null);
    setNotification(null);

    try {
      const response = await fetch(`${API_URL}/api/setup/test-llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: serverSettings.llm.provider,
          [serverSettings.llm.provider]: serverSettings.llm[serverSettings.llm.provider],
        }),
      });

      const result = await response.json();
      setLLMTest(result);

      if (result.success) {
        const providerName = serverSettings.llm.provider === 'claude' ? 'Claude API' : 'LMStudio';
        const modelName = result.providerInfo?.model ||
          (serverSettings.llm.provider === 'claude' ? serverSettings.llm.claude.model : serverSettings.llm.lmstudio.model);
        setNotification({
          type: 'success',
          message: `Connected to ${providerName} (${modelName})`
        });
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Connection test failed'
        });
      }
    } catch (err: any) {
      const errorResult = { success: false, error: err.message };
      setLLMTest(errorResult);
      setNotification({
        type: 'error',
        message: 'Failed to test connection: ' + err.message
      });
    } finally {
      setTestingLLM(false);
    }
  };

  const handleServerSave = async () => {
    if (!serverSettings) return;

    try {
      setSaving(true);
      setNotification(null);

      // Build mikrotik settings - exclude password if unchanged
      const { password: mikrotikPassword, ...mikrotikRest } = serverSettings.mikrotik;
      const mikrotikSettings = serverSettings.mikrotik.password !== originalMaskedPassword
        ? serverSettings.mikrotik
        : mikrotikRest as typeof serverSettings.mikrotik;

      // Build claude settings - exclude apiKey if unchanged
      const { apiKey: claudeApiKey, ...claudeRest } = serverSettings.llm.claude;
      const claudeSettings = serverSettings.llm.claude.apiKey !== originalMaskedApiKey
        ? serverSettings.llm.claude
        : claudeRest as typeof serverSettings.llm.claude;

      // Build cloudflare settings - exclude apiToken if unchanged
      const { apiToken: cloudflareToken, ...cloudflareRest } = serverSettings.llm.cloudflare;
      const cloudflareSettings = serverSettings.llm.cloudflare.apiToken !== originalMaskedCloudflareToken
        ? serverSettings.llm.cloudflare
        : cloudflareRest as typeof serverSettings.llm.cloudflare;

      const settingsToSave = {
        ...serverSettings,
        mikrotik: mikrotikSettings,
        llm: {
          ...serverSettings.llm,
          claude: claudeSettings,
          cloudflare: cloudflareSettings
        }
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      });

      if (response.ok) {
        const result = await response.json();
        setHasServerChanges(false);

        // Reload settings to sync state with backend and update masked values
        await loadSettings();

        // Show success toast
        message.success(result.message || 'Server settings saved successfully!');
      } else {
        const error = await response.json();
        message.error(error.error || error.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('An unexpected error occurred while saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUISave = () => {
    try {
      localStorage.setItem('mikrotik-ui-settings', JSON.stringify(uiSettings));
      setHasUIChanges(false);
      message.success('UI settings saved successfully!');
    } catch (error) {
      console.error('Failed to save UI settings:', error);
      message.error('Unable to save UI settings to local storage');
    }
  };

  const updateServerSettings = <K extends keyof ServerSettings>(
    section: K,
    field: keyof ServerSettings[K],
    value: any
  ) => {
    if (!serverSettings) return;
    setServerSettings({
      ...serverSettings,
      [section]: {
        ...serverSettings[section],
        [field]: value
      }
    });
    setHasServerChanges(true);
    // Clear test results when settings change
    if (section === 'mikrotik') {
      setMikrotikTest(null);
    } else if (section === 'llm' || section === 'assistant') {
      setLLMTest(null);
    }
  };

  const updateUISettings = <K extends keyof UISettings>(
    section: K,
    field: keyof UISettings[K],
    value: any
  ) => {
    setUISettings({
      ...uiSettings,
      [section]: {
        ...uiSettings[section],
        [field]: value
      }
    });
    setHasUIChanges(true);
  };

  const updateLLMProviderSettings = (
    provider: 'claude' | 'lmstudio' | 'cloudflare',
    field: string,
    value: any
  ) => {
    if (!serverSettings) return;
    setServerSettings({
      ...serverSettings,
      llm: {
        ...serverSettings.llm,
        [provider]: {
          ...serverSettings.llm[provider],
          [field]: value
        }
      }
    });
    setHasServerChanges(true);
    setLLMTest(null);
  };

  const handleRestartSetup = async () => {
    try {
      const response = await fetch('/api/setup/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const error = await response.json();
        setNotification({
          type: 'error',
          message: error.error || 'Unable to restart setup wizard'
        });
      }
    } catch (error) {
      console.error('Failed to restart setup:', error);
      setNotification({
        type: 'error',
        message: 'An unexpected error occurred'
      });
    }
  };

  if (loading || !serverSettings) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="Loading settings..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.content}>
        {/* Connection Status Cards */}
        <div className={styles.statusCards}>
          <ConnectionStatusCard
            title="MikroTik Router"
            status={mikrotikTest?.success ? 'connected' : testingMikrotik ? 'testing' : 'disconnected'}
            details={mikrotikTest?.success && mikrotikTest.routerInfo ? [
              { label: 'Host', value: `${serverSettings.mikrotik.host}:${serverSettings.mikrotik.port}` },
              { label: 'Name', value: mikrotikTest.routerInfo.name },
              { label: 'Model', value: mikrotikTest.routerInfo.model },
            ] : [
              { label: 'Host', value: `${serverSettings.mikrotik.host}:${serverSettings.mikrotik.port}` },
            ]}
            error={mikrotikTest?.error}
            onTest={testMikroTikConnection}
            testLoading={testingMikrotik}
          />
          <ConnectionStatusCard
            title="AI Assistant"
            status={llmTest?.success ? 'connected' : testingLLM ? 'testing' : 'disconnected'}
            details={[
              {
                label: 'Provider',
                value: serverSettings.llm.provider === 'claude' ? 'Claude (Anthropic)' : 'LMStudio (Local)'
              },
              ...(llmTest?.success && llmTest.providerInfo ? [
                { label: 'Model', value: llmTest.providerInfo.model }
              ] : [])
            ]}
            error={llmTest?.error}
            onTest={testLLMConnection}
            testLoading={testingLLM}
          />
        </div>

        {/* Inline Notification */}
        {notification && (
          <Alert
            type={notification.type}
            message={notification.message}
            closable
            onClose={() => setNotification(null)}
            showIcon
            style={{ marginBottom: 'var(--space-xl)' }}
          />
        )}

        <div className={styles.tabsContainer}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="line"
            size="large"
            items={[
              {
                key: 'server',
                label: (
                  <span>
                    Server Configuration
                    {hasServerChanges && <span className={styles.unsavedBadge}>●</span>}
                  </span>
                ),
                children: (
                  <div className={styles.tabContent}>
                    {/* Server Settings */}
                    <div id="server">
                      <SettingsSection
                        title="Server Settings"
                        description="Configure backend server settings"
                      >
                        <FormField label="Server Port" helpText="Port number for the backend server (1-65535)">
                          <Input
                            type="number"
                            value={serverSettings.server.port}
                            onChange={(e) => updateServerSettings('server', 'port', parseInt(e.target.value))}
                          />
                        </FormField>

                        <FormField label="CORS Origin" helpText="Allowed origin for cross-origin requests">
                          <Input
                            value={serverSettings.server.corsOrigin}
                            onChange={(e) => updateServerSettings('server', 'corsOrigin', e.target.value)}
                            placeholder="http://localhost:5173"
                          />
                        </FormField>

                        <FormField label="Environment">
                          <select
                            className={styles.select}
                            value={serverSettings.server.nodeEnv}
                            onChange={(e) => updateServerSettings('server', 'nodeEnv', e.target.value)}
                          >
                            <option value="development">Development</option>
                            <option value="production">Production</option>
                          </select>
                        </FormField>
                      </SettingsSection>
                    </div>

                    {/* MikroTik Connection */}
                    <div id="router-api">
                      <SettingsSection
                        title="MikroTik Connection"
                        description="Configure connection to MikroTik RouterOS via API"
                      >
                        <FormField label="Router IP Address / Hostname" helpText="IP address or hostname of your MikroTik router">
                          <Input
                            value={serverSettings.mikrotik.host}
                            onChange={(e) => updateServerSettings('mikrotik', 'host', e.target.value)}
                            placeholder="192.168.88.1 or router.local"
                          />
                        </FormField>

                        <FormField label="API Port" helpText="8728 for API, 8729 for API-SSL">
                          <Input
                            type="number"
                            value={serverSettings.mikrotik.port}
                            onChange={(e) => updateServerSettings('mikrotik', 'port', parseInt(e.target.value))}
                          />
                        </FormField>

                        <FormField label="Username" helpText="RouterOS admin username">
                          <Input
                            value={serverSettings.mikrotik.username}
                            onChange={(e) => updateServerSettings('mikrotik', 'username', e.target.value)}
                            placeholder="admin"
                          />
                        </FormField>

                        <FormField label="Password" helpText="RouterOS admin password">
                          <Input
                            type="password"
                            value={serverSettings.mikrotik.password}
                            onChange={(e) => updateServerSettings('mikrotik', 'password', e.target.value)}
                            placeholder="Enter password"
                          />
                        </FormField>

                        <div className={styles.toggleGroup}>
                          <Alert
                            message="Security Notice"
                            description="Credentials are stored in config.json on the server. Keep this file secure and never commit it to version control."
                            type="warning"
                            showIcon
                          />
                        </div>
                      </SettingsSection>
                    </div>

                    {/* LLM Configuration */}
                    <div id="ai-assistant">
                      <SettingsSection
                        title="AI Assistant (LLM) Configuration"
                        description="Configure AI language model provider and behavior"
                      >
                        <FormField label="LLM Provider">
                          <div className={styles.providerSection}>
                            <div
                              className={`${styles.providerOption} ${serverSettings.llm.provider === 'claude' ? styles.active : ''}`}
                              onClick={() => updateServerSettings('llm', 'provider', 'claude')}
                            >
                              <div className={styles.providerHeader}>
                                <div className={styles.providerRadio}>
                                  {serverSettings.llm.provider === 'claude' && <div className={styles.providerRadioActive}></div>}
                                </div>
                                <div className={styles.providerTitle}>Claude (Anthropic)</div>
                              </div>
                              <div className={styles.providerDescription}>
                                Cloud-based AI with high quality responses
                              </div>
                            </div>

                            <div
                              className={`${styles.providerOption} ${serverSettings.llm.provider === 'lmstudio' ? styles.active : ''}`}
                              onClick={() => updateServerSettings('llm', 'provider', 'lmstudio')}
                            >
                              <div className={styles.providerHeader}>
                                <div className={styles.providerRadio}>
                                  {serverSettings.llm.provider === 'lmstudio' && <div className={styles.providerRadioActive}></div>}
                                </div>
                                <div className={styles.providerTitle}>LM Studio (Local)</div>
                              </div>
                              <div className={styles.providerDescription}>
                                Run models locally on your machine
                              </div>
                            </div>

                            <div
                              className={`${styles.providerOption} ${serverSettings.llm.provider === 'cloudflare' ? styles.active : ''}`}
                              onClick={() => updateServerSettings('llm', 'provider', 'cloudflare')}
                            >
                              <div className={styles.providerHeader}>
                                <div className={styles.providerRadio}>
                                  {serverSettings.llm.provider === 'cloudflare' && <div className={styles.providerRadioActive}></div>}
                                </div>
                                <div className={styles.providerTitle}>Cloudflare Workers AI</div>
                              </div>
                              <div className={styles.providerDescription}>
                                Workers AI comes with a curated set of popular open-source models
                              </div>
                            </div>
                          </div>
                        </FormField>

                        {serverSettings.llm.provider === 'claude' ? (
                          <>
                            <h3 className={styles.subsectionTitle}>Claude Configuration</h3>
                            <FormField label="API Key" helpText="Get your API key from https://console.anthropic.com/">
                              <Input
                                type="password"
                                value={serverSettings.llm.claude.apiKey}
                                onChange={(e) => updateLLMProviderSettings('claude', 'apiKey', e.target.value)}
                                placeholder="sk-ant-api03-..."
                              />
                            </FormField>

                            <FormField label="Model">
                              <select
                                className={styles.select}
                                value={serverSettings.llm.claude.model}
                                onChange={(e) => updateLLMProviderSettings('claude', 'model', e.target.value)}
                              >
                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                              </select>
                            </FormField>
                          </>
                        ) : serverSettings.llm.provider === 'lmstudio' ? (
                          <>
                            <h3 className={styles.subsectionTitle}>LM Studio Configuration</h3>
                            <FormField label="Server Endpoint" helpText="LM Studio server URL (usually http://localhost:1234)">
                              <Input
                                value={serverSettings.llm.lmstudio.endpoint}
                                onChange={(e) => updateLLMProviderSettings('lmstudio', 'endpoint', e.target.value)}
                                placeholder="http://localhost:1234"
                              />
                            </FormField>

                            <FormField label="Model Name" helpText="The model loaded in LM Studio">
                              <Input
                                value={serverSettings.llm.lmstudio.model}
                                onChange={(e) => updateLLMProviderSettings('lmstudio', 'model', e.target.value)}
                                placeholder="Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf"
                              />
                            </FormField>

                            <FormField label="Context Window" helpText="Maximum context size in tokens (e.g., 32768, 8192, 4096)">
                              <Input
                                type="number"
                                value={serverSettings.llm.lmstudio.contextWindow}
                                onChange={(e) => updateLLMProviderSettings('lmstudio', 'contextWindow', parseInt(e.target.value) || 32768)}
                                placeholder="32768"
                              />
                            </FormField>
                          </>
                        ) : (
                          <>
                            <h3 className={styles.subsectionTitle}>Cloudflare Workers AI Configuration</h3>
                            <FormField label="Account ID" helpText="Get your Account ID from Cloudflare dashboard">
                              <Input
                                value={serverSettings.llm.cloudflare.accountId}
                                onChange={(e) => updateLLMProviderSettings('cloudflare', 'accountId', e.target.value)}
                                placeholder="your_cloudflare_account_id"
                              />
                            </FormField>

                            <FormField label="API Token" helpText="Create an API token with Workers AI permissions">
                              <Input
                                type="password"
                                value={serverSettings.llm.cloudflare.apiToken}
                                onChange={(e) => updateLLMProviderSettings('cloudflare', 'apiToken', e.target.value)}
                                placeholder="your_api_token"
                              />
                            </FormField>

                            <FormField label="Model">
                              <select
                                className={styles.select}
                                value={serverSettings.llm.cloudflare.model}
                                onChange={(e) => updateLLMProviderSettings('cloudflare', 'model', e.target.value)}
                              >
                                <option value="@cf/meta/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B (Recommended)</option>
                              </select>
                            </FormField>

                            <FormField label="AI Gateway (Optional)" helpText="Optional: AI Gateway name for caching and analytics">
                              <Input
                                value={serverSettings.llm.cloudflare.gateway || ''}
                                onChange={(e) => updateLLMProviderSettings('cloudflare', 'gateway', e.target.value || undefined)}
                                placeholder="my-gateway-name"
                              />
                            </FormField>
                          </>
                        )}

                        <h3 className={styles.subsectionTitle}>Assistant Behavior</h3>

                        <div className={styles.sliderContainer}>
                          <div className={styles.sliderLabel}>
                            <span className={styles.sliderLabelText}>Temperature</span>
                            <span className={styles.sliderValue}>{serverSettings.assistant.temperature.toFixed(1)}</span>
                          </div>
                          <Slider
                            min={0}
                            max={2}
                            step={0.1}
                            value={serverSettings.assistant.temperature}
                            onChange={(value) => updateServerSettings('assistant', 'temperature', value)}
                            marks={{ 0: '0', 0.7: '0.7', 1: '1', 2: '2' }}
                          />
                        </div>

                        <FormField label="Max Tokens" helpText="Maximum tokens per response">
                          <Input
                            type="number"
                            value={serverSettings.assistant.maxTokens}
                            onChange={(e) => updateServerSettings('assistant', 'maxTokens', parseInt(e.target.value))}
                          />
                        </FormField>

                        <FormField label="System Prompt" helpText="Instructions for the AI assistant's behavior">
                          <Textarea
                            rows={4}
                            value={serverSettings.assistant.systemPrompt}
                            onChange={(e) => updateServerSettings('assistant', 'systemPrompt', e.target.value)}
                            placeholder="You are an expert MikroTik router assistant..."
                          />
                        </FormField>
                      </SettingsSection>
                    </div>

                    {/* Setup & Maintenance */}
                    <SettingsSection
                      title="Setup & Maintenance"
                      description="Manage application setup and configuration"
                    >
                      <FormField
                        label="Re-run Setup Wizard"
                        helpText="Start the initial setup wizard to reconfigure MikroTik connection and LLM settings"
                      >
                        <Button
                          variant="secondary"
                          onClick={handleRestartSetup}
                        >
                          Re-run Setup Wizard
                        </Button>
                      </FormField>
                    </SettingsSection>
                  </div>
                )
              },
              {
                key: 'ui',
                label: (
                  <span>
                    UI Preferences
                    {hasUIChanges && <span className={styles.unsavedBadge}>●</span>}
                  </span>
                ),
                children: (
                  <div className={styles.tabContent}>
                    {/* Terminal Configuration */}
                    <div id="terminal">
                      <SettingsSection
                        title="Terminal"
                        description="Customize terminal appearance and behavior"
                      >
                        <FormField label="Font Family">
                          <select
                            className={styles.select}
                            value={uiSettings.terminal.fontFamily}
                            onChange={(e) => updateUISettings('terminal', 'fontFamily', e.target.value)}
                          >
                            <option value="JetBrains Mono">JetBrains Mono</option>
                            <option value="Fira Code">Fira Code</option>
                            <option value="Source Code Pro">Source Code Pro</option>
                            <option value="Consolas">Consolas</option>
                            <option value="Monaco">Monaco</option>
                          </select>
                        </FormField>

                        <div className={styles.sliderContainer}>
                          <div className={styles.sliderLabel}>
                            <span className={styles.sliderLabelText}>Font Size</span>
                            <span className={styles.sliderValue}>{uiSettings.terminal.fontSize}px</span>
                          </div>
                          <Slider
                            min={8}
                            max={24}
                            value={uiSettings.terminal.fontSize}
                            onChange={(value) => updateUISettings('terminal', 'fontSize', value)}
                            marks={{ 8: '8px', 14: '14px', 24: '24px' }}
                          />
                        </div>

                        <div className={styles.sliderContainer}>
                          <div className={styles.sliderLabel}>
                            <span className={styles.sliderLabelText}>Line Height</span>
                            <span className={styles.sliderValue}>{uiSettings.terminal.lineHeight.toFixed(1)}</span>
                          </div>
                          <Slider
                            min={1.0}
                            max={2.0}
                            step={0.1}
                            value={uiSettings.terminal.lineHeight}
                            onChange={(value) => updateUISettings('terminal', 'lineHeight', value)}
                            marks={{ 1.0: '1.0', 1.5: '1.5', 2.0: '2.0' }}
                          />
                        </div>

                        <FormField label="Color Scheme">
                          <select
                            className={styles.select}
                            value={uiSettings.terminal.colorScheme}
                            onChange={(e) => updateUISettings('terminal', 'colorScheme', e.target.value as any)}
                          >
                            <option value="dark-orange">Dark Orange</option>
                            <option value="classic-green">Classic Green</option>
                            <option value="cyan-blue">Cyan Blue</option>
                          </select>
                        </FormField>

                        <div className={styles.toggleGroup}>
                          <ToggleField
                            label="Enable Syntax Highlighting"
                            checked={uiSettings.terminal.syntaxHighlighting}
                            onChange={(checked) => updateUISettings('terminal', 'syntaxHighlighting', checked)}
                          />
                          <ToggleField
                            label="Show Line Numbers"
                            checked={uiSettings.terminal.lineNumbers}
                            onChange={(checked) => updateUISettings('terminal', 'lineNumbers', checked)}
                          />
                        </div>

                        <FormField label="History Limit (lines)" helpText="Number of command history entries to keep">
                          <Input
                            type="number"
                            value={uiSettings.terminal.historyLimit}
                            onChange={(e) => updateUISettings('terminal', 'historyLimit', parseInt(e.target.value))}
                          />
                        </FormField>
                      </SettingsSection>
                    </div>

                    {/* Display Settings */}
                    <div id="display">
                      <SettingsSection
                        title="Display Settings"
                        description="Customize date, time, and timezone preferences"
                      >
                        <FormField label="Timezone">
                          <select
                            className={styles.select}
                            value={uiSettings.display.timezone}
                            onChange={(e) => updateUISettings('display', 'timezone', e.target.value)}
                          >
                            <optgroup label="Common Timezones">
                              <option value="America/New_York">Eastern Time (ET)</option>
                              <option value="America/Chicago">Central Time (CT)</option>
                              <option value="America/Denver">Mountain Time (MT)</option>
                              <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            </optgroup>
                            <optgroup label="Europe">
                              <option value="Europe/London">London (GMT/BST)</option>
                              <option value="Europe/Paris">Paris (CET/CEST)</option>
                            </optgroup>
                            <optgroup label="Asia">
                              <option value="Asia/Tokyo">Tokyo (JST)</option>
                              <option value="Asia/Shanghai">China (CST)</option>
                            </optgroup>
                            <option value="UTC">UTC</option>
                          </select>
                        </FormField>

                        <FormField label="Time Format">
                          <select
                            className={styles.select}
                            value={uiSettings.display.timeFormat}
                            onChange={(e) => updateUISettings('display', 'timeFormat', e.target.value as '12h' | '24h')}
                          >
                            <option value="12h">12-hour (AM/PM)</option>
                            <option value="24h">24-hour</option>
                          </select>
                        </FormField>

                        <FormField label="Date Format">
                          <select
                            className={styles.select}
                            value={uiSettings.display.dateFormat}
                            onChange={(e) => updateUISettings('display', 'dateFormat', e.target.value)}
                          >
                            <option value="MMM DD, YYYY">Jan 01, 2024</option>
                            <option value="DD/MM/YYYY">01/01/2024</option>
                            <option value="YYYY-MM-DD">2024-01-01</option>
                          </select>
                        </FormField>
                      </SettingsSection>
                    </div>

                    {/* AI Assistant Behavior */}
                    <SettingsSection
                      title="AI Assistant Behavior"
                      description="Configure AI assistant interaction preferences"
                    >
                      <ToggleField
                        label="Enable Command Suggestions"
                        description="Show AI-powered command suggestions"
                        checked={uiSettings.behavior.enableSuggestions}
                        onChange={(checked) => updateUISettings('behavior', 'enableSuggestions', checked)}
                      />
                      <ToggleField
                        label="Show Command Explanations"
                        description="Display explanations for suggested commands"
                        checked={uiSettings.behavior.showExplanations}
                        onChange={(checked) => updateUISettings('behavior', 'showExplanations', checked)}
                      />
                      <ToggleField
                        label="Auto-execute Safe Commands"
                        description="⚠️ Automatically run read-only commands"
                        checked={uiSettings.behavior.autoExecuteSafe}
                        onChange={(checked) => updateUISettings('behavior', 'autoExecuteSafe', checked)}
                      />
                      <ToggleField
                        label="Require Confirmation"
                        description="Ask before executing critical commands"
                        checked={uiSettings.behavior.requireConfirmation}
                        onChange={(checked) => updateUISettings('behavior', 'requireConfirmation', checked)}
                      />
                    </SettingsSection>

                    {/* Security */}
                    <div id="security">
                      <SettingsSection
                        title="Security & Privacy"
                        description="Manage security and privacy preferences"
                      >
                        <ToggleField
                          label="Store Credentials Locally"
                          checked={uiSettings.security.storeCredentials}
                          onChange={(checked) => updateUISettings('security', 'storeCredentials', checked)}
                        />
                        <ToggleField
                          label="Encrypt Stored Credentials"
                          checked={uiSettings.security.encryptCredentials}
                          onChange={(checked) => updateUISettings('security', 'encryptCredentials', checked)}
                        />
                        <ToggleField
                          label="Enable Audit Logging"
                          checked={uiSettings.security.enableAuditLogging}
                          onChange={(checked) => updateUISettings('security', 'enableAuditLogging', checked)}
                        />
                        <ToggleField
                          label="Log AI Conversations"
                          checked={uiSettings.security.logAiConversations}
                          onChange={(checked) => updateUISettings('security', 'logAiConversations', checked)}
                        />
                        <ToggleField
                          label="Log Router Commands"
                          checked={uiSettings.security.logRouterCommands}
                          onChange={(checked) => updateUISettings('security', 'logRouterCommands', checked)}
                        />

                        <FormField label="Session Timeout (minutes)" helpText="Auto-logout after inactivity">
                          <Input
                            type="number"
                            value={uiSettings.security.sessionTimeout}
                            onChange={(e) => updateUISettings('security', 'sessionTimeout', parseInt(e.target.value))}
                          />
                        </FormField>
                      </SettingsSection>
                    </div>

                    {/* AI Assistant Configuration */}
                    <div id="ai-assistant-ui">
                      <SettingsSection
                        title="AI Assistant"
                        description="Configure AI assistant interface options"
                      >
                        <div className={styles.subsectionTitle}>Side Panel Sections</div>
                        <div className={styles.toggleGroup}>
                          <ToggleField
                            label="AI Model Info"
                            description="Display AI model details, provider, and token costs"
                            checked={uiSettings.aiAssistant.sidePanelSections.modelInfo}
                            onChange={(checked) => updateUISettings('aiAssistant', 'sidePanelSections', {
                              ...uiSettings.aiAssistant.sidePanelSections,
                              modelInfo: checked
                            })}
                          />
                          <ToggleField
                            label="Session Info"
                            description="Show session duration, tool calls, and command count"
                            checked={uiSettings.aiAssistant.sidePanelSections.sessionInfo}
                            onChange={(checked) => updateUISettings('aiAssistant', 'sidePanelSections', {
                              ...uiSettings.aiAssistant.sidePanelSections,
                              sessionInfo: checked
                            })}
                          />
                          <ToggleField
                            label="Most Used Tools"
                            description="Display frequently used AI tools in the session"
                            checked={uiSettings.aiAssistant.sidePanelSections.mostUsedTools}
                            onChange={(checked) => updateUISettings('aiAssistant', 'sidePanelSections', {
                              ...uiSettings.aiAssistant.sidePanelSections,
                              mostUsedTools: checked
                            })}
                          />
                          <ToggleField
                            label="Available Tools"
                            description="Show all available AI tools and their categories"
                            checked={uiSettings.aiAssistant.sidePanelSections.availableTools}
                            onChange={(checked) => updateUISettings('aiAssistant', 'sidePanelSections', {
                              ...uiSettings.aiAssistant.sidePanelSections,
                              availableTools: checked
                            })}
                          />
                        </div>
                      </SettingsSection>
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className={styles.footer}>
        {activeTab === 'server' ? (
          <>
            <Button
              onClick={() => loadSettings()}
              disabled={!hasServerChanges || saving}
            >
              Discard Changes
            </Button>
            <Button
              variant="primary"
              onClick={handleServerSave}
              disabled={!hasServerChanges || saving}
            >
              {saving ? 'Saving...' : 'Save Server Settings'}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => loadSettings()}
              disabled={!hasUIChanges}
            >
              Discard Changes
            </Button>
            <Button
              variant="primary"
              onClick={handleUISave}
              disabled={!hasUIChanges}
            >
              Save UI Settings
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

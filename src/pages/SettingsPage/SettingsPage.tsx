import React, { useState } from 'react';
import { Settings, defaultSettings } from '../../types/settings';
import { SettingsSection } from '../../components/organisms/SettingsSection/SettingsSection';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ToggleField } from '../../components/molecules/ToggleField/ToggleField';
import { WarningBox, WarningBoxText, WarningBoxHighlight, WarningBoxLink } from '../../components/molecules/WarningBox/WarningBox';
import { Input } from '../../components/atoms/Input/Input';
import { Textarea } from '../../components/atoms/Textarea/Textarea';
import { Button } from '../../components/atoms/Button/Button';
import { Slider } from '../../components/atoms/Slider/Slider';
import styles from './SettingsPage.module.css';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = <K extends keyof Settings>(
    section: K,
    updates: Partial<Settings[K]>
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Save to localStorage or API
    localStorage.setItem('mikrotik-settings', JSON.stringify(settings));
    setHasChanges(false);
    alert('Settings saved successfully!');
  };

  const handleReset = () => {
    if (window.confirm('Reset all settings to defaults?')) {
      setSettings(defaultSettings);
      setHasChanges(true);
    }
  };

  const handleCancel = () => {
    // Reload from storage or reset changes
    setSettings(defaultSettings);
    setHasChanges(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.content}>
        {/* RouterOS API Configuration */}
        <SettingsSection
          title="RouterOS API Configuration"
          description="Configure connection to MikroTik RouterOS via API"
        >
          <FormField
            label="Router IP Address/Hostname"
            helpText="IP address or hostname of your MikroTik router"
          >
            <Input
              value={settings.routerApi.ipAddress}
              onChange={(e) => updateSettings('routerApi', { ipAddress: e.target.value })}
              placeholder="192.168.88.1"
            />
          </FormField>

          <FormField
            label="API Port"
            helpText="8728 for API, 8729 for API-SSL, 8730 for REST API"
          >
            <Input
              type="number"
              value={settings.routerApi.port}
              onChange={(e) => updateSettings('routerApi', { port: parseInt(e.target.value) })}
            />
          </FormField>

          <FormField label="Username" helpText="Your RouterOS login username">
            <Input
              value={settings.routerApi.username}
              onChange={(e) => updateSettings('routerApi', { username: e.target.value })}
              placeholder="admin"
            />
          </FormField>

          <FormField label="Password" helpText="Your RouterOS login password">
            <Input
              type="password"
              value={settings.routerApi.password}
              onChange={(e) => updateSettings('routerApi', { password: e.target.value })}
              placeholder="••••••••"
            />
          </FormField>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              Connection Options
            </h3>
            <ToggleField
              label="Use SSL/TLS Connection"
              checked={settings.routerApi.useSsl}
              onChange={(checked) => updateSettings('routerApi', { useSsl: checked })}
            />
            <ToggleField
              label="Keep Connection Alive"
              description="Maintains persistent connection to router"
              checked={settings.routerApi.keepAlive}
              onChange={(checked) => updateSettings('routerApi', { keepAlive: checked })}
            />
            <ToggleField
              label="Auto-reconnect on Disconnect"
              checked={settings.routerApi.autoReconnect}
              onChange={(checked) => updateSettings('routerApi', { autoReconnect: checked })}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
              Timeout Settings
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <FormField label="Connection Timeout">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Input
                    type="number"
                    value={settings.routerApi.connectionTimeout}
                    onChange={(e) => updateSettings('routerApi', { connectionTimeout: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>seconds</span>
                </div>
              </FormField>
              <FormField label="Command Timeout">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Input
                    type="number"
                    value={settings.routerApi.commandTimeout}
                    onChange={(e) => updateSettings('routerApi', { commandTimeout: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>seconds</span>
                </div>
              </FormField>
              <FormField label="Max Retry Attempts">
                <Input
                  type="number"
                  value={settings.routerApi.maxRetries}
                  onChange={(e) => updateSettings('routerApi', { maxRetries: parseInt(e.target.value) })}
                />
              </FormField>
              <FormField label="Keep-Alive Interval">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Input
                    type="number"
                    value={settings.routerApi.keepAliveInterval}
                    onChange={(e) => updateSettings('routerApi', { keepAliveInterval: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--color-text-secondary)' }}>seconds</span>
                </div>
              </FormField>
            </div>
          </div>

          <WarningBox icon="⚠️">
            <WarningBoxText>
              <WarningBoxHighlight>Recommendation:</WarningBoxHighlight> Create a dedicated RouterOS user with limited API access rights instead of using admin credentials.
            </WarningBoxText>
            <WarningBoxLink href="https://help.mikrotik.com/docs/display/ROS/User">
              Learn how to create API user
            </WarningBoxLink>
          </WarningBox>

          <Button variant="primary" style={{ width: '100%' }}>
            Test API Connection
          </Button>
        </SettingsSection>

        {/* AI Assistant Behavior */}
        <SettingsSection
          title="AI Assistant Behavior"
          description="Configure how the AI assistant responds"
        >
          <FormField label="System Prompt">
            <Textarea
              value={settings.aiAssistant.systemPrompt}
              onChange={(e) => updateSettings('aiAssistant', { systemPrompt: e.target.value })}
              rows={4}
            />
          </FormField>

          <FormField label={`Temperature: ${settings.aiAssistant.temperature}`}>
            <Slider
              value={settings.aiAssistant.temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) => updateSettings('aiAssistant', { temperature: value })}
              formatValue={(v) => v.toFixed(1)}
              aria-label="Temperature"
            />
          </FormField>

          <FormField label="Max Tokens per Response">
            <Input
              type="number"
              value={settings.aiAssistant.maxTokens}
              onChange={(e) => updateSettings('aiAssistant', { maxTokens: parseInt(e.target.value) })}
            />
          </FormField>

          <FormField label="Response Timeout (seconds)">
            <Input
              type="number"
              value={settings.aiAssistant.responseTimeout}
              onChange={(e) => updateSettings('aiAssistant', { responseTimeout: parseInt(e.target.value) })}
            />
          </FormField>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-primary)', paddingTop: '16px' }}>
            <ToggleField
              label="Enable Command Suggestions"
              checked={settings.aiAssistant.enableSuggestions}
              onChange={(checked) => updateSettings('aiAssistant', { enableSuggestions: checked })}
            />
            <ToggleField
              label="Show Command Explanations"
              checked={settings.aiAssistant.showExplanations}
              onChange={(checked) => updateSettings('aiAssistant', { showExplanations: checked })}
            />
            <ToggleField
              label="Auto-execute Safe Commands"
              checked={settings.aiAssistant.autoExecuteSafe}
              onChange={(checked) => updateSettings('aiAssistant', { autoExecuteSafe: checked })}
              icon="ℹ️"
            />
            <ToggleField
              label="Require Confirmation for Critical Commands"
              checked={settings.aiAssistant.requireConfirmation}
              onChange={(checked) => updateSettings('aiAssistant', { requireConfirmation: checked })}
            />
          </div>
        </SettingsSection>

        {/* Terminal Configuration */}
        <SettingsSection
          title="Terminal Configuration"
          description="Customize terminal appearance and behavior"
        >
          <FormField label={`Font Size: ${settings.terminal.fontSize}px`}>
            <Slider
              value={settings.terminal.fontSize}
              min={8}
              max={24}
              step={1}
              onChange={(value) => updateSettings('terminal', { fontSize: value })}
              formatValue={(v) => `${v}px`}
              aria-label="Font size"
            />
          </FormField>

          <FormField label={`Line Height: ${settings.terminal.lineHeight}`}>
            <Slider
              value={settings.terminal.lineHeight}
              min={1.0}
              max={2.0}
              step={0.1}
              onChange={(value) => updateSettings('terminal', { lineHeight: value })}
              formatValue={(v) => v.toFixed(1)}
              aria-label="Line height"
            />
          </FormField>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-primary)', paddingTop: '16px' }}>
            <ToggleField
              label="Enable Syntax Highlighting"
              checked={settings.terminal.syntaxHighlighting}
              onChange={(checked) => updateSettings('terminal', { syntaxHighlighting: checked })}
            />
            <ToggleField
              label="Show Line Numbers"
              checked={settings.terminal.lineNumbers}
              onChange={(checked) => updateSettings('terminal', { lineNumbers: checked })}
            />
          </div>

          <FormField label="Terminal History Limit (lines)">
            <Input
              type="number"
              value={settings.terminal.historyLimit}
              onChange={(e) => updateSettings('terminal', { historyLimit: parseInt(e.target.value) })}
            />
          </FormField>
        </SettingsSection>

        {/* Security Settings */}
        <SettingsSection
          title="Security Settings"
          description="Manage security and privacy preferences"
        >
          <ToggleField
            label="Store Credentials Locally"
            checked={settings.security.storeCredentials}
            onChange={(checked) => updateSettings('security', { storeCredentials: checked })}
            icon="ℹ️"
          />
          <ToggleField
            label="Encrypt Stored Credentials"
            checked={settings.security.encryptCredentials}
            onChange={(checked) => updateSettings('security', { encryptCredentials: checked })}
          />

          <FormField label="Session Timeout (minutes)">
            <Input
              type="number"
              value={settings.security.sessionTimeout}
              onChange={(e) => updateSettings('security', { sessionTimeout: parseInt(e.target.value) })}
            />
          </FormField>

          <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-primary)', paddingTop: '16px' }}>
            <ToggleField
              label="Enable Audit Logging"
              checked={settings.security.enableAuditLogging}
              onChange={(checked) => updateSettings('security', { enableAuditLogging: checked })}
            />
            <ToggleField
              label="Log AI Conversations"
              checked={settings.security.logAiConversations}
              onChange={(checked) => updateSettings('security', { logAiConversations: checked })}
            />
            <ToggleField
              label="Log Router Commands"
              checked={settings.security.logRouterCommands}
              onChange={(checked) => updateSettings('security', { logRouterCommands: checked })}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-border-primary)', paddingTop: '16px' }}>
            <Button>Export Logs</Button>
            <Button>Clear All Stored Data</Button>
          </div>
        </SettingsSection>
      </div>

      <div className={styles.footer}>
        <Button onClick={handleCancel} disabled={!hasChanges}>
          Cancel
        </Button>
        <Button onClick={handleReset}>Reset to Defaults</Button>
        <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};

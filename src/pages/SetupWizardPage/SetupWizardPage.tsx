import React, { useState } from 'react';
import { Input } from '../../components/atoms/Input/Input';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { Alert } from 'antd';
import bardLogo from '../../assets/bard-logo3.png';
import styles from './SetupWizardPage.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface MikroTikConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  timeout: string;
}

interface LLMConfig {
  provider: 'claude' | 'lmstudio' | 'skip';
  claude: {
    apiKey: string;
    model: string;
  };
  lmstudio: {
    endpoint: string;
    model: string;
    contextWindow: number;
  };
}

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

export const SetupWizardPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // MikroTik configuration state
  const [mikrotik, setMikrotik] = useState<MikroTikConfig>({
    host: '192.168.88.1',
    port: '8728',
    username: 'admin',
    password: '',
    timeout: '10000',
  });
  const [mikrotikTest, setMikrotikTest] = useState<TestResult | null>(null);

  // LLM configuration state
  const [llm, setLLM] = useState<LLMConfig>({
    provider: 'lmstudio',
    claude: {
      apiKey: '',
      model: 'claude-3-5-sonnet-20241022',
    },
    lmstudio: {
      endpoint: 'http://localhost:1234/v1',
      model: '',
      contextWindow: 32768,
    },
  });
  const [llmTest, setLLMTest] = useState<TestResult | null>(null);

  // Test MikroTik connection
  const testMikroTikConnection = async () => {
    setLoading(true);
    setError(null);
    setMikrotikTest(null);

    try {
      const response = await fetch(`${API_URL}/api/setup/test-mikrotik`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mikrotik),
      });

      const result = await response.json();
      setMikrotikTest(result);

      if (result.success) {
        setSuccess(`Connected to ${result.routerInfo.name} (${result.routerInfo.model})`);
      } else {
        setError(result.error || 'Connection test failed');
      }
    } catch (err: any) {
      setError('Failed to test connection: ' + err.message);
      setMikrotikTest({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Test LLM provider connection
  const testLLMConnection = async () => {
    if (llm.provider === 'skip') {
      setLLMTest({ success: true });
      setSuccess('LLM provider skipped - AI features will be disabled');
      return;
    }

    setLoading(true);
    setError(null);
    setLLMTest(null);

    try {
      const response = await fetch(`${API_URL}/api/setup/test-llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(llm),
      });

      const result = await response.json();
      setLLMTest(result);

      if (result.success) {
        const providerName = llm.provider === 'claude' ? 'Claude API' : 'LMStudio';
        const modelName = result.providerInfo?.model || (llm.provider === 'claude' ? llm.claude.model : llm.lmstudio.model);
        setSuccess(`Connected to ${providerName} (${modelName})`);
      } else {
        setError(result.error || 'LLM test failed');
      }
    } catch (err: any) {
      setError('Failed to test LLM: ' + err.message);
      setLLMTest({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Save configuration and complete setup
  const saveConfiguration = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        mikrotik: {
          host: mikrotik.host,
          port: parseInt(mikrotik.port),
          username: mikrotik.username,
          password: mikrotik.password,
          timeout: parseInt(mikrotik.timeout),
        },
      };

      // Only include LLM config if not skipping
      if (llm.provider !== 'skip') {
        payload.llm = {
          provider: llm.provider,
          [llm.provider]: llm[llm.provider],
        };
      }

      const response = await fetch(`${API_URL}/api/setup/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Setup completed successfully! Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setError(result.errors?.join(', ') || 'Setup failed');
      }
    } catch (err: any) {
      setError('Failed to save configuration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    setError(null);
    setSuccess(null);

    // Validate current step before proceeding
    if (currentStep === 2 && !mikrotikTest?.success) {
      setError('Please test MikroTik connection before continuing');
      return;
    }

    if (currentStep === 3 && llm.provider !== 'skip' && !llmTest?.success) {
      setError('Please test LLM connection or skip this step');
      return;
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError(null);
    setSuccess(null);
    setCurrentStep(currentStep - 1);
  };

  // Step 1: Welcome
  const renderWelcome = () => (
    <div className={styles.stepContent}>
      <div className={styles.logoContainer}>
        <img src={bardLogo} alt="MikroTik Dashboard Logo" className={styles.logo} />
      </div>

      <h2 className={styles.stepTitle}>Welcome to apehost.net Mikrotik bard</h2>
      <p className={styles.stepDescription}>
        Let's get your dashboard set up and connected to your MikroTik router.
      </p>

      <div className={styles.requirements}>
        <h3>Before you begin, make sure you have:</h3>
        <ul>
          <li>MikroTik router with API access enabled (port 8728)</li>
          <li>Admin username and password for your router</li>
          <li>Network connectivity to your router</li>
          <li>(Optional) Claude API key or LMStudio for AI features</li>
        </ul>
      </div>

      <div className={styles.infoBox}>
        <svg className={styles.infoIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p>
          This wizard will guide you through configuring your router connection and
          optional AI assistant features. You can always change these settings later
          in the Settings page.
        </p>
      </div>
    </div>
  );

  // Step 2: MikroTik Connection
  const renderMikroTik = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>MikroTik Router Connection</h2>
      <p className={styles.stepDescription}>
        Enter your router connection details below.
      </p>

      <div className={styles.form}>
        <FormField label="Router IP Address" helpText="IP address or hostname of your MikroTik router">
          <Input
            value={mikrotik.host}
            onChange={(e) => setMikrotik({ ...mikrotik, host: e.target.value })}
            placeholder="192.168.88.1"
          />
        </FormField>

        <FormField label="API Port" helpText="RouterOS API port (default: 8728)">
          <Input
            type="number"
            value={mikrotik.port}
            onChange={(e) => setMikrotik({ ...mikrotik, port: e.target.value })}
            placeholder="8728"
          />
        </FormField>

        <FormField label="Username" helpText="Admin username for your router">
          <Input
            value={mikrotik.username}
            onChange={(e) => setMikrotik({ ...mikrotik, username: e.target.value })}
            placeholder="admin"
          />
        </FormField>

        <FormField label="Password" helpText="Admin password for your router">
          <Input
            type="password"
            value={mikrotik.password}
            onChange={(e) => setMikrotik({ ...mikrotik, password: e.target.value })}
            placeholder="Enter password"
          />
        </FormField>
      </div>
    </div>
  );

  // Step 3: LLM Provider
  const renderLLM = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>AI Assistant Configuration (Optional)</h2>
      <p className={styles.stepDescription}>
        Configure an AI provider for advanced troubleshooting and network analysis.
      </p>

      <div className={styles.form}>
        <FormField label="AI Provider" helpText="Select your preferred AI provider">
          <select
            className={styles.select}
            value={llm.provider}
            onChange={(e) => {
              setLLM({ ...llm, provider: e.target.value as any });
              setLLMTest(null);
            }}
          >
            <option value="lmstudio">LMStudio (Local)</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="skip">Skip - Configure Later</option>
          </select>
        </FormField>

        {llm.provider === 'claude' && (
          <>
            <FormField label="API Key" helpText="Your Anthropic API key">
              <Input
                type="password"
                value={llm.claude.apiKey}
                onChange={(e) => setLLM({ ...llm, claude: { ...llm.claude, apiKey: e.target.value } })}
                placeholder="sk-ant-..."
              />
            </FormField>

            <FormField label="Model" helpText="Claude model to use">
              <Input
                value={llm.claude.model}
                onChange={(e) => setLLM({ ...llm, claude: { ...llm.claude, model: e.target.value } })}
                placeholder="claude-3-5-sonnet-20241022"
              />
            </FormField>
          </>
        )}

        {llm.provider === 'lmstudio' && (
          <>
            <FormField label="Endpoint URL" helpText="LMStudio API endpoint">
              <Input
                value={llm.lmstudio.endpoint}
                onChange={(e) => setLLM({ ...llm, lmstudio: { ...llm.lmstudio, endpoint: e.target.value } })}
                placeholder="http://localhost:1234/v1"
              />
            </FormField>

            <FormField label="Model Name" helpText="Model loaded in LMStudio">
              <Input
                value={llm.lmstudio.model}
                onChange={(e) => setLLM({ ...llm, lmstudio: { ...llm.lmstudio, model: e.target.value } })}
                placeholder="model-name"
              />
            </FormField>
          </>
        )}

        {llm.provider === 'skip' && (
          <div className={styles.infoBox}>
            AI features will be disabled. You can configure this later in Settings.
          </div>
        )}
      </div>
    </div>
  );

  // Step 4: Review and Save
  const renderReview = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Review Configuration</h2>
      <p className={styles.stepDescription}>
        Please review your settings before completing setup.
      </p>

      <div className={styles.review}>
        <div className={styles.reviewSection}>
          <h3>MikroTik Router</h3>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Host:</span>
            <span className={styles.reviewValue}>{mikrotik.host}:{mikrotik.port}</span>
          </div>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Username:</span>
            <span className={styles.reviewValue}>{mikrotik.username}</span>
          </div>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Status:</span>
            <span className={`${styles.reviewValue} ${mikrotikTest?.success ? styles.statusSuccess : styles.statusError}`}>
              {mikrotikTest?.success ? 'Connected' : 'Not Tested'}
            </span>
          </div>
          {mikrotikTest?.routerInfo && (
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Router:</span>
              <span className={styles.reviewValue}>
                {mikrotikTest.routerInfo.name} ({mikrotikTest.routerInfo.model})
              </span>
            </div>
          )}
        </div>

        <div className={styles.reviewSection}>
          <h3>AI Provider</h3>
          <div className={styles.reviewItem}>
            <span className={styles.reviewLabel}>Provider:</span>
            <span className={styles.reviewValue}>
              {llm.provider === 'skip' ? 'Not Configured' : llm.provider === 'claude' ? 'Claude' : 'LMStudio'}
            </span>
          </div>
          {llm.provider !== 'skip' && (
            <div className={styles.reviewItem}>
              <span className={styles.reviewLabel}>Status:</span>
              <span className={`${styles.reviewValue} ${llmTest?.success ? styles.statusSuccess : styles.statusWarning}`}>
                {llmTest?.success ? 'Connected' : 'Not Tested'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderWelcome();
      case 2:
        return renderMikroTik();
      case 3:
        return renderLLM();
      case 4:
        return renderReview();
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wizard}>
        {/* Progress indicator */}
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
          <div className={styles.progressText}>
            Step {currentStep} of 4
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert
            type="error"
            message={error}
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 'var(--space-lg)' }}
          />
        )}
        {success && (
          <Alert
            type="success"
            message={success}
            showIcon
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginTop: '2px' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
              </svg>
            }
            closable
            onClose={() => setSuccess(null)}
            style={{ marginBottom: 'var(--space-lg)' }}
          />
        )}

        {/* Step content */}
        {renderStep()}

        {/* Navigation buttons */}
        <div className={styles.navigation}>
          {currentStep > 1 && (
            <Button variant="secondary" onClick={handleBack} disabled={loading}>
              ← Back
            </Button>
          )}

          <div className={styles.navigationRight}>
            {/* Test Connection button for MikroTik step */}
            {currentStep === 2 && (
              <Button
                variant="secondary"
                onClick={testMikroTikConnection}
                disabled={loading || !mikrotik.password}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                </svg>
                {loading ? 'Testing...' : 'Test Connection'}
              </Button>
            )}

            {/* Test Connection button for LLM step */}
            {currentStep === 3 && llm.provider !== 'skip' && (
              <Button
                variant="secondary"
                onClick={testLLMConnection}
                disabled={loading || (llm.provider === 'claude' && !llm.claude.apiKey)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                </svg>
                {loading ? 'Testing...' : 'Test Connection'}
              </Button>
            )}

            {/* Next/Complete button */}
            {currentStep < 4 ? (
              <Button variant="primary" onClick={handleNext} disabled={loading}>
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '8px' }}>
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor"/>
                </svg>
              </Button>
            ) : (
              <Button variant="primary" onClick={saveConfiguration} disabled={loading}>
                {loading ? 'Saving...' : 'Complete Setup'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '8px' }}>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
                </svg>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

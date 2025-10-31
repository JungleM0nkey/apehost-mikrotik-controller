/**
 * Setup API Routes
 * Handles initial setup wizard endpoints
 */

import { Router, Request, Response } from 'express';
import { setupService } from '../services/setup.service.js';

const router = Router();

/**
 * GET /api/setup/status
 * Check if initial setup is needed
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await setupService.checkSetupStatus();
    res.json(status);
  } catch (error: any) {
    console.error('[Setup] Error checking setup status:', error);
    res.status(500).json({
      error: 'Failed to check setup status',
      message: error.message,
    });
  }
});

/**
 * POST /api/setup/test-mikrotik
 * Test MikroTik connection with provided credentials
 */
router.post('/test-mikrotik', async (req: Request, res: Response) => {
  try {
    const { host, port, username, password, timeout } = req.body;

    if (!host || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'host, username, and password are required',
      });
    }

    const result = await setupService.testMikroTikConnection({
      host,
      port: parseInt(port) || 8728,
      username,
      password,
      timeout: parseInt(timeout) || 10000,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Setup] Error testing MikroTik connection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during connection test',
    });
  }
});

/**
 * POST /api/setup/test-llm
 * Test LLM provider connection
 */
router.post('/test-llm', async (req: Request, res: Response) => {
  try {
    const { provider, claude, lmstudio } = req.body;

    if (!provider) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'provider is required',
      });
    }

    if (provider !== 'claude' && provider !== 'lmstudio') {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'provider must be "claude" or "lmstudio"',
      });
    }

    const result = await setupService.testLLMProvider({
      provider,
      claude,
      lmstudio,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[Setup] Error testing LLM provider:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during LLM test',
    });
  }
});

/**
 * POST /api/setup/initialize
 * Save configuration and complete setup
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { mikrotik, llm } = req.body;

    if (!mikrotik) {
      return res.status(400).json({
        success: false,
        errors: ['MikroTik configuration is required'],
      });
    }

    const result = await setupService.initializeSetup({
      mikrotik,
      llm,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Setup completed successfully',
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    console.error('[Setup] Error initializing setup:', error);
    res.status(500).json({
      success: false,
      errors: [`Internal server error: ${error.message}`],
    });
  }
});

/**
 * POST /api/setup/reset
 * Reset to default configuration to re-run setup wizard
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    // This endpoint is used when user clicks "Re-run Setup" in Settings
    // It doesn't actually reset config, just returns success
    // Frontend will redirect to setup wizard which will show current config
    res.json({
      success: true,
      message: 'Ready to re-run setup wizard',
    });
  } catch (error: any) {
    console.error('[Setup] Error resetting setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset setup',
    });
  }
});

export const setupRoutes = router;

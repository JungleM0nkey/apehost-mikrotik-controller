import { Router, Request, Response } from 'express';
import settingsService from '../services/settings.js';
import { refreshGlobalProvider } from '../services/ai/provider-factory.js';
import { configManager } from '../services/config-manager.js';
import mikrotikService from '../services/mikrotik.js';

const router = Router();

/**
 * GET /api/settings
 * Get current server settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await settingsService.getSettings();

    // Mask sensitive data in response
    const sanitizedSettings = {
      ...settings,
      mikrotik: {
        ...settings.mikrotik,
        password: settings.mikrotik.password ? '********' : ''
      },
      llm: {
        ...settings.llm,
        claude: {
          ...settings.llm.claude,
          apiKey: settings.llm.claude.apiKey ? '********' : ''
        }
      }
    };

    res.json(sanitizedSettings);
  } catch (error) {
    console.error('[Settings API] Failed to get settings:', error);
    res.status(500).json({
      error: 'Failed to retrieve settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/settings
 * Update server settings
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const settings = req.body;

    // Update settings (validation happens in UnifiedConfigService via Zod schemas)
    await settingsService.updateSettings(settings);

    // Track which services need refreshing
    const refreshedServices: string[] = [];

    // Refresh AI provider if LLM settings were changed
    if (settings.llm) {
      try {
        const newProvider = await refreshGlobalProvider();
        if (newProvider) {
          console.log('[Settings API] AI provider refreshed successfully');
          refreshedServices.push('AI Provider');
        }
      } catch (error) {
        console.warn('[Settings API] Failed to refresh AI provider:', error);
      }
    }

    // Refresh MikroTik connection if MikroTik settings were changed
    if (settings.mikrotik) {
      try {
        const reconnected = await mikrotikService.refreshConnection();
        if (reconnected) {
          console.log('[Settings API] MikroTik connection refreshed successfully');
          refreshedServices.push('MikroTik Connection');
        }
      } catch (error) {
        console.warn('[Settings API] Failed to refresh MikroTik connection:', error);
      }
    }

    // Return updated settings (sanitized)
    const updatedSettings = await settingsService.getSettings();
    const sanitizedSettings = {
      ...updatedSettings,
      mikrotik: {
        ...updatedSettings.mikrotik,
        password: updatedSettings.mikrotik.password ? '********' : ''
      },
      llm: {
        ...updatedSettings.llm,
        claude: {
          ...updatedSettings.llm.claude,
          apiKey: updatedSettings.llm.claude.apiKey ? '********' : ''
        }
      }
    };

    // Build response message
    let message = 'Settings updated successfully!';
    if (refreshedServices.length > 0) {
      message += ` ${refreshedServices.join(' and ')} reloaded - changes applied immediately.`;
    } else {
      message += ' Please restart the server for changes to take effect.';
    }

    res.json({
      message,
      settings: sanitizedSettings,
      refreshedServices,
      requiresRestart: refreshedServices.length === 0
    });
  } catch (error) {
    console.error('[Settings API] Failed to update settings:', error);

    // Check if it's a validation error (from Zod)
    if (error instanceof Error && error.message.includes('validation')) {
      return res.status(400).json({
        error: 'Invalid settings',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to update settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/settings/validate
 * Validate settings without saving
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    const validation = settingsService.validateSettings(settings);

    res.json(validation);
  } catch (error) {
    console.error('[Settings API] Failed to validate settings:', error);
    res.status(500).json({
      error: 'Failed to validate settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export const settingsRoutes = router;

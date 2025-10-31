# Model Settings Cache Fix

## Problem

When changing LLM model settings in the web UI (e.g., from `openai/gpt-oss-20b` to `ibm/granite-4-h-tiny`), the changes were not being applied. The system continued using the old model even after saving settings.

## Root Cause

The issue was **incomplete cache clearing** in the refresh chain. The application has three layers of configuration caching:

1. **UnifiedConfigService** - Reads from `config.json` on disk
2. **ConfigManager** - Wraps UnifiedConfigService with additional logic
3. **ProviderFactory** - Maintains a `globalProvider` singleton instance

When settings were updated via the web UI:
- `settingsRoutes.put('/')` saved to UnifiedConfigService
- `refreshGlobalProvider()` was called
- BUT: UnifiedConfigService cache wasn't being cleared before reload
- Result: ConfigManager loaded stale cached data instead of fresh disk data

## The Fix

Modified `refreshGlobalProvider()` in [server/src/services/ai/provider-factory.ts](server/src/services/ai/provider-factory.ts:160-173) to clear **all caches in the correct order**:

```typescript
export async function refreshGlobalProvider(): Promise<LLMProvider | null> {
  console.log('[ProviderFactory] Refreshing global provider with updated settings');

  // Clear all caches in the chain (order matters!)
  globalProvider = null; // Clear cached provider instance
  providerInitPromise = null; // Clear any pending init promise
  configManager.clearCache(); // Clear ConfigManager cache
  unifiedConfigService.clearCache(); // Clear UnifiedConfigService cache

  // Reload config from disk and recreate provider
  await unifiedConfigService.reload(); // Reload from disk first
  await configManager.refreshConfig(); // Then refresh ConfigManager
  return await getGlobalProvider(); // Finally recreate provider with fresh config
}
```

## Cache Clearing Order

The order is critical:

1. Clear `globalProvider` - Removes cached LLM provider instance
2. Clear `providerInitPromise` - Prevents reuse of pending initialization
3. Clear `configManager.config` - Forces reload from UnifiedConfigService
4. Clear `unifiedConfigService.config` - Forces reload from disk
5. Reload `unifiedConfigService` - Read fresh data from `config.json`
6. Reload `configManager` - Build config from fresh UnifiedConfigService data
7. Recreate provider - Instantiate new LLM provider with updated settings

## Testing

After applying this fix:

1. Start the server
2. Navigate to Settings in the web UI
3. Change the LLM model (e.g., from `openai/gpt-oss-20b` to `ibm/granite-4-h-tiny`)
4. Click "Save Settings"
5. Send a message to the AI assistant
6. Verify that the new model is being used (check console logs for provider creation)

## Console Logs to Verify

When settings are updated, you should see:

```
[ProviderFactory] Refreshing global provider with updated settings
[UnifiedConfig] Configuration file changed, reloading...
[UnifiedConfig] Configuration loaded successfully
[ConfigManager] Refreshing configuration...
[ConfigManager] Configuration loaded successfully
[ConfigManager] LLM Provider: lmstudio
[ProviderFactory] Config values - endpoint: http://localhost:1234, model: ibm/granite-4-h-tiny, contextWindow: 8192
[ProviderFactory] Successfully created LM Studio provider
```

## Related Files

- [server/src/services/ai/provider-factory.ts](server/src/services/ai/provider-factory.ts) - Provider creation and caching
- [server/src/services/config-manager.ts](server/src/services/config-manager.ts) - Configuration management wrapper
- [server/src/services/config/unified-config.service.ts](server/src/services/config/unified-config.service.ts) - Core configuration service
- [server/src/routes/settings.ts](server/src/routes/settings.ts) - Settings API endpoints

## Impact

- Settings changes now apply immediately without server restart
- All three configuration layers properly clear their caches
- Provider recreation uses fresh configuration from disk
- No more stale model settings being used after updates

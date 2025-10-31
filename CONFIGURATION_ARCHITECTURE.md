# Configuration Architecture - Single Source of Truth

## Overview

The MikroTik Dashboard uses **config.json as the single source of truth** for all application configuration. All settings can be managed through the web UI without requiring file editing or server restarts.

## Architecture Principles

### 1. Single Source of Truth: config.json

**Location**: Project root (`/home/m0nkey/mikrotik-dashboard/config.json`)

**Purpose**: Persistent storage for all application settings including:
- Server configuration (port, CORS)
- MikroTik router connection details
- AI provider credentials (Claude, LMStudio, Cloudflare)
- Assistant behavior settings
- UI preferences

**Security**: File has 600 permissions (owner read/write only)

### 2. Web UI First Approach

**All settings are editable through the web UI** at `Settings` page:

#### Server Configuration Tab
- Server port and CORS settings
- MikroTik connection details (host, port, username, password)
- AI provider selection (Claude, LMStudio, Cloudflare)
- Provider-specific credentials and settings
- Assistant behavior (temperature, max tokens, system prompt)

#### UI Preferences Tab
- Terminal appearance (font, colors, syntax highlighting)
- Display settings (timezone, date/time format)
- AI assistant behavior toggles
- Security preferences (audit logging, session timeout)

**No file editing required** - all changes are made through intuitive web forms.

### 3. Hot Reload System

**Changes apply immediately without server restart:**

When you save settings via the web UI:
1. Settings written atomically to config.json (with backup)
2. Configuration reloaded from disk
3. Services automatically refresh:
   - AI provider reconnects with new credentials
   - MikroTik connection re-establishes
4. Changes are live within seconds

**Implementation**: `refreshGlobalProvider()` called on LLM settings changes ([settings.ts:60](server/src/routes/settings.ts:60))

## Configuration Loading Priority

Settings are loaded with the following priority (later overrides earlier):

```
1. Built-in Defaults (config.defaults.ts)
   ↓
2. config.json (Primary source - Web UI edits)
   ↓
3. Environment Variables (.env) (Optional overrides)
```

### Layer 1: Built-in Defaults

**File**: [server/src/services/config/config.defaults.ts](server/src/services/config/config.defaults.ts)

**Purpose**: Sensible defaults for first-time setup

**Example**:
```typescript
llm: {
  provider: 'lmstudio',
  cloudflare: {
    accountId: '',
    apiToken: '',
    model: '@cf/meta/llama-4-scout-17b-16e-instruct'
  }
}
```

### Layer 2: config.json (PRIMARY)

**Managed by**: Web UI Settings page

**User workflow**:
1. Open Settings in web UI
2. Edit any configuration value
3. Click "Test Connection" (optional)
4. Click "Save Server Settings"
5. Changes written to config.json
6. Services automatically reload

**Example config.json**:
```json
{
  "version": "1.0.0",
  "llm": {
    "provider": "cloudflare",
    "cloudflare": {
      "accountId": "your_account_id",
      "apiToken": "your_api_token",
      "model": "@cf/meta/llama-4-scout-17b-16e-instruct",
      "gateway": "my-gateway"
    }
  }
}
```

### Layer 3: Environment Variables (OPTIONAL)

**File**: `server/.env` (git-ignored)

**Purpose**: Optional overrides for:
- Docker/Kubernetes deployments
- CI/CD pipelines
- Multi-environment setups (dev/staging/prod)
- Keeping production secrets out of config files

**When to use**:
- You're deploying in containers
- You need different credentials per environment
- You follow 12-factor app principles
- You want to keep secrets in environment, not files

**Supported variables**:
```bash
# Server
PORT=3000
CORS_ORIGIN=*
NODE_ENV=development

# MikroTik
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your_password
MIKROTIK_TIMEOUT=10000

# Claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# LMStudio
LMSTUDIO_ENDPOINT=http://localhost:1234/v1
LMSTUDIO_MODEL=model-name
LMSTUDIO_CONTEXT_WINDOW=32768

# Cloudflare Workers AI
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_AI_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
CLOUDFLARE_AI_GATEWAY=my-gateway

# Assistant
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2048
AI_SYSTEM_PROMPT="Your custom prompt..."
```

**Important**: Environment variables are OPTIONAL. Most users should use the web UI exclusively.

## Cloudflare Workers AI Configuration

### Via Web UI (Recommended)

1. **Open Settings** → Navigate to Settings page
2. **Select Provider** → Choose "Cloudflare Workers AI"
3. **Enter Credentials**:
   - Account ID: Get from Cloudflare Dashboard URL
   - API Token: Create with Workers AI permissions
   - Model: Select from dropdown (default: Llama 4 Scout 17B)
   - Gateway: Optional (for caching/analytics)
4. **Test Connection** → Click "Test Connection" button
5. **Save** → Click "Save Server Settings"
6. **Done** → Provider reloads automatically, no restart needed

### Getting Cloudflare Credentials

See [server/CLOUDFLARE_SETUP.md](server/CLOUDFLARE_SETUP.md) for detailed instructions.

**Quick steps**:
1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Get Account ID from URL or sidebar
3. Create API Token with Workers AI permissions
4. Enter credentials in web UI

### Via Environment Variables (Advanced)

If you prefer environment-based configuration:

**Create** `server/.env`:
```bash
LLM_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_AI_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
```

**Restart** server: `npm run dev`

## Security Model

### Credential Masking

Sensitive credentials are **masked in API responses** to prevent exposure:

**Backend** ([settings.ts](server/src/routes/settings.ts)):
```typescript
// GET /api/settings returns masked credentials
{
  mikrotik: { password: '********' },
  llm: {
    claude: { apiKey: '********' },
    cloudflare: { apiToken: '********' }
  }
}
```

**Frontend** ([SettingsPage.tsx](src/pages/SettingsPage/SettingsPage.tsx)):
```typescript
// Tracks original masked values
const [originalMaskedCloudflareToken, setOriginalMaskedCloudflareToken] = useState('');

// Only sends token to server if user actually changed it
if (cloudflareToken !== originalMaskedCloudflareToken) {
  // Send new token
}
```

**Benefits**:
- Credentials never exposed in browser network tab
- Tokens only transmitted when user updates them
- Same security model for all credential fields

### File Permissions

**config.json**: 600 (owner read/write only)
```bash
-rw------- 1 m0nkey m0nkey config.json
```

**Backups**: Created automatically before saves
```bash
config.backup.2025-10-31T09-32-37-064Z.json
```

### Best Practices

1. **Use Web UI** - Safest and easiest method
2. **Keep .env git-ignored** - Already configured
3. **Don't commit config.json** - Add to .gitignore if needed
4. **Rotate credentials regularly** - Generate new tokens every 90 days
5. **Use minimum permissions** - Workers AI Read (not Edit) if possible
6. **Monitor usage** - Check Cloudflare Dashboard for suspicious activity

## Implementation Details

### Configuration Service Stack

```
Web UI (SettingsPage.tsx)
    ↓ PUT /api/settings
Settings Route (routes/settings.ts)
    ↓ updateSettings()
SettingsService (services/settings.ts)
    ↓ save()
UnifiedConfigService (services/config/unified-config.service.ts)
    ↓ atomicWrite()
config.json (File System)
```

### Key Files

| File | Purpose |
|------|---------|
| [config.json](config.json) | Single source of truth |
| [server/src/services/config/unified-config.service.ts](server/src/services/config/unified-config.service.ts) | Configuration loading & saving |
| [server/src/services/settings.ts](server/src/services/settings.ts) | Settings API abstraction |
| [server/src/routes/settings.ts](server/src/routes/settings.ts) | REST API endpoints |
| [src/pages/SettingsPage/SettingsPage.tsx](src/pages/SettingsPage/SettingsPage.tsx) | Web UI interface |

### Validation

**Schema validation** via Zod ([config.schema.ts](server/src/services/config/config.schema.ts)):
- Type safety for all configuration values
- Validation on save prevents invalid configs
- Clear error messages for validation failures

### Atomic Writes

**Process** ([unified-config.service.ts:302-313](server/src/services/config/unified-config.service.ts:302-313)):
1. Write to temporary file: `config.json.tmp`
2. Atomic rename: `config.json.tmp` → `config.json`
3. Set permissions: `chmod 600`

**Benefits**:
- No partial writes if process crashes
- Always have valid configuration
- Transaction-like semantics

### Backup System

**Automatic backups** before each save:
- Filename format: `config.backup.{ISO_TIMESTAMP}.json`
- Created before atomic write
- Allows rollback if needed

**Example**:
```bash
config.backup.2025-10-31T09-32-37-064Z.json
```

## Troubleshooting

### Problem: Changes not applied

**Check**:
1. Did you click "Save Server Settings"?
2. Are there validation errors in the UI?
3. Check browser console for errors
4. Check server logs for save failures

**Solution**: Ensure settings are valid and saved properly

### Problem: Need to revert changes

**Options**:
1. **Web UI**: Click "Discard Changes" before saving
2. **Backup**: Restore from `config.backup.*.json` file
3. **Defaults**: Delete config.json to reset to defaults

**Restore from backup**:
```bash
cp config.backup.2025-10-31T09-32-37-064Z.json config.json
# Restart server or reload via web UI
```

### Problem: Environment variables not working

**Common causes**:
1. `.env` file not in `server/` directory
2. Variables not prefixed correctly
3. Server not restarted after creating .env

**Solution**: Verify `.env` location and restart server

### Problem: Credentials showing as '********'

**This is normal!** Credentials are masked for security.

**To update**:
1. Type new credentials in the field
2. Original masked value is replaced
3. Save settings
4. New credentials are used

## Migration Guides

### From .env to Web UI

If you currently use `.env` for configuration:

1. **Backup** current .env file
2. **Open Settings** in web UI
3. **Enter credentials** manually via UI
4. **Save** settings
5. **Test** functionality
6. **Optional**: Remove credentials from .env (keep file for other vars)

**Note**: .env overrides still work! You can keep environment-based config if preferred.

### From config.json edits to Web UI

If you've been manually editing config.json:

**No migration needed!**
- Web UI reads existing config.json
- Your manual edits are preserved
- Simply use web UI going forward

## Advanced Topics

### Docker Deployment

**Recommended approach**: Environment variables for secrets, config.json for other settings

**docker-compose.yml**:
```yaml
services:
  mikrotik-dashboard:
    image: mikrotik-dashboard:latest
    environment:
      - CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}
      - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
      - MIKROTIK_PASSWORD=${MIKROTIK_PASSWORD}
    volumes:
      - ./config.json:/app/config.json
```

### CI/CD Integration

**Use environment variables** for credential injection:

**GitHub Actions example**:
```yaml
- name: Run tests
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    MIKROTIK_PASSWORD: ${{ secrets.MIKROTIK_PASSWORD }}
  run: npm test
```

### Multi-Environment Setup

**Strategy**: Base config.json + environment-specific .env

**config.json** (shared):
```json
{
  "llm": {
    "provider": "cloudflare",
    "cloudflare": {
      "model": "@cf/meta/llama-4-scout-17b-16e-instruct"
    }
  }
}
```

**server/.env.development**:
```bash
CLOUDFLARE_ACCOUNT_ID=dev_account_id
CLOUDFLARE_API_TOKEN=dev_token
```

**server/.env.production**:
```bash
CLOUDFLARE_ACCOUNT_ID=prod_account_id
CLOUDFLARE_API_TOKEN=prod_token
```

## Summary

### For Most Users

✓ **Use the web UI exclusively**
- No file editing
- No server restarts
- Immediate feedback
- Secure credential handling

### For Advanced Users

✓ **Environment variables available**
- Optional override mechanism
- Useful for deployments
- Doesn't interfere with web UI
- Follows 12-factor principles

### Key Takeaways

1. **config.json is the single source of truth**
2. **Web UI is the primary interface**
3. **Environment variables are optional overrides**
4. **Hot reload eliminates server restarts**
5. **Security built-in with credential masking**
6. **Atomic writes prevent corruption**
7. **Automatic backups enable rollback**

For Cloudflare-specific setup, see [server/CLOUDFLARE_SETUP.md](server/CLOUDFLARE_SETUP.md).

# Configuration Unification Roadmap
## Unified config.json Implementation Plan

**Document Version:** 1.0
**Date:** 2025-01-27
**Status:** Proposal

---

## Executive Summary

This document outlines a comprehensive plan to unify the fragmented configuration system in the MikroTik Dashboard project by implementing a single `config.json` file as the source of truth for all application settings.

### Current Problems
- Dual .env files (root and server) causing confusion
- Split storage: backend settings in .env, UI settings in localStorage
- No single source of truth
- Settings require server restart to take effect
- No backup/restore capability
- Scattered default values across multiple files
- Difficult to export/import complete configuration

### Proposed Solution
A unified `config.json` system that:
- Consolidates ALL settings (server + UI) in one file
- Supports hot-reload without server restart
- Provides automatic backups and validation
- Enables environment variable overrides for Docker/K8s
- Includes migration tools for seamless transition
- Offers WebSocket-based real-time sync for UI settings

---

## Current Architecture Analysis

### Configuration Sources (Current State)

```
.env (root)
  ├─ Server configuration
  ├─ MikroTik connection
  ├─ LLM provider settings
  └─ Assistant configuration

server/.env (mostly unused)
  └─ Duplicate/conflicting configuration

localStorage (browser)
  └─ UI settings (terminal, display, behavior, security)

process.env (runtime)
  └─ Read-only environment variables

Defaults (scattered)
  ├─ server/src/services/settings.ts (lines 59-86)
  ├─ server/src/services/config-manager.ts (lines 77-78)
  └─ src/types/settings.ts (lines 77-106)
```

### Data Flow (Current)

```
.env file
  ↓ [dotenv.config() at server startup]
process.env
  ↓ [SettingsService.getSettings() reads]
ServerSettings object
  ↓ [ConfigManager.loadConfig() wraps]
AppConfig object
  ↓ [Services consume]
MikroTik/LLM/Server services

localStorage (separate flow)
  ↓ [Frontend reads directly]
UISettings object
  ↓ [React components consume]
```

### Identified Conflicts

**Conflict 1: Dual .env Files**
- `/.env.example` (100 lines, comprehensive)
- `/server/.env.example` (24 lines, partial)
- Server loads from root, but dual files suggest confusion
- Developers unsure which file to edit

**Conflict 2: Split Storage**
- Backend settings persisted to .env
- UI settings persisted to browser localStorage
- No way to export/import complete configuration
- Settings don't sync across devices/browsers

**Conflict 3: No Hot-Reload**
- Most .env changes require server restart
- process.env updates don't propagate to services
- Poor developer experience

**Conflict 4: Validation Timing**
- Settings only validated on save attempt
- Invalid values can exist in process.env
- Errors appear late in the workflow

**Conflict 5: Scattered Defaults**
- Three separate files define defaults
- Inconsistent default values
- Hard to maintain and update

---

## Proposed Architecture

### Unified Configuration Structure

```json
{
  "version": "1.0.0",
  "server": {
    "port": 3000,
    "corsOrigin": "http://localhost:5173",
    "nodeEnv": "development"
  },
  "mikrotik": {
    "host": "192.168.88.1",
    "port": 8728,
    "username": "admin",
    "password": "",
    "timeout": 10000,
    "keepaliveInterval": 30000
  },
  "llm": {
    "provider": "lmstudio",
    "claude": {
      "apiKey": "",
      "model": "claude-3-5-sonnet-20241022"
    },
    "lmstudio": {
      "endpoint": "http://localhost:1234",
      "model": "",
      "contextWindow": 70752
    }
  },
  "assistant": {
    "temperature": 0.7,
    "maxTokens": 2048,
    "systemPrompt": "You are an expert MikroTik router assistant..."
  },
  "ui": {
    "terminal": {
      "fontFamily": "JetBrains Mono",
      "fontSize": 14,
      "lineHeight": 1.5,
      "syntaxHighlighting": true,
      "lineNumbers": false,
      "historyLimit": 1000,
      "colorScheme": "dark-orange"
    },
    "display": {
      "timezone": "America/New_York",
      "timeFormat": "12h",
      "dateFormat": "MMM DD, YYYY"
    },
    "behavior": {
      "enableSuggestions": true,
      "showExplanations": true,
      "autoExecuteSafe": false,
      "requireConfirmation": true
    },
    "security": {
      "storeCredentials": false,
      "encryptCredentials": true,
      "sessionTimeout": 60,
      "enableAuditLogging": true,
      "logAiConversations": true,
      "logRouterCommands": true
    }
  }
}
```

### Configuration Priority

**Priority Order (Highest to Lowest):**
1. **Environment Variables** - Runtime overrides (Docker/K8s secrets)
2. **config.json** - User configuration file (primary source)
3. **config.default.json** - Built-in defaults (shipped with app)

**Rationale:**
- Environment variables highest: Docker/K8s deployments can inject secrets
- config.json middle: User-editable, persisted configuration
- Defaults lowest: Fallback values, always available

### New Data Flow

```
config.default.json (built-in defaults)
  ↓ [merge]
config.json (user config)
  ↓ [merge]
process.env (environment overrides)
  ↓ [UnifiedConfigService validates & merges]
AppConfig object (in-memory)
  ↓ [Event-based hot-reload]
Services (MikroTik, LLM, etc.)
  ↓ [WebSocket broadcast]
Frontend clients (real-time sync)
```

---

## Technical Design

### Core Service: UnifiedConfigService

```typescript
class UnifiedConfigService {
  private configPath: string = './config.json';
  private defaultConfigPath: string = './config.default.json';
  private config: AppConfig | null = null;
  private cache: Map<string, any> = new Map();
  private watcher: FSWatcher | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();

  // Load configuration with priority merging
  async load(): Promise<AppConfig> {
    const defaults = await this.loadDefaults();
    const fileConfig = await this.loadConfigFile();
    const envOverrides = this.getEnvOverrides();

    this.config = this.deepMerge(defaults, fileConfig, envOverrides);
    await this.validate(this.config);

    return this.config;
  }

  // Save configuration with validation and backup
  async save(updates: Partial<AppConfig>): Promise<void> {
    const current = await this.loadConfigFile();
    const updated = this.deepMerge(current, updates);

    // Validate before saving
    await this.validate(updated);

    // Create backup
    await this.backup();

    // Atomic write
    await this.atomicWrite(updated);

    // Reload and emit events
    await this.reload();
  }

  // Watch for file changes and hot-reload
  watch(): void {
    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.watcher.on('change', async () => {
      await this.reload();
      this.eventEmitter.emit('config:changed', this.config);
    });
  }

  // Event-based section updates
  onSectionChange(section: ConfigSection,
                   callback: (changes: any) => void): void {
    this.eventEmitter.on(`config:${section}:changed`, callback);
  }

  // Hot-reload with error handling
  async reload(): Promise<void> {
    try {
      const newConfig = await this.load();
      const diff = this.diff(this.config, newConfig);

      this.config = newConfig;

      // Emit section-specific events
      for (const section of Object.keys(diff)) {
        this.eventEmitter.emit(
          `config:${section}:changed`,
          diff[section]
        );
      }

      this.eventEmitter.emit('config:reloaded', newConfig);
    } catch (error) {
      console.error('Hot-reload failed, keeping old config:', error);
      this.eventEmitter.emit('config:reload:failed', error);
    }
  }
}
```

### Schema Validation (Zod)

```typescript
import { z } from 'zod';

const ServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  corsOrigin: z.string().url().or(z.literal('*')),
  nodeEnv: z.enum(['development', 'production', 'test']),
});

const MikroTikConfigSchema = z.object({
  host: z.string().ip().or(z.string().regex(/^[a-zA-Z0-9.-]+$/)),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string(),
  timeout: z.number().int().min(1000).max(60000),
  keepaliveInterval: z.number().int().min(5000).max(300000),
});

const LLMConfigSchema = z.object({
  provider: z.enum(['claude', 'lmstudio']),
  claude: z.object({
    apiKey: z.string(),
    model: z.string(),
  }),
  lmstudio: z.object({
    endpoint: z.string().url(),
    model: z.string(),
    contextWindow: z.number().int().min(1024).optional(),
  }),
});

const UITerminalConfigSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().int().min(8).max(32),
  lineHeight: z.number().min(1).max(3),
  syntaxHighlighting: z.boolean(),
  lineNumbers: z.boolean(),
  historyLimit: z.number().int().min(100).max(10000),
  colorScheme: z.enum(['dark-orange', 'classic-green', 'cyan-blue', 'custom']),
});

const AppConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  server: ServerConfigSchema,
  mikrotik: MikroTikConfigSchema,
  llm: LLMConfigSchema,
  assistant: z.object({
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(100).max(100000),
    systemPrompt: z.string(),
  }),
  ui: z.object({
    terminal: UITerminalConfigSchema,
    display: z.object({
      timezone: z.string(),
      timeFormat: z.enum(['12h', '24h']),
      dateFormat: z.string(),
    }),
    behavior: z.object({
      enableSuggestions: z.boolean(),
      showExplanations: z.boolean(),
      autoExecuteSafe: z.boolean(),
      requireConfirmation: z.boolean(),
    }),
    security: z.object({
      storeCredentials: z.boolean(),
      encryptCredentials: z.boolean(),
      sessionTimeout: z.number().int().min(5).max(1440),
      enableAuditLogging: z.boolean(),
      logAiConversations: z.boolean(),
      logRouterCommands: z.boolean(),
    }),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
```

### Hot-Reload Event System

```typescript
// Service registration for hot-reload
configService.onSectionChange('mikrotik', async (changes) => {
  console.log('[MikroTik] Configuration changed, reconnecting...');
  await mikrotikService.reconnect(changes);
});

configService.onSectionChange('llm', async (changes) => {
  console.log('[AI] Provider configuration changed, refreshing...');
  await refreshGlobalProvider();
});

configService.onSectionChange('ui', (changes) => {
  console.log('[WebSocket] Broadcasting UI settings to all clients...');
  io.emit('config:ui:updated', changes);
});
```

### Migration Tool

```typescript
// scripts/migrate-config.ts
class ConfigMigrator {
  async migrate(options: { dryRun?: boolean } = {}): Promise<void> {
    console.log('Configuration Migration Tool');
    console.log('=============================\n');

    // Step 1: Check prerequisites
    console.log('[1/7] Checking prerequisites...');
    const hasEnv = await this.fileExists('.env');
    if (!hasEnv) {
      console.log('No .env file found. Nothing to migrate.');
      return;
    }

    // Step 2: Backup existing config.json if exists
    console.log('[2/7] Creating backups...');
    if (await this.fileExists('config.json')) {
      await this.backup('config.json', 'config.json.backup');
      console.log('  Backed up: config.json -> config.json.backup');
    }
    await this.backup('.env', '.env.backup');
    console.log('  Backed up: .env -> .env.backup');

    // Step 3: Load and parse .env
    console.log('[3/7] Reading .env file...');
    const envConfig = await this.loadFromEnv();
    console.log(`  Found ${Object.keys(envConfig).length} settings`);

    // Step 4: Create unified config
    console.log('[4/7] Creating unified configuration...');
    const unifiedConfig = this.createUnifiedConfig(envConfig);

    // Step 5: Validate
    console.log('[5/7] Validating configuration...');
    const validation = this.validate(unifiedConfig);
    if (!validation.valid) {
      console.error('  Validation failed:');
      validation.errors.forEach(err => console.error(`    - ${err}`));
      return;
    }
    console.log('  Configuration is valid');

    // Step 6: Write config.json
    if (options.dryRun) {
      console.log('[6/7] Dry run - would write config.json');
      console.log(JSON.stringify(unifiedConfig, null, 2));
    } else {
      console.log('[6/7] Writing config.json...');
      await this.writeConfig(unifiedConfig);
      console.log('  Created: config.json');
    }

    // Step 7: Summary
    console.log('[7/7] Migration complete!\n');
    console.log('Next steps:');
    console.log('  1. Review config.json to ensure values are correct');
    console.log('  2. Test the application: npm run dev:backend');
    console.log('  3. If everything works, you can delete .env.backup');
    console.log('\nRollback: If needed, restore from .env.backup');
  }
}

// Usage
const migrator = new ConfigMigrator();
await migrator.migrate({ dryRun: false });
```

### REST API Endpoints

```typescript
// routes/config.ts
router.get('/api/config', async (req, res) => {
  const config = await configService.get();
  // Mask sensitive fields
  const masked = maskSensitiveFields(config);
  res.json(masked);
});

router.get('/api/config/:section', async (req, res) => {
  const config = await configService.get();
  const section = config[req.params.section];
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  res.json(maskSensitiveFields(section));
});

router.patch('/api/config/:section', async (req, res) => {
  try {
    const updates = { [req.params.section]: req.body };
    await configService.save(updates);
    res.json({ success: true, reloadRequired: false });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/api/config/validate', async (req, res) => {
  const validation = configService.validate(req.body);
  res.json(validation);
});

router.post('/api/config/export', async (req, res) => {
  const config = await configService.get();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=config.json');
  res.send(JSON.stringify(config, null, 2));
});

router.post('/api/config/import', upload.single('config'), async (req, res) => {
  try {
    const config = JSON.parse(req.file.buffer.toString());
    const validation = configService.validate(config);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid configuration', errors: validation.errors });
    }

    await configService.save(config);
    res.json({ success: true, message: 'Configuration imported successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Priority: HIGH**

**Tasks:**
1. Create UnifiedConfigService class
   - File I/O operations (read, write, atomic write)
   - Default config loading
   - Environment variable override logic
   - Deep merge functionality

2. Implement Zod validation schemas
   - All configuration sections
   - Custom validators for IPs, URLs, etc.
   - Clear error messages

3. Create config.default.json
   - Consolidate all defaults from scattered locations
   - Document each setting
   - Version the schema

4. Create config.json.example
   - Template for users
   - Inline documentation
   - Examples for common scenarios

5. Update .gitignore
   - Protect config.json from commits
   - Allow config.default.json and config.json.example

**Deliverables:**
- UnifiedConfigService with full test coverage
- config.default.json with all defaults
- config.json.example template
- Zod schemas for validation

**Success Criteria:**
- Config service can load, validate, and save
- All tests passing
- Documentation complete

---

### Phase 2: Migration Tools (Week 2-3)
**Priority: HIGH**

**Tasks:**
1. Build ConfigMigrator class
   - Parse .env files
   - Convert to config.json format
   - Handle edge cases (comments, multiline, quotes)

2. Add backup/restore functionality
   - Automatic backups before writes
   - Timestamped backup files
   - Restore from backup API

3. Create CLI tools
   - `npm run migrate-config` (interactive migration)
   - `npm run config:validate` (validate current config)
   - `npm run config:backup` (manual backup)
   - `npm run config:restore` (restore from backup)

4. Add dry-run mode
   - Preview migration without changes
   - Validation without side effects

**Deliverables:**
- Complete migration tool
- Backup/restore system
- CLI commands
- Migration test suite

**Success Criteria:**
- Successful migration from various .env formats
- Zero data loss in migrations
- Clear error messages and rollback capability

---

### Phase 3: Backend Integration (Week 3-4)
**Priority: HIGH**

**Tasks:**
1. Replace SettingsService
   - Deprecate SettingsService
   - Update ConfigManager to use UnifiedConfigService
   - Remove .env write operations

2. Implement hot-reload system
   - Event emitter for config changes
   - Section-specific change events
   - Service subscription to config events

3. Update service integrations
   - MikroTik service: reconnect on config change
   - AI provider: refresh on LLM config change
   - CORS: update on server config change

4. Add startup initialization
   - Auto-migrate if .env exists but config.json doesn't
   - Validate config on startup
   - Warn about invalid configurations

**Deliverables:**
- Backend fully using UnifiedConfigService
- Hot-reload working for supported sections
- Services responding to config changes
- Deprecation warnings for .env usage

**Success Criteria:**
- No server restart needed for most config changes
- MikroTik reconnects automatically
- AI provider refreshes automatically
- All integration tests passing

---

### Phase 4: API Updates (Week 4-5)
**Priority: MEDIUM**

**Tasks:**
1. Create /api/config endpoints
   - GET /api/config (full config)
   - GET /api/config/:section (specific section)
   - PATCH /api/config/:section (update section)
   - POST /api/config/validate (validate config)

2. Add export/import endpoints
   - POST /api/config/export (download config.json)
   - POST /api/config/import (upload config.json)

3. Add backup management
   - GET /api/config/backups (list backups)
   - POST /api/config/restore (restore from backup)
   - DELETE /api/config/backups/:id (delete backup)

4. Maintain backward compatibility
   - Keep /api/settings as deprecated alias
   - Add deprecation headers
   - Update API documentation

**Deliverables:**
- Complete REST API for config management
- Backward compatible /api/settings endpoints
- API documentation
- Postman/OpenAPI collection

**Success Criteria:**
- All endpoints functional and tested
- Backward compatibility maintained
- Clear deprecation notices
- API documentation complete

---

### Phase 5: Frontend Integration (Week 5-6)
**Priority: MEDIUM**

**Tasks:**
1. Update SettingsPage
   - Use /api/config endpoints
   - Remove localStorage usage for settings
   - Add real-time update indicators

2. Migrate localStorage to config.json
   - One-time migration on first load
   - Clear localStorage after successful migration
   - Show migration success message

3. Add WebSocket listeners
   - Listen for config:ui:updated events
   - Update React state on config changes
   - Apply theme changes dynamically

4. Add UI feedback
   - "Settings synced across devices" message
   - Real-time validation errors
   - Save confirmation

**Deliverables:**
- Frontend using unified config
- UI settings in config.json
- Real-time sync working
- localStorage migration complete

**Success Criteria:**
- UI settings sync across browser tabs
- No localStorage usage for settings
- Real-time updates working
- User experience improved

---

### Phase 6: Testing & Documentation (Week 6-7)
**Priority: HIGH**

**Tasks:**
1. Unit tests
   - UnifiedConfigService (>95% coverage)
   - ConfigMigrator (100% coverage)
   - Validation schemas (>90% coverage)

2. Integration tests
   - Hot-reload functionality
   - Service reconnections
   - WebSocket broadcasting
   - API endpoints

3. End-to-end tests
   - Complete user workflows
   - Migration scenarios
   - Error recovery
   - Backup/restore

4. Documentation
   - Configuration guide (docs/configuration.md)
   - Migration guide (docs/migration-guide.md)
   - API reference
   - Update README.md
   - Add troubleshooting section

**Deliverables:**
- Complete test suite
- All documentation updated
- Migration guide
- Troubleshooting guide

**Success Criteria:**
- Test coverage >90% overall
- All documentation reviewed and accurate
- Users can self-migrate without support
- Clear error messages and troubleshooting

---

### Phase 7: Deprecation & Cleanup (Week 8+)
**Priority: LOW**

**Tasks:**
1. Add deprecation warnings
   - Log warnings when .env is used
   - Add banner in UI for unmigrated users
   - Email notifications (if applicable)

2. Monitor adoption
   - Track migration rate
   - Collect user feedback
   - Address migration issues

3. Plan .env removal
   - Set deprecation timeline (3-6 months)
   - Communicate timeline to users
   - Prepare breaking change documentation

4. Clean up deprecated code
   - Remove SettingsService
   - Remove .env support
   - Remove localStorage migration code

**Deliverables:**
- Deprecation notices active
- Adoption metrics dashboard
- Removal timeline communicated
- Clean codebase post-deprecation

**Success Criteria:**
- >80% of users migrated within 3 months
- Clear communication of deprecation
- Smooth transition with minimal support tickets

---

## File Structure

```
mikrotik-dashboard/
├── config.default.json               # Shipped defaults (committed)
├── config.json.example                # User template (committed)
├── config.json                        # User config (gitignored)
├── config.json.backup                 # Auto-backup (gitignored)
├── .env.backup                        # Migration backup (gitignored)
│
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── config/
│   │   │   │   ├── unified-config.service.ts
│   │   │   │   ├── config.schema.ts
│   │   │   │   ├── config.validator.ts
│   │   │   │   ├── config.defaults.ts
│   │   │   │   ├── config.migrator.ts
│   │   │   │   ├── config.backup.ts
│   │   │   │   └── index.ts
│   │   │   ├── config-manager.ts       # Updated
│   │   │   └── settings.ts             # Deprecated
│   │   │
│   │   ├── routes/
│   │   │   ├── config.ts               # New
│   │   │   └── settings.ts             # Deprecated
│   │   │
│   │   └── index.ts                    # Updated
│   │
│   ├── scripts/
│   │   ├── migrate-config.ts
│   │   ├── validate-config.ts
│   │   └── setup-config.ts
│   │
│   └── package.json                    # Updated scripts
│
├── src/
│   ├── types/
│   │   ├── config.ts                   # New unified types
│   │   └── settings.ts                 # Deprecated
│   │
│   └── pages/
│       └── SettingsPage/
│           └── SettingsPage.tsx        # Updated
│
├── docs/
│   ├── configuration.md                # New
│   ├── migration-guide.md              # New
│   └── api-reference.md                # Updated
│
└── .gitignore                          # Updated
```

---

## Security Considerations

### File Permissions

```bash
# Set secure permissions on config.json
chmod 600 config.json

# Auto-enforced by UnifiedConfigService on creation
await fs.chmod(this.configPath, 0o600);
```

### Sensitive Data Handling

**Option 1: Environment Variable Override (Recommended for Production)**
```bash
# config.json has empty values
{
  "mikrotik": { "password": "" },
  "llm": { "claude": { "apiKey": "" } }
}

# Secrets via environment variables
MIKROTIK_PASSWORD=secret123
ANTHROPIC_API_KEY=sk-ant-xxx
```

**Option 2: Encryption at Rest (Optional)**
```typescript
interface SecureConfig {
  encrypted: boolean;
  encryptionMethod?: 'aes-256-gcm';
  data: string; // encrypted JSON
}

class SecureConfigStorage {
  async saveEncrypted(config: AppConfig): Promise<void> {
    const key = await this.getEncryptionKey();
    const encrypted = this.encrypt(JSON.stringify(config), key);
    await fs.writeFile('config.json', JSON.stringify({
      encrypted: true,
      encryptionMethod: 'aes-256-gcm',
      data: encrypted
    }));
  }
}
```

### API Security

```typescript
// Mask sensitive fields in responses
function maskSensitiveFields(config: any): any {
  const masked = { ...config };

  if (masked.mikrotik?.password) {
    masked.mikrotik.password = masked.mikrotik.password
      ? '********'
      : '';
  }

  if (masked.llm?.claude?.apiKey) {
    masked.llm.claude.apiKey = masked.llm.claude.apiKey
      ? 'sk-ant-' + '*'.repeat(10)
      : '';
  }

  return masked;
}
```

### Git Protection

```gitignore
# .gitignore
config.json
config.json.backup
.env
.env.backup
backups/

# Allow templates
!config.default.json
!config.json.example
!.env.example
```

---

## Docker & Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  mikrotik-dashboard:
    build: .
    ports:
      - "3000:3000"
    environment:
      # Override secrets via environment variables
      - MIKROTIK_PASSWORD=${MIKROTIK_PASSWORD}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      # Mount config for persistence
      - ./config.json:/app/config.json:rw
      # Mount backups directory
      - ./backups:/app/backups:rw
    restart: unless-stopped
```

### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mikrotik-config
data:
  config.json: |
    {
      "version": "1.0.0",
      "server": {
        "port": 3000,
        "corsOrigin": "*",
        "nodeEnv": "production"
      },
      "mikrotik": {
        "host": "192.168.1.1",
        "port": 8728,
        "username": "admin",
        "password": "",
        "timeout": 10000,
        "keepaliveInterval": 30000
      }
    }
---
apiVersion: v1
kind: Secret
metadata:
  name: mikrotik-secrets
type: Opaque
stringData:
  mikrotik-password: "secret123"
  anthropic-api-key: "sk-ant-xxx"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mikrotik-dashboard
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: dashboard
        image: mikrotik-dashboard:latest
        env:
        - name: MIKROTIK_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mikrotik-secrets
              key: mikrotik-password
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: mikrotik-secrets
              key: anthropic-api-key
        volumeMounts:
        - name: config
          mountPath: /app/config.json
          subPath: config.json
      volumes:
      - name: config
        configMap:
          name: mikrotik-config
```

---

## Dependencies

### New Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "@types/chokidar": "^2.1.3"
  }
}
```

### Justification

**Zod** (Schema Validation):
- Runtime type safety with TypeScript integration
- Clear, actionable error messages
- Schema composition and reuse
- Industry standard (used by tRPC, Prisma)
- Better DX than Joi or Yup

**Chokidar** (File Watching):
- Cross-platform reliability
- Built-in debouncing
- Mature and battle-tested
- Used by Vite, Webpack, and other major tools
- Better than native fs.watch (platform inconsistencies)

---

## Risk Analysis & Mitigation

### Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Data loss during migration | HIGH | MEDIUM | Automatic backups, validation, dry-run mode |
| Service downtime during reload | MEDIUM | LOW | Graceful hot-reload, fallback to old config |
| Breaking changes for users | MEDIUM | HIGH | Backward compatibility, deprecation period |
| Security regression | HIGH | LOW | Auto-set permissions, encryption support |
| Configuration corruption | MEDIUM | LOW | Schema validation, backup recovery |
| Performance impact | LOW | LOW | Caching, debouncing, lazy loading |

### Mitigation Strategies

**Data Loss Prevention:**
- Automatic backup before every write
- Validation before overwriting files
- Dry-run mode for testing migrations
- Clear rollback instructions
- Warning prompts for destructive actions

**Service Continuity:**
- Hot-reload without service interruption
- Keep old config if new one fails validation
- Atomic file operations
- Services handle config updates asynchronously
- WebSocket reconnection for clients

**Backward Compatibility:**
- Maintain .env support during transition (3-6 months)
- Deprecation warnings but no breaking changes
- Clear migration guide
- Automated migration tool
- API aliases for old endpoints

**Security Hardening:**
- Auto-set secure file permissions (chmod 600)
- Validation checks on startup
- Support for encrypted configs
- Environment variable overrides for secrets
- Documentation on security best practices

**Data Integrity:**
- Zod schema validation on every read
- Backup before writes
- Recovery from backup on corruption
- Fall back to defaults if unrecoverable
- File locking for concurrent writes

---

## Testing Strategy

### Test Coverage Goals

- Unit Tests: >90%
- Integration Tests: >80%
- Migration Tests: 100% (critical path)
- E2E Tests: Key user workflows

### Test Scenarios

**Unit Tests:**
- UnifiedConfigService load/save/reload
- Schema validation (valid/invalid inputs)
- Deep merge logic
- Environment variable override
- File operations (read/write/backup)
- Error handling (corrupted files, permissions)

**Integration Tests:**
- Hot-reload triggering service updates
- MikroTik reconnection on config change
- AI provider refresh on LLM config change
- WebSocket broadcasting UI settings
- API endpoint functionality
- Concurrent write handling

**Migration Tests:**
- Minimal .env migration
- Complete .env migration
- .env with comments and special characters
- Malformed .env handling
- Custom value preservation
- Backup creation and verification

**E2E Tests:**
- User changes setting in UI
- Server hot-reloads configuration
- Service reconnects automatically
- UI updates in real-time across tabs
- Export/import workflow
- Backup/restore workflow

---

## Performance Targets

### Operational Metrics

- **Config Load**: <10ms (cached) / <50ms (from disk)
- **Config Save**: <100ms (with validation and backup)
- **Hot-Reload**: <200ms (full reload with service updates)
- **File Watch Latency**: <500ms (debounced)
- **API Response**: <50ms (read) / <200ms (write)
- **WebSocket Broadcast**: <100ms (to all clients)

### Optimization Techniques

**Caching:**
```typescript
private cache: AppConfig | null = null;
private cacheTime: Date | null = null;
private cacheTTL: number = 5000; // 5 seconds

async get(): Promise<AppConfig> {
  if (this.cache && this.isCacheFresh()) {
    return this.cache;
  }
  this.cache = await this.load();
  this.cacheTime = new Date();
  return this.cache;
}
```

**Debounced File Watching:**
```typescript
this.watcher = chokidar.watch(this.configPath, {
  awaitWriteFinish: {
    stabilityThreshold: 500,  // Wait 500ms after last change
    pollInterval: 100
  }
});
```

**Lazy Section Loading:**
```typescript
async getSection(section: ConfigSection): Promise<any> {
  const config = await this.get();
  return config[section];  // Only return needed section
}
```

**Buffered Writes:**
```typescript
private writeBuffer: Partial<AppConfig>[] = [];
private writeTimer: NodeJS.Timeout | null = null;

async save(updates: Partial<AppConfig>): Promise<void> {
  this.writeBuffer.push(updates);

  if (this.writeTimer) clearTimeout(this.writeTimer);

  this.writeTimer = setTimeout(async () => {
    const merged = this.writeBuffer.reduce((acc, update) =>
      this.merge(acc, update), {});
    this.writeBuffer = [];
    await this.atomicWrite(merged);
  }, 1000);
}
```

---

## Success Criteria

### Technical Metrics

1. **Zero Data Loss**: 100% successful migrations with backup
2. **Performance**: All operations meet target latency
3. **Reliability**: Hot-reload works without service interruption
4. **Test Coverage**: >90% unit, >80% integration
5. **Backward Compatibility**: .env continues working during transition

### User Experience Metrics

1. **Migration Time**: <5 minutes for typical user
2. **Setup Time**: <10 minutes for new users
3. **Documentation Clarity**: Users can self-migrate without support
4. **Error Recovery**: Clear messages, actionable fixes
5. **Feature Parity**: All existing functionality preserved

### Business Metrics

1. **Adoption Rate**: >80% migrate within 3 months
2. **Support Tickets**: <10% increase during transition
3. **User Satisfaction**: Positive feedback on unified config
4. **Development Velocity**: Faster feature development with unified system
5. **Bug Reports**: <5 critical bugs during rollout

### Validation Checkpoints

- **Week 2**: Core service implemented and validated
- **Week 4**: Backend integration complete and tested
- **Week 6**: Frontend integration complete, e2e tested
- **Week 8**: Documentation complete, ready for production release

---

## User Experience

### CLI Tools

```bash
# Interactive setup (first-time users)
$ npm run setup

# Validate configuration
$ npm run config:validate

# Migrate from .env
$ npm run migrate-config

# Backup management
$ npm run config:backup
$ npm run config:restore

# Export/import
$ npm run config:export
$ npm run config:import

# Reset to defaults
$ npm run config:reset

# Show current config (masked)
$ npm run config:show
```

### Interactive Setup Example

```bash
$ npm run setup

┌────────────────────────────────────────┐
│  MikroTik Dashboard - Configuration    │
└────────────────────────────────────────┘

No configuration found. Let's set up your dashboard.

[1/5] MikroTik Router Connection
  Host [192.168.88.1]: 192.168.1.1
  Port [8728]: 8728
  Username [admin]: admin
  Password: ********

[2/5] Server Settings
  Port [3000]: 3000
  CORS Origin [http://localhost:5173]:

[3/5] AI Assistant
  Provider (claude/lmstudio) [lmstudio]: lmstudio
  LM Studio Endpoint [http://localhost:1234]:
  Model: granite-4.0-h-tiny-Q4_K_M.gguf

[4/5] Terminal Settings
  Font Size [14]: 16
  Color Scheme (dark-orange/classic-green) [dark-orange]:

[5/5] Security
  Enable audit logging? [Y/n]: y

Configuration saved to config.json
Starting server...
```

### Migration UI

```
Settings Page:
┌────────────────────────────────────────────┐
│  [!] Configuration Update Available        │
│                                            │
│  Your settings are currently stored in     │
│  .env file. We recommend migrating to      │
│  the new config.json format for better     │
│  reliability and features.                 │
│                                            │
│  Benefits:                                 │
│  - Real-time sync across devices           │
│  - Backup and restore                      │
│  - No server restart needed                │
│  - Export/import configurations            │
│                                            │
│  [ Migrate Now ]  [ Learn More ]  [ Later ]│
└────────────────────────────────────────────┘
```

---

## Rollout Plan

### Pre-Release (Week 7)

1. **Internal Testing**
   - Deploy to staging environment
   - Full regression testing
   - Performance benchmarking
   - Security audit

2. **Beta Testing**
   - Select group of users
   - Gather feedback
   - Fix critical issues
   - Refine documentation

3. **Documentation Review**
   - Technical accuracy
   - Clarity and completeness
   - Example scenarios
   - Troubleshooting coverage

### Release (Week 8)

1. **Version 2.0.0 Release**
   - Unified config.json support
   - Migration tools
   - Updated documentation
   - Backward compatible with .env

2. **Communication**
   - Release notes
   - Migration guide
   - Blog post/announcement
   - Video tutorial (optional)

3. **Support Preparation**
   - FAQ document
   - Common issues guide
   - Support team training
   - Monitoring dashboards

### Post-Release (Week 9+)

1. **Monitoring**
   - Track adoption rate
   - Monitor error rates
   - Collect user feedback
   - Performance metrics

2. **Iteration**
   - Address user feedback
   - Fix discovered bugs
   - Improve documentation
   - Enhance UX

3. **Deprecation Timeline**
   - Month 1-3: .env fully supported with warnings
   - Month 4-6: .env deprecated, strong warnings
   - Month 7+: .env support removed

---

## Maintenance & Support

### Ongoing Maintenance

**Version Management:**
- Semantic versioning for config schema
- Migration paths between versions
- Breaking change documentation

**Backup Management:**
- Automatic cleanup of old backups (>30 days)
- Configurable retention policy
- Backup size monitoring

**Performance Monitoring:**
- Config operation latency tracking
- Hot-reload success rates
- API endpoint performance

### Support Resources

**Documentation:**
- Configuration guide
- Migration guide
- API reference
- Troubleshooting guide
- FAQ

**Tooling:**
- Config validator CLI
- Migration dry-run mode
- Backup/restore tools
- Export/import utilities

**Community:**
- GitHub discussions
- Issue templates
- Example configurations
- Best practices guide

---

## Conclusion

This roadmap provides a comprehensive plan to unify the fragmented configuration system in the MikroTik Dashboard project. The implementation is designed to be:

- **Safe**: Automatic backups, validation, and rollback capabilities
- **Gradual**: Backward compatible transition with clear deprecation timeline
- **User-Friendly**: Automated migration tools and clear documentation
- **Robust**: Schema validation, hot-reload, and error handling
- **Future-Proof**: Extensible architecture for future enhancements

**Key Benefits:**
- Single source of truth for all configuration
- No server restart needed for most changes
- Real-time sync across devices
- Backup and restore capabilities
- Better developer and user experience

**Next Steps:**
1. Review and approve this roadmap
2. Set up project tracking (GitHub issues/milestones)
3. Allocate resources for implementation
4. Begin Phase 1: Foundation development

**Estimated Timeline:** 8 weeks to production-ready release
**Estimated Effort:** 1-2 developers, part-time
**Risk Level:** Low (with proper testing and gradual rollout)

---

**Document History:**
- Version 1.0 (2025-01-27): Initial comprehensive roadmap

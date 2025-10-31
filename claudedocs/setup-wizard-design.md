# Setup Wizard Design

## Overview

First-run setup wizard to guide users through initial configuration of MikroTik Dashboard.

## Problem

Currently, users must:
1. Manually edit `server/config.json` with credentials
2. Understand config file structure
3. No validation until they try to use the app
4. Poor first-run experience with authentication errors

## Solution

Interactive setup wizard that:
1. Auto-detects unconfigured installation
2. Guides through configuration steps
3. Validates settings in real-time
4. Tests connections before saving
5. Provides clear error messages

## Wizard Flow

### Step 1: Welcome
- Brief intro to MikroTik Dashboard
- Requirements checklist:
  - MikroTik router with API access enabled
  - Admin credentials
  - (Optional) Claude API key or LMStudio endpoint
- Continue button

### Step 2: MikroTik Connection
**Form Fields:**
- Router IP/Hostname (default: 192.168.88.1)
- API Port (default: 8728)
- Username (default: admin)
- Password (secure input)
- Connection timeout (default: 10000ms)

**Validation:**
- IP format validation
- Port range (1-65535)
- Required fields check
- Test connection button

**Test Connection:**
- Attempt to connect with provided credentials
- Show success/error message
- Display router model and version on success

### Step 3: LLM Provider
**Provider Selection:**
- Radio buttons: Claude (Anthropic) or LMStudio
- Description of each option

**Claude Fields (if selected):**
- API Key (secure input)
- Model selection dropdown (default: claude-3-5-sonnet-20241022)

**LMStudio Fields (if selected):**
- Endpoint URL (default: http://localhost:1234/v1)
- Model name
- Context window size (default: 32768)

**Skip Option:**
- "Skip AI Setup" button
- Warning: AI assistant features will be disabled
- Can configure later in Settings

**Test Connection:**
- Validate API key / endpoint
- Test simple request
- Show success/error message

### Step 4: Review & Save
**Summary Display:**
- MikroTik: host, user (password hidden)
- LLM Provider: type, model/endpoint
- Connection status indicators

**Actions:**
- Back button (edit previous steps)
- Save & Continue button

**Save Process:**
1. Show loading spinner
2. POST config to `/api/setup/initialize`
3. Server validates and saves to config.json
4. Server restarts services with new config
5. Redirect to dashboard on success

## Technical Implementation

### Frontend

**New Page:**
- `src/pages/SetupWizardPage/SetupWizardPage.tsx`
- Multi-step wizard UI with progress indicator
- Form validation with error messages
- Connection testing with loading states

**Components:**
- `SetupWizardStep` - Individual step container
- `SetupProgress` - Progress indicator (1/4, 2/4, etc.)
- `ConnectionTest` - Test button with status display
- `SetupSummary` - Review configuration summary

**Routing:**
- Check on app load if setup needed
- Redirect to `/setup` if config is unconfigured
- Prevent access to other routes until setup complete
- Store setup completion flag in localStorage

### Backend

**Detection Logic:**
- `GET /api/setup/status` - Check if setup needed
- Return: `{ needsSetup: boolean, reason: string }`
- Criteria: default password, missing API key, failed connections

**Setup Endpoint:**
- `POST /api/setup/initialize`
- Body: `{ mikrotik: {...}, llm: {...} }`
- Validates all settings
- Tests connections
- Saves to config.json
- Returns: `{ success: boolean, errors?: string[] }`

**Test Endpoints:**
- `POST /api/setup/test-mikrotik` - Test MikroTik connection
- `POST /api/setup/test-llm` - Test LLM provider
- Both return connection status and details

### State Management

**Setup Context:**
```typescript
interface SetupState {
  step: number;
  mikrotik: MikroTikConfig;
  llm: LLMConfig;
  skipAI: boolean;
  errors: Record<string, string>;
}
```

**Form Validation:**
- Real-time validation on field blur
- Form-level validation on step navigation
- Connection testing before proceeding
- Error display with clear messaging

## UI Design

**Layout:**
- Centered wizard container (max-width: 800px)
- Progress bar at top
- Step content in center
- Navigation buttons at bottom (Back, Next/Test/Save)

**Styling:**
- Use existing design system tokens
- FormField and Input components
- Button variants (primary for Next, secondary for Back)
- Alert component for errors/success messages
- StatusBadge for connection status

**Accessibility:**
- Keyboard navigation (Tab, Enter, Escape)
- Focus management between steps
- ARIA labels for form fields
- Clear error announcements

## Security Considerations

1. **Password Handling:**
   - Never log passwords
   - Secure input fields (type="password")
   - POST over HTTPS in production

2. **Credential Storage:**
   - Server-side only (never in localStorage)
   - File permissions: 600 on config.json
   - No credentials in client state after save

3. **Validation:**
   - Server-side validation of all inputs
   - SQL injection protection
   - Path traversal prevention
   - Rate limiting on test endpoints

## User Experience

**First Run:**
1. User opens dashboard
2. Auto-redirected to setup wizard
3. Completes wizard steps
4. Config saved, services restart
5. Redirected to dashboard
6. Dashboard loads with working connections

**Subsequent Runs:**
1. Setup detection checks config
2. Valid config: load dashboard normally
3. Invalid config: show setup wizard with pre-filled values

**Error Recovery:**
1. Setup fails: stay on wizard, show errors
2. User can retry or go back to edit
3. Clear error messages with suggested fixes
4. Help text for common issues

## Implementation Phases

**Phase 1: Backend Setup Detection**
- Add `/api/setup/status` endpoint
- Implement config validation logic
- Create test connection endpoints
- Add setup completion tracking

**Phase 2: Basic Wizard UI**
- Create SetupWizardPage component
- Implement step navigation
- Add form fields with validation
- Basic styling with design system

**Phase 3: Connection Testing**
- Implement test connection buttons
- Add loading states and feedback
- Display connection results
- Error handling and retry logic

**Phase 4: Save & Integration**
- Create setup initialization endpoint
- Handle config save and restart
- Add routing protection
- Setup completion tracking

**Phase 5: Polish**
- Refine UI/UX
- Add help text and tooltips
- Improve error messages
- Add skip/later options
- Testing and bug fixes

## Files to Create/Modify

**New Files:**
- `src/pages/SetupWizardPage/SetupWizardPage.tsx`
- `src/pages/SetupWizardPage/SetupWizardPage.module.css`
- `src/components/organisms/SetupWizard/SetupWizard.tsx` (optional)
- `src/components/molecules/SetupStep/SetupStep.tsx` (optional)
- `server/src/routes/setup.ts`
- `server/src/services/setup.ts`

**Modified Files:**
- `src/App.tsx` - Add setup detection and routing
- `src/pages/index.ts` - Export SetupWizardPage
- `server/src/index.ts` - Register setup routes
- `server/src/services/config/unified-config.service.ts` - Add validation

## Next Steps

1. Get approval on wizard flow and design
2. Implement Phase 1 (Backend Setup Detection)
3. Build Phase 2 (Basic Wizard UI)
4. Add Phase 3 (Connection Testing)
5. Complete Phase 4 (Save & Integration)
6. Polish and test Phase 5

## Questions for User

1. Should we support .env file in addition to config.json?
2. Should we add a "Setup Later" option or force completion?
3. Should we validate router API is enabled during setup?
4. Should we show advanced settings or keep wizard simple?
5. Should we add a "Re-run Setup Wizard" option in Settings?

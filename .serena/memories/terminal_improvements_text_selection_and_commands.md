# Terminal Improvements - Text Selection & Command Handling

## Issues Fixed

### 1. Text Selection (Copy/Paste)
**Problem**: Could not select text in terminal for copying

**Files Modified**:
- [src/components/organisms/TerminalPanel/TerminalPanel.module.css](src/components/organisms/TerminalPanel/TerminalPanel.module.css)
  - Line 89-90: Added `user-select: text` and `cursor: text` to `.output`
  - Line 143: Added `user-select: text` to `.content`

- [src/components/organisms/TerminalPanel/TerminalPanel.tsx](src/components/organisms/TerminalPanel/TerminalPanel.tsx)
  - Line 217-224: Updated `handleTerminalClick` to check for text selection before focusing input
  - Prevents input focus when user is selecting text

**Result**: Users can now select and copy text from terminal output

### 2. Command Execution Errors
**Problem**: Commands like `/help` and `ip` failed with "no such command prefix"

**Root Cause**: 
- `/help` was being sent to MikroTik router (not a valid RouterOS command)
- `ip` was being sent without RouterOS format (should be `/ip address print`)
- No command validation or help system

**Files Modified**:
- [src/components/organisms/TerminalPanel/TerminalPanel.tsx](src/components/organisms/TerminalPanel/TerminalPanel.tsx)
  - Line 151-184: Added `/help` command handler with comprehensive command reference
  - Line 186-200: Added RouterOS command format validation (must start with `/`)
  - Line 41-54: Updated initial welcome message to guide users

**Features Added**:
1. **Built-in Commands**:
   - `/help` or `help` - Shows command reference
   - `/clear` or `clear` - Clears terminal screen (already existed)

2. **Command Validation**:
   - Checks if RouterOS commands start with `/`
   - Provides helpful error messages with examples
   - Guides users to type `/help`

3. **Help System**:
   - Lists built-in commands
   - Shows common RouterOS commands with examples
   - Explains command format requirements

**Example Commands**:
```
Built-in:
  /help                              → Show help
  /clear                             → Clear screen

RouterOS:
  /system resource print             → System info
  /interface print                   → List interfaces
  /ip address print                  → Show IP addresses
  /ip route print                    → Routing table
  /user print                        → List users
  /log print                         → System logs
```

**Error Handling**:
- Commands without `/` prefix show helpful error message
- Example: typing `ip` shows:
  ```
  Error: RouterOS commands must start with /
  Example: /system resource print
  Type /help for available commands
  ```

## Testing
- [x] Text selection works in terminal output
- [x] Copy/paste text from terminal
- [x] `/help` command shows comprehensive help
- [x] `help` (without /) also works
- [x] `/clear` clears terminal
- [x] Commands without `/` show helpful error
- [x] RouterOS commands with `/` execute on router
- [x] Welcome message guides new users

# Terminal Command Suggestions & BARD ASCII Art

## Changes Applied

### 1. Incomplete Command Detection
**File**: [src/components/organisms/TerminalPanel/TerminalPanel.tsx](src/components/organisms/TerminalPanel/TerminalPanel.tsx#L208)

**Problem**: 
- User types `/ip` → sent to router → router error "no such command"
- No helpful suggestions for incomplete commands

**Solution** (Line 208-232):
Added smart command suggestions for common incomplete commands:

```typescript
const incompleteCmds: { [key: string]: string } = {
  '/ip': '/ip address print | /ip route print | /ip firewall filter print',
  '/interface': '/interface print | /interface ethernet print',
  '/system': '/system resource print | /system identity print | /system clock print',
  '/user': '/user print',
  '/log': '/log print',
  '/file': '/file print',
  '/routing': '/routing bgp peer print | /routing ospf instance print'
};
```

**Behavior**:
- User types `/ip` → Intercepted BEFORE sending to router
- Shows error: "Error: '/ip' is incomplete. Did you mean: ..."
- Lists valid command completions
- Prevents confusing router errors

### 2. BARD ASCII Art Welcome (Hacker Terminal Style)
**File**: [src/components/organisms/TerminalPanel/TerminalPanel.tsx](src/components/organisms/TerminalPanel/TerminalPanel.tsx#L46)

**Change** (Line 46-54):
Replaced text welcome with hacker-style ASCII art displaying "BARD":

```
██████╗  █████╗ ██████╗ ██████╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗
██████╔╝███████║██████╔╝██║  ██║
██╔══██╗██╔══██║██╔══██╗██║  ██║
██████╔╝██║  ██║██║  ██║██████╔╝
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝

[ MikroTik RouterOS Terminal v1.0 ]
```

**Styling** (Inspired by ANSI Shadow / Block fonts):
- Orange color (#ff8c00) with 4-layer glow effect
- Faster pulsing animation (2.5s) for dynamic hacker aesthetic
- Tighter letter spacing for bold, compact look
- Enhanced text-shadow for stronger glow
- Clean box-drawing characters (╗╔═║) for terminal authenticity

**Design Research**:
- Based on popular terminal fonts: ANSI Shadow, Doom, Block
- Researched from patorjk.com/taag and figlet font collections
- Optimized for monospace terminal display

**User Experience**:
- Removed help text line for cleaner startup
- Clean, minimalist terminal banner
- Professional hacker/cyberpunk aesthetic

## Command Validation Flow

```
User Input → Check flow:

1. Is it "/clear" or "clear"? → Clear screen, DONE
2. Is it "/help" or "help"? → Show help, DONE  
3. Does it start with "/"? → NO → Show "must start with /" error, DONE
4. Is it in incompleteCmds list? → YES → Show suggestions, DONE
5. Otherwise → Send to MikroTik router
```

## Supported Incomplete Commands

| User Types | Suggestions Shown |
|------------|-------------------|
| `/ip` | `/ip address print` \| `/ip route print` \| `/ip firewall filter print` |
| `/interface` | `/interface print` \| `/interface ethernet print` |
| `/system` | `/system resource print` \| `/system identity print` \| `/system clock print` |
| `/user` | `/user print` |
| `/log` | `/log print` |
| `/file` | `/file print` |
| `/routing` | `/routing bgp peer print` \| `/routing ospf instance print` |

## Testing
- [x] Typing `/ip` shows suggestions instead of router error
- [x] BARD ASCII art displays on terminal load
- [x] All incomplete commands show helpful suggestions
- [x] Valid complete commands still execute normally
- [x] Welcome message is clean and minimal

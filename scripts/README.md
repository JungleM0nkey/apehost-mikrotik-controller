# Development Scripts

This directory contains utility scripts for the MikroTik Dashboard project.

## dev-with-cleanup.mjs

Smart development server startup script that automatically checks for and cleans up existing processes on the required ports before starting the dev servers.

### Features

- Checks for existing processes on ports 3000 (backend) and 5173 (frontend)
- Displays process information (PID and process name)
- Prompts for confirmation before killing processes
- Automatically starts both frontend and backend dev servers after cleanup
- Gracefully handles Ctrl+C shutdown

### Usage

Run the enhanced dev server with automatic cleanup:

```bash
npm run dev:full
```

This will:
1. Check if any processes are running on port 3000 (backend)
2. Check if any processes are running on port 5173 (frontend)
3. Display found processes and ask for confirmation to kill them
4. Kill the processes if you confirm (y/yes)
5. Start both frontend and backend dev servers using concurrently

### Alternative Commands

If you want to skip the cleanup check and start servers directly:

```bash
npm run dev:start
```

To start only the frontend:

```bash
npm run dev
```

To start only the backend:

```bash
npm run dev:backend
```

### How It Works

The script uses `lsof` to find processes listening on the specified ports and `kill -9` to terminate them if confirmed. If no processes are found on the ports, it proceeds directly to starting the dev servers.

### Requirements

- Linux/Unix-based system (uses `lsof` and `ps` commands)
- Node.js with ESM support
- Ports 3000 and 5173 available (or the script will help you free them up)

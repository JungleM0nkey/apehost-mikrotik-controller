#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import readline from 'readline';

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 3000;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function findProcessOnPort(port) {
  try {
    // Use lsof to find processes on the port (works on Linux/Mac)
    const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const pids = result.trim().split('\n').filter(Boolean);
    return pids;
  } catch (error) {
    // If lsof doesn't find anything, it exits with code 1
    return [];
  }
}

function getProcessInfo(pid) {
  try {
    const result = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return result.trim();
  } catch (error) {
    return 'Unknown';
  }
}

function killProcess(pid) {
  try {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer);
  }));
}

async function checkAndKillPort(port, name) {
  const pids = findProcessOnPort(port);

  if (pids.length === 0) {
    log('green', `[OK] No processes found on port ${port} (${name})`);
    return true;
  }

  log('yellow', `\n[WARNING] Found ${pids.length} process(es) on port ${port} (${name}):`);

  for (const pid of pids) {
    const processName = getProcessInfo(pid);
    log('yellow', `  PID: ${pid} - ${processName}`);
  }

  const answer = await askQuestion(`\nKill these process(es)? (y/n): `);

  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    let allKilled = true;
    for (const pid of pids) {
      if (killProcess(pid)) {
        log('green', `  Killed PID ${pid}`);
      } else {
        log('red', `  Failed to kill PID ${pid}`);
        allKilled = false;
      }
    }

    if (allKilled) {
      log('green', `[OK] All processes killed on port ${port}`);
      return true;
    } else {
      log('red', `[ERROR] Some processes could not be killed on port ${port}`);
      return false;
    }
  } else {
    log('red', `[CANCELLED] Not killing processes on port ${port}. Exiting...`);
    return false;
  }
}

async function main() {
  log('cyan', '\n========================================');
  log('cyan', ' MikroTik Dashboard - Dev Server Cleanup');
  log('cyan', '========================================\n');

  log('blue', 'Checking for existing servers...\n');

  // Check frontend port
  const frontendOk = await checkAndKillPort(FRONTEND_PORT, 'Frontend');
  if (!frontendOk) {
    process.exit(1);
  }

  // Check backend port
  const backendOk = await checkAndKillPort(BACKEND_PORT, 'Backend');
  if (!backendOk) {
    process.exit(1);
  }

  log('green', '\n[OK] All ports are clear. Starting dev servers...\n');
  log('cyan', '========================================\n');

  // Start dev servers using npm run dev:start
  const devProcess = spawn('npm', ['run', 'dev:start'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });

  devProcess.on('error', (error) => {
    log('red', `Failed to start dev servers: ${error.message}`);
    process.exit(1);
  });

  devProcess.on('exit', (code) => {
    if (code !== 0) {
      log('red', `Dev servers exited with code ${code}`);
    }
    process.exit(code);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    log('yellow', '\n\nShutting down dev servers...');
    devProcess.kill('SIGINT');
  });
}

main().catch(error => {
  log('red', `Error: ${error.message}`);
  process.exit(1);
});

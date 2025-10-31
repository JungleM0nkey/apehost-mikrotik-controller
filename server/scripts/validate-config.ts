#!/usr/bin/env node
/**
 * Configuration Validation CLI
 *
 * Validates config.json against schema
 * Usage: npm run validate-config [path]
 */

import fs from 'fs/promises';
import path from 'path';
import { validateConfig } from '../src/services/config/config.validator.js';

async function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || path.join(process.cwd(), 'config.json');

  console.log('=== Configuration Validation Tool ===\n');
  console.log(`Validating: ${configPath}\n`);

  try {
    // Read configuration file
    const content = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(content);

    // Validate
    const result = validateConfig(config);

    if (result.valid) {
      console.log('[OK] Configuration is valid\n');
      console.log('Configuration Summary:');
      console.log(`- Version: ${config.version}`);
      console.log(`- Server Port: ${config.server.port}`);
      console.log(`- Server Environment: ${config.server.nodeEnv}`);
      console.log(`- MikroTik Host: ${config.mikrotik.host}`);
      console.log(`- MikroTik Port: ${config.mikrotik.port}`);
      console.log(`- LLM Provider: ${config.llm.provider}`);

      if (config.llm.provider === 'claude') {
        console.log(`- Claude Model: ${config.llm.anthropic.model}`);
      } else {
        console.log(`- LM Studio Endpoint: ${config.llm.lmstudio.endpoint}`);
        console.log(`- LM Studio Model: ${config.llm.lmstudio.model}`);
      }

      console.log('');
      process.exit(0);
    } else {
      console.log('[FAILED] Configuration validation failed:\n');
      result.errors.forEach(err => console.log(`  - ${err}`));
      console.log('');
      process.exit(1);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error('[ERROR] Configuration file not found:', configPath);
    } else if (error instanceof SyntaxError) {
      console.error('[ERROR] Invalid JSON:', error.message);
    } else {
      console.error('[ERROR] Validation failed:', error.message);
    }
    process.exit(1);
  }
}

main();

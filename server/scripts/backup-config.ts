#!/usr/bin/env node
/**
 * Configuration Backup CLI
 *
 * Creates a manual backup of config.json
 * Usage: npm run backup-config [description]
 */

import { ConfigBackup } from '../src/services/config/config.backup.js';

async function main() {
  const args = process.argv.slice(2);
  const description = args.join(' ') || 'Manual backup';

  console.log('=== Configuration Backup Tool ===\n');

  try {
    const backup = new ConfigBackup();

    console.log('Creating backup...');
    const result = await backup.createBackup({
      description,
      createdBy: 'manual',
    });

    console.log('\n[OK] Backup created successfully\n');
    console.log('Backup Details:');
    console.log(`- ID: ${result.id}`);
    console.log(`- Path: ${result.path}`);
    console.log(`- Size: ${(result.size / 1024).toFixed(2)} KB`);
    console.log(`- Created: ${result.created.toISOString()}`);
    console.log(`- Description: ${result.metadata.description}`);
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('\n[ERROR] Backup failed:', error.message);
    process.exit(1);
  }
}

main();

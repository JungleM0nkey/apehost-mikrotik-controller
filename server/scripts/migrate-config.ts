#!/usr/bin/env node
/**
 * Configuration Migration CLI
 *
 * Migrates from .env files to config.json format
 * Usage: npm run migrate-config [options]
 */

import { ConfigMigrator } from '../src/services/config/config.migrator.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const noBackup = args.includes('--no-backup');

  console.log('=== Configuration Migration Tool ===\n');

  if (dryRun) {
    console.log('[DRY RUN MODE] - No files will be modified\n');
  }

  try {
    const migrator = new ConfigMigrator();

    console.log('Starting migration...');
    console.log('- Source: .env and server/.env');
    console.log('- Target: config.json\n');

    const result = await migrator.migrate({
      dryRun,
      createBackup: !noBackup,
    });

    // Generate and display report
    const report = await migrator.generateReport(result);
    console.log(report);

    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n[ERROR] Migration failed:', error.message);
    process.exit(1);
  }
}

main();

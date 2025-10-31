#!/usr/bin/env node
/**
 * Configuration Backup List CLI
 *
 * Lists all available configuration backups
 * Usage: npm run list-backups [--detailed]
 */

import { ConfigBackup } from '../src/services/config/config.backup.js';

async function main() {
  const args = process.argv.slice(2);
  const detailed = args.includes('--detailed') || args.includes('-d');

  console.log('=== Configuration Backups ===\n');

  try {
    const backup = new ConfigBackup();

    // Get statistics
    const stats = await backup.getStats();
    console.log('Statistics:');
    console.log(`- Total Backups: ${stats.totalBackups}`);
    console.log(`- Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    if (stats.newestBackup) {
      console.log(`- Newest: ${stats.newestBackup.toISOString()}`);
    }
    if (stats.oldestBackup) {
      console.log(`- Oldest: ${stats.oldestBackup.toISOString()}`);
    }
    console.log('');

    // List backups
    const backups = await backup.listBackups();

    if (backups.length === 0) {
      console.log('No backups found.\n');
      process.exit(0);
    }

    console.log('Available Backups:\n');

    for (const b of backups) {
      console.log(`ID: ${b.id}`);
      console.log(`  Created: ${b.created.toISOString()}`);
      console.log(`  Size: ${(b.size / 1024).toFixed(2)} KB`);
      console.log(`  Version: ${b.metadata.version}`);
      console.log(`  Created By: ${b.metadata.createdBy}`);

      if (b.metadata.description) {
        console.log(`  Description: ${b.metadata.description}`);
      }

      if (detailed) {
        console.log(`  Path: ${b.path}`);

        // Verify backup integrity
        const verification = await backup.verifyBackup(b.id);
        if (verification.valid) {
          console.log(`  Status: Valid`);
        } else {
          console.log(`  Status: Invalid`);
          verification.errors.forEach(err => console.log(`    - ${err}`));
        }
      }

      console.log('');
    }

    console.log(`Total: ${backups.length} backup(s)\n`);
    console.log('To restore a backup, run: npm run restore-config <backup-id>\n');

    process.exit(0);
  } catch (error: any) {
    console.error('[ERROR] Failed to list backups:', error.message);
    process.exit(1);
  }
}

main();

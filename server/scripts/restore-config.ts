#!/usr/bin/env node
/**
 * Configuration Restore CLI
 *
 * Restores config.json from a backup
 * Usage: npm run restore-config <backup-id>
 */

import { ConfigBackup } from '../src/services/config/config.backup.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('=== Configuration Restore Tool ===\n');
    console.log('Usage: npm run restore-config <backup-id>');
    console.log('\nTo list available backups, run: npm run list-backups\n');
    process.exit(1);
  }

  const backupId = args[0];
  const noVerify = args.includes('--no-verify');
  const noBackup = args.includes('--no-backup');

  console.log('=== Configuration Restore Tool ===\n');
  console.log(`Restoring from: ${backupId}\n`);

  try {
    const backup = new ConfigBackup();

    // Get backup info
    const backupInfo = await backup.getBackup(backupId);
    if (!backupInfo) {
      console.error('[ERROR] Backup not found:', backupId);
      console.log('\nTo list available backups, run: npm run list-backups\n');
      process.exit(1);
    }

    console.log('Backup Details:');
    console.log(`- Created: ${backupInfo.created.toISOString()}`);
    console.log(`- Version: ${backupInfo.metadata.version}`);
    console.log(`- Description: ${backupInfo.metadata.description || 'No description'}`);
    console.log('');

    // Restore
    console.log('Restoring configuration...');
    await backup.restoreBackup(backupId, {
      verify: !noVerify,
      createBackup: !noBackup,
    });

    console.log('\n[OK] Configuration restored successfully\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n[ERROR] Restore failed:', error.message);
    process.exit(1);
  }
}

main();

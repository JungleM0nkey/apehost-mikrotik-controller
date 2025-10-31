# Security Cleanup Guide

This document explains how to remove sensitive data from git history.

## What Was Removed

The following sensitive files have been removed from git tracking:
- `server/data/*.db` - SQLite database files containing application data
- `server/data/*.db-shm` - SQLite shared memory files
- `server/data/*.db-wal` - SQLite write-ahead log files

These files are now in `.gitignore` and won't be tracked going forward.

## Current Status

**IMPORTANT**: These files still exist in git history. They are no longer tracked for new commits, but old commits still contain them.

## Clean Git History (Optional but Recommended)

To completely remove these files from git history, you have two options:

### Option 1: Using BFG Repo Cleaner (Recommended - Faster)

1. Download BFG Repo Cleaner:
   ```bash
   wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
   ```

2. Create a backup:
   ```bash
   git clone --mirror . ../mikrotik-dashboard-backup.git
   ```

3. Run BFG to remove database files:
   ```bash
   java -jar bfg-1.14.0.jar --delete-files "*.db" .
   java -jar bfg-1.14.0.jar --delete-files "*.db-shm" .
   java -jar bfg-1.14.0.jar --delete-files "*.db-wal" .
   ```

4. Clean up and force push:
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force --all
   git push --force --tags
   ```

### Option 2: Using git-filter-repo (More Powerful)

1. Install git-filter-repo:
   ```bash
   pip3 install git-filter-repo
   ```

2. Create a backup:
   ```bash
   git clone . ../mikrotik-dashboard-backup
   ```

3. Remove files from history:
   ```bash
   git filter-repo --path server/data/agent.db --invert-paths
   git filter-repo --path server/data/wireguard.db --invert-paths
   git filter-repo --path-glob '*.db-shm' --invert-paths
   git filter-repo --path-glob '*.db-wal' --invert-paths
   ```

4. Force push:
   ```bash
   git remote add origin <your-remote-url>
   git push --force --all
   git push --force --tags
   ```

### Option 3: Start Fresh (Nuclear Option)

If you want a completely clean start:

1. Create a new repository
2. Copy only the source files (not .git directory)
3. Initialize fresh git repo
4. Make initial commit

## Verification

After cleaning, verify the files are gone from history:

```bash
git log --all --full-history --source -- "*.db"
```

This should return no results if cleanup was successful.

## Important Notes

1. **Force push affects collaborators**: Anyone who has cloned the repo will need to re-clone
2. **Backup first**: Always create a backup before rewriting history
3. **Coordinate with team**: If others are working on the repo, coordinate the history rewrite
4. **GitHub/GitLab cache**: These platforms may cache old commits for ~24 hours

## What's Protected Now

The updated `.gitignore` now excludes:
- Database files (*.db, *.sqlite, etc.)
- Database auxiliary files (*.db-shm, *.db-wal)
- Data directories (server/data/, data/, backups/)
- Environment files (.env, .env.local, etc.)
- Configuration files (config.json)
- Sensitive files (*.key, *.pem, *secret*, *credential*)

## Going Forward

1. Database files remain on disk but aren't tracked
2. Each developer should have their own local database
3. Use `.env.example` and `config.json.example` for templates
4. Never commit actual credentials or sensitive data

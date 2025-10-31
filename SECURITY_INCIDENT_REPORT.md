# Security Incident Report - Database Files in Git History

**Date:** October 31, 2025
**Severity:** MEDIUM (Mitigated)
**Status:** RESOLVED
**Reporter:** Automated Security Audit

## Executive Summary

Database files (*.db, *.db-shm, *.db-wal) were accidentally committed and pushed to the public GitHub repository, exposing them in git history across 9 commits. The issue has been fully remediated through git history rewriting and force push.

## Timeline

- **Unknown Date:** Database files first committed to repository
- **October 31, 2025 16:55:** Issue identified during security sweep
- **October 31, 2025 16:55:** Database content analyzed (found to be empty)
- **October 31, 2025 16:56:** Full backup created
- **October 31, 2025 16:57:** git-filter-repo installed
- **October 31, 2025 16:57:** Git history cleaned using git-filter-repo
- **October 31, 2025 16:58:** Clean history force-pushed to GitHub
- **October 31, 2025 16:58:** Issue resolved and documented

## Affected Components

### Files Exposed in Git History
- `server/data/agent.db` - AI agent operational database
- `server/data/agent.db-shm` - SQLite shared memory file
- `server/data/agent.db-wal` - SQLite write-ahead log
- `server/data/wireguard.db` - WireGuard VPN configuration database
- `server/data/wireguard.db-shm` - SQLite shared memory file
- `server/data/wireguard.db-wal` - SQLite write-ahead log

### Repository Information
- **Repository:** github.com/JungleM0nkey/apehost-mikrotik-controller (formerly apehost-mikrotik-bard)
- **Visibility:** Public
- **Commits Affected:** 9 commits containing database files
- **Total Commits:** 32 (in repository at time of cleanup)

## Data Exposure Assessment

### Severity Analysis: MEDIUM (Reduced to LOW after verification)

**Initial Concern:**
- AI agent database could contain user queries, system commands, or troubleshooting sessions
- WireGuard database could contain VPN configurations, peer keys, or connection logs
- Potential exposure of internal network architecture

**Actual Impact:**
- ✅ All database tables confirmed EMPTY (0 rows in all tables)
- ✅ No user data exposed
- ✅ No credentials exposed
- ✅ No VPN keys exposed
- ✅ No internal network information exposed

**Database Tables Analyzed:**

agent.db:
- issues (0 rows)
- metrics_snapshots (0 rows)
- detection_history (0 rows)
- migrations (0 rows)
- issue_feedback (0 rows)
- detection_evidence (0 rows)
- false_positive_patterns (0 rows)
- improvement_rules (0 rows)
- learning_metrics (0 rows)
- troubleshooting_sessions (0 rows)
- session_steps (0 rows)
- system_metrics_history (0 rows)

wireguard.db:
- wireguard_interface (0 rows)
- wireguard_peers (0 rows)
- wireguard_connection_history (0 rows)

### Risk Assessment

**Actual Risk:** LOW
- No sensitive data was exposed (databases were empty)
- Only database structure/schema was visible
- No credentials or keys compromised

**Potential Risk (if databases had data):** HIGH
- User queries could reveal internal infrastructure details
- VPN configurations could expose network topology
- Connection logs could reveal access patterns

## Remediation Actions Taken

### 1. Immediate Response
- ✅ Conducted security audit to identify all sensitive files
- ✅ Verified database contents (confirmed empty)
- ✅ Created full repository backup before any changes

### 2. Git History Cleanup
- ✅ Installed git-filter-repo tool
- ✅ Removed all *.db, *.db-shm, *.db-wal files from entire git history
- ✅ Repacked and optimized repository
- ✅ Force-pushed cleaned history to GitHub

### 3. Prevention Measures
- ✅ Updated .gitignore with comprehensive patterns:
  - Database files: *.db, *.sqlite, *.db-shm, *.db-wal
  - Data directories: server/data/, data/, backups/
  - Sensitive files: *.key, *.pem, *secret*, *credential*
- ✅ Fixed file permissions (600) on .env and config.json
- ✅ Created security-audit.sh script for ongoing monitoring
- ✅ Created SECURITY_CLEANUP.md with cleanup procedures

### 4. Verification
- ✅ Confirmed no database files in current git tracking
- ✅ Confirmed no database files in git history
- ✅ Confirmed proper .gitignore coverage
- ✅ Verified force push succeeded on GitHub

## Technical Details

### Cleanup Method: git-filter-repo

**Command Used:**
```bash
git filter-repo --path-glob '*.db' --path-glob '*.db-shm' --path-glob '*.db-wal' --invert-paths --force
```

**Results:**
- Parsed 32 commits in 0.11 seconds
- Repacked repository in 0.45 seconds
- Total cleanup time: 0.56 seconds
- Repository size reduced

**Backup Location:**
```
/home/m0nkey/mikrotik-dashboard-backup.git (mirror)
```

## Lessons Learned

### What Went Wrong
1. Database files were not in .gitignore from project inception
2. No pre-commit hooks to prevent sensitive file commits
3. No security audit performed before making repository public

### What Went Right
1. Databases were empty - no actual data exposure
2. Issue detected and remediated quickly
3. Comprehensive cleanup performed properly
4. Good documentation created for future reference

## Prevention Measures Going Forward

### Implemented
1. ✅ Comprehensive .gitignore patterns
2. ✅ Automated security audit script (security-audit.sh)
3. ✅ Security cleanup documentation (SECURITY_CLEANUP.md)
4. ✅ Incident report for team awareness

### Recommended (Future Enhancements)
1. ⏭️ Pre-commit git hooks to scan for sensitive files
2. ⏭️ Automated security scanning in CI/CD pipeline
3. ⏭️ Secret scanning with tools like gitleaks or truffleHog
4. ⏭️ Regular security audits (monthly)
5. ⏭️ Developer training on secure git practices

## Action Items

- [x] Remove database files from git tracking
- [x] Clean git history completely
- [x] Force push to GitHub
- [x] Update .gitignore
- [x] Fix file permissions
- [x] Create security audit script
- [x] Create incident report
- [x] Update documentation
- [ ] Consider implementing pre-commit hooks
- [ ] Consider GitHub secret scanning
- [ ] Schedule quarterly security reviews

## Verification Steps for Team

If you have an old clone of this repository:

1. **Check your local history:**
   ```bash
   git log --all --full-history --source -- "*.db"
   ```
   If this shows results, you have old history.

2. **Update to clean history:**
   ```bash
   # Save any uncommitted work
   git stash

   # Fetch clean history
   git fetch origin --force

   # Reset to clean history
   git reset --hard origin/main

   # Restore your work
   git stash pop
   ```

3. **Verify cleanup:**
   ```bash
   git log --all --full-history --source -- "*.db"
   ```
   Should return no results.

## Contact

For questions about this incident or security concerns:
- Run: `./scripts/security-audit.sh` for automated checks
- Review: `SECURITY_CLEANUP.md` for cleanup procedures
- Review: `.gitignore` for current protections

## References

- Git Filter-Repo: https://github.com/newren/git-filter-repo
- GitHub: Removing sensitive data from a repository
- OWASP: Secure Coding Practices

---

**Report Generated:** October 31, 2025
**Last Updated:** October 31, 2025
**Status:** Incident Closed - Monitoring Ongoing

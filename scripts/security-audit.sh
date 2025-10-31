#!/bin/bash
# Security Audit Script for MikroTik Dashboard
# This script checks for potential security issues and sensitive data

set -e

echo "========================================="
echo "MikroTik Dashboard Security Audit"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check for sensitive files in git tracking
echo "1. Checking for sensitive files in git tracking..."
SENSITIVE_FILES=$(git ls-files | grep -E "(\.env$|\.db$|\.key$|\.pem$|secret|credential)" | grep -v ".env.example" | grep -v "weak-password-policy.ts" || true)
if [ -n "$SENSITIVE_FILES" ]; then
    echo -e "${RED}[FAIL]${NC} Found sensitive files in git:"
    echo "$SENSITIVE_FILES"
else
    echo -e "${GREEN}[PASS]${NC} No sensitive files in git tracking"
fi
echo ""

# Check for database files
echo "2. Checking for database files..."
DB_FILES=$(find . -type f \( -name "*.db" -o -name "*.sqlite" \) | grep -v node_modules | grep -v ".git" || true)
if [ -n "$DB_FILES" ]; then
    echo -e "${YELLOW}[INFO]${NC} Database files found (should be in .gitignore):"
    echo "$DB_FILES"

    # Check if they're in .gitignore
    for file in $DB_FILES; do
        if git check-ignore -q "$file"; then
            echo -e "${GREEN}  ✓${NC} $file is in .gitignore"
        else
            echo -e "${RED}  ✗${NC} $file is NOT in .gitignore"
        fi
    done
else
    echo -e "${GREEN}[PASS]${NC} No database files found"
fi
echo ""

# Check for .env files
echo "3. Checking for environment files..."
ENV_FILES=$(find . -type f -name ".env*" | grep -v node_modules | grep -v ".git" || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${YELLOW}[INFO]${NC} Environment files found:"
    for file in $ENV_FILES; do
        if git check-ignore -q "$file" || basename "$file" | grep -q "example"; then
            echo -e "${GREEN}  ✓${NC} $file (ignored or example)"
        else
            echo -e "${RED}  ✗${NC} $file (NOT ignored - potential leak)"
        fi
    done
else
    echo -e "${GREEN}[PASS]${NC} No environment files found"
fi
echo ""

# Check for hardcoded credentials
echo "4. Checking for hardcoded credentials in source files..."
CRED_MATCHES=$(grep -r "password\s*=\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . | grep -v "your_password_here" | grep -v "PASSWORD" || true)
if [ -n "$CRED_MATCHES" ]; then
    echo -e "${RED}[WARN]${NC} Possible hardcoded credentials found:"
    echo "$CRED_MATCHES" | head -5
else
    echo -e "${GREEN}[PASS]${NC} No hardcoded credentials detected"
fi
echo ""

# Check for API keys
echo "5. Checking for API keys in source files..."
API_MATCHES=$(grep -r "api[_-]key\s*=\s*['\"][^'\"]*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . | grep -v "your.*api.*key" | grep -v "API_KEY" || true)
if [ -n "$API_MATCHES" ]; then
    echo -e "${RED}[WARN]${NC} Possible hardcoded API keys found:"
    echo "$API_MATCHES" | head -5
else
    echo -e "${GREEN}[PASS]${NC} No hardcoded API keys detected"
fi
echo ""

# Check git history for sensitive files
echo "6. Checking git history for sensitive files..."
HISTORY_SENSITIVE=$(git log --all --full-history --source -- "*.db" "*.env" "*.key" "*.pem" 2>/dev/null | grep "commit" | wc -l || true)
if [ "$HISTORY_SENSITIVE" -gt 0 ]; then
    echo -e "${RED}[WARN]${NC} Found $HISTORY_SENSITIVE commits with sensitive files in history"
    echo "         Run: git log --all --full-history --source -- \"*.db\" \"*.env\""
    echo "         Consider using BFG Repo Cleaner or git-filter-repo to clean history"
else
    echo -e "${GREEN}[PASS]${NC} No sensitive files in git history"
fi
echo ""

# Check .gitignore coverage
echo "7. Checking .gitignore coverage..."
REQUIRED_PATTERNS=(
    "*.db"
    ".env"
    "*.key"
    "*.pem"
    "config.json"
    "node_modules"
)

for pattern in "${REQUIRED_PATTERNS[@]}"; do
    if grep -q "^${pattern}\|^${pattern}/" .gitignore; then
        echo -e "${GREEN}  ✓${NC} $pattern"
    else
        echo -e "${RED}  ✗${NC} $pattern (missing)"
    fi
done
echo ""

# Check for world-readable sensitive files
echo "8. Checking file permissions..."
SENSITIVE_PERMS=$(find . -type f \( -name "*.env" -o -name "*.key" -o -name "*.pem" -o -name "config.json" \) -perm /o=r | grep -v node_modules | grep -v ".git" || true)
if [ -n "$SENSITIVE_PERMS" ]; then
    echo -e "${YELLOW}[WARN]${NC} Sensitive files with world-readable permissions:"
    echo "$SENSITIVE_PERMS"
    echo "         Consider: chmod 600 <file>"
else
    echo -e "${GREEN}[PASS]${NC} No world-readable sensitive files"
fi
echo ""

echo "========================================="
echo "Audit Complete"
echo "========================================="
echo ""
echo "Recommendations:"
echo "1. Review any [FAIL] or [WARN] items above"
echo "2. If sensitive files are in git history, see SECURITY_CLEANUP.md"
echo "3. Ensure .env and config.json have proper permissions (600)"
echo "4. Never commit real credentials or API keys"
echo "5. Use .env.example and config.json.example for templates"
echo ""

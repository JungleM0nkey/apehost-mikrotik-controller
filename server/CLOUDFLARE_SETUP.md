# Cloudflare Workers AI Setup Guide

## Overview

This guide helps you configure Cloudflare Workers AI as your LLM provider for the MikroTik Dashboard assistant.

## Prerequisites

- Active Cloudflare account
- Cloudflare Workers AI enabled (free tier available)

## Step 1: Get Your Account ID

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to any page in your account
3. Your Account ID is visible in the URL: `cloudflare.com/{ACCOUNT_ID}/...`
4. Alternatively, find it in the Account Home sidebar (right side)

Example Account ID format: `75cd0cccea4f31243ca6938211b5574d` (32 hexadecimal characters)

## Step 2: Create API Token

### Required Permissions

Your API token needs Workers AI access:

1. Go to: **Profile → API Tokens → Create Token**
2. Choose one of these options:

   **Option A: Use Template (Recommended)**
   - Click "Use template" on "Edit Cloudflare Workers"
   - This includes Workers AI permissions

   **Option B: Custom Token**
   - Click "Create Custom Token"
   - **Permissions**:
     - Account → Workers AI → Read (minimum)
     - Account → Workers AI → Edit (for full access)
   - **Account Resources**:
     - Include → Specific account → Select your account
   - **Zone Resources**: Not required for Workers AI

3. Click "Continue to summary"
4. Click "Create Token"
5. **IMPORTANT**: Copy the token immediately - it's only shown once!

Example token format: `IcP5kQfEUxOo22RrEchbRbpxH_WCwyDXuppG1foQ`

## Step 3: Configure Application

You have two options for storing credentials:

### Option A: Environment Variables (Recommended)

Create or edit `server/.env`:

```bash
# Cloudflare Workers AI Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_AI_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct

# Optional: AI Gateway for caching/analytics
# CLOUDFLARE_AI_GATEWAY=my-gateway-name

# Set Cloudflare as active provider
LLM_PROVIDER=cloudflare
```

**Security Benefits**:
- Credentials not stored in version control
- Easy to rotate without modifying config files
- Environment-specific configuration

### Option B: config.json

Edit `config.json` in the project root:

```json
{
  "llm": {
    "provider": "cloudflare",
    "cloudflare": {
      "accountId": "your_account_id_here",
      "apiToken": "your_api_token_here",
      "model": "@cf/meta/llama-4-scout-17b-16e-instruct"
    }
  }
}
```

**Note**: config.json has 600 permissions (owner read/write only) for security.

## Step 4: Restart Server

After updating credentials:

```bash
cd server
npm run dev
```

The server will reload configuration automatically.

## Step 5: Test Configuration

1. Open the dashboard at http://localhost:5173
2. Navigate to the Assistant panel
3. Send a test message: "Hello, can you help me?"
4. You should receive a response from Cloudflare Workers AI

## Troubleshooting

### Error: "Invalid Cloudflare API token"

**Symptoms**: Error code 10000 - Authentication error

**Causes**:
- Token is expired or revoked
- Token lacks Workers AI permissions
- Account ID doesn't match token's account

**Solutions**:
1. Generate a new API token following Step 2
2. Verify the token has Workers AI permissions
3. Confirm Account ID matches your Cloudflare account
4. Check token hasn't been revoked in Cloudflare Dashboard

### Error: "Cloudflare Account ID and API Token are required"

**Causes**:
- Missing credentials in both config.json and .env
- Environment variables not loaded

**Solutions**:
1. Add credentials using Option A or Option B from Step 3
2. Verify .env file is in `server/` directory (not project root)
3. Restart server after adding credentials

### Error: Rate limit exceeded

**Symptoms**: Error 429 - "300 requests/min limit exceeded"

**Solutions**:
1. Wait 60 seconds before retrying
2. Consider setting up an AI Gateway for caching:
   ```bash
   CLOUDFLARE_AI_GATEWAY=my-gateway-name
   ```
3. AI Gateway provides:
   - Response caching (reduces API calls)
   - Rate limiting per-user
   - Analytics and monitoring

### Slow Responses

**Possible Causes**:
- Cold start (first request after idle period)
- Model loading time
- Network latency

**Solutions**:
1. First request may take 2-3 seconds (normal)
2. Subsequent requests should be faster
3. Use AI Gateway for response caching
4. Consider Cloudflare Enterprise for dedicated capacity

## Model Information

### Default Model: Llama 4 Scout 17B

- **Context Window**: 131,072 tokens (~100K words)
- **Capabilities**:
  - Function calling (tool use)
  - Streaming responses
  - Multi-turn conversations
- **Cost**: ~93% cheaper than Claude
- **Performance**: Optimized for instruction following

### Alternative Models

You can use other Cloudflare AI models by setting:

```bash
# In .env
CLOUDFLARE_AI_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct

# Or in config.json
"model": "@cf/meta/llama-4-scout-17b-16e-instruct"
```

Available models: See [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/models/)

## AI Gateway Setup (Optional)

AI Gateway provides caching, rate limiting, and analytics:

1. Go to Cloudflare Dashboard → AI → AI Gateway
2. Click "Create Gateway"
3. Name your gateway (e.g., "mikrotik-dashboard")
4. Add gateway name to configuration:
   ```bash
   CLOUDFLARE_AI_GATEWAY=mikrotik-dashboard
   ```

**Benefits**:
- Cache identical requests (reduces costs)
- Per-user rate limiting
- Analytics dashboard
- Request/response logging

## Security Best Practices

1. **Use Environment Variables**: Store credentials in .env, not config.json
2. **Rotate Tokens Regularly**: Generate new tokens every 90 days
3. **Minimum Permissions**: Use "Workers AI Read" if you only need inference
4. **Monitor Usage**: Check Cloudflare Dashboard for unusual activity
5. **Secure .env**: Never commit .env to version control (already in .gitignore)

## API Token Permissions Reference

| Permission | Access Level | Use Case |
|------------|--------------|----------|
| Workers AI Read | Read only | Running inference only |
| Workers AI Edit | Read + Write | Full access (recommended) |

## Configuration Priority

Credentials are loaded in this order (later overrides earlier):

1. Default configuration (empty credentials)
2. config.json
3. Environment variables (.env)

**Recommendation**: Use .env for credentials, config.json for other settings.

## Support

If you continue to have issues:

1. Check server logs: `server/logs/` or console output
2. Verify credentials in Cloudflare Dashboard
3. Test API token with curl:
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct" \
     -H "Authorization: Bearer {API_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"test"}],"max_tokens":10,"stream":false}'
   ```
4. Expected success response: `{"result":{"response":"..."},"success":true,...}`

## Additional Resources

- [Cloudflare Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [API Token Management](https://dash.cloudflare.com/profile/api-tokens)
- [AI Gateway Guide](https://developers.cloudflare.com/ai-gateway/)

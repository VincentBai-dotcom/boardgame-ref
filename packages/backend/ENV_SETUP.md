# Environment Configuration Guide

This project uses multiple environment files for different development scenarios.

## Available Environments

### 1. `.env.local` - Local Development (Default)

**Server only accessible from your desktop (127.0.0.1)**

Use when:

- Developing on your desktop
- Only need admin console access
- Don't need mobile device testing

```bash
bun dev
```

Server accessible at: `http://localhost:3000`

---

### 2. `.env.mobile` - Mobile Testing

**Server accessible from local network (0.0.0.0)**

Use when:

- Testing mobile app on physical device
- Need to access server from other devices on same WiFi

```bash
bun dev:mobile
```

Server accessible at:

- Desktop: `http://localhost:3000`
- Mobile: `http://REDACTED_IP:3000` (use your actual desktop IP)

**Important:**

- Both devices must be on the same WiFi network
- Update CORS_ORIGINS in `.env.mobile` if your IP changes
- For iOS, add App Transport Security exception (see below)

---

### 3. `.env.production` - Production

**Production environment configuration**

```bash
bun start
```

**⚠️ Before deploying to production:**

1. Update `CORS_ORIGINS` with actual domains
2. Update `POSTGRES_URL` with production database
3. Generate new JWT secrets: `openssl rand -hex 64`
4. Use production OpenAI API key

---

## Setup Instructions

### First Time Setup

1. Copy `.env.example` to create your environment files:

```bash
cd packages/backend
cp .env.example .env.local
cp .env.example .env.mobile
cp .env.example .env.production
```

2. Update each file with appropriate values:

**`.env.local`:**

```bash
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:5173
```

**`.env.mobile`:**

```bash
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:5173
```

**`.env.production`:**

```bash
NODE_ENV=production
HOST=0.0.0.0
CORS_ORIGINS=https://yourdomain.com
POSTGRES_URL=postgres://user:password@production-host:5432/boardgame_ref
# Generate new JWT secrets and use production API key
```

### Finding Your Desktop IP

**Linux/Mac:**

```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**

```cmd
ipconfig
```

Look for `192.168.x.x` or `10.x.x.x`

---

## Mobile App Configuration

### Update API Base URL in Mobile App

In your mobile app, point to:

```typescript
// Development (mobile testing)
const API_URL = "http://REDACTED_IP:3000"; // Use your desktop IP

// Production
const API_URL = "https://api.yourdomain.com";
```

### iOS App Transport Security

Add to `Info.plist` for development HTTP access:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>REDACTED_IP</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

**Remove this in production builds!**

---

## Quick Reference

| Command          | Environment     | Host      | CORS                |
| ---------------- | --------------- | --------- | ------------------- |
| `bun dev`        | .env.local      | 127.0.0.1 | localhost only      |
| `bun dev:mobile` | .env.mobile     | 0.0.0.0   | localhost + network |
| `bun dev:prod`   | .env.production | 0.0.0.0   | production domains  |
| `bun start`      | .env.production | 0.0.0.0   | production domains  |

---

## Security Notes

1. **Never commit actual .env files** - they contain secrets
2. **Only commit .env.example** - it's a template
3. **Use different JWT secrets** for each environment
4. **Restrict CORS origins** in production
5. **Use HTTPS** in production
6. **Remove iOS ATS exceptions** in production builds

---

## Troubleshooting

### Can't connect from mobile device

1. Check both devices are on same WiFi
2. Verify server is running with `bun dev:mobile`
3. Check firewall: `sudo ufw allow 3000/tcp`
4. Verify desktop IP hasn't changed
5. Update CORS_ORIGINS in `.env.mobile` if IP changed

### CORS errors

- Check CORS_ORIGINS includes your origin
- Restart server after changing .env files
- Check browser console for actual origin being sent

### Server won't start

- Check PORT is not already in use
- Verify database connection string
- Check all required env variables are set

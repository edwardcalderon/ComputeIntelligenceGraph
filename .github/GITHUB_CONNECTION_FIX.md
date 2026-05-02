# GitHub Connection Authorization - Fix

## Problem

You're seeing this error:

> "You don't have permission to create the connection. An owner with access to installation 128501260 must create the connection."

## Root Cause

The AWS CodeStar connection is trying to use a GitHub App installation (ID: 128501260) that you don't have access to. This app was created by someone else.

## Solution (2 minutes)

### Step 1: Go to AWS Console
Open: https://console.aws.amazon.com/codesuite/connections/

### Step 2: Select Region
Make sure you're in: **us-east-2**

### Step 3: Find Connection
Look for: **github-cig**

### Step 4: Click "Update pending connection"

### Step 5: Click "Connect to GitHub"

### Step 6: **CLEAR THE APP INSTALLATION FIELD** ⚠️
- You'll see a field with "App Installation" and a number (128501260)
- Click the **X** button to clear it
- Leave the field **BLANK**
- This allows you to connect as a GitHub user instead of a bot

### Step 7: Authorize AWS
- You'll be redirected to GitHub
- Click: **Authorize AWS Connector for GitHub**
- Grant permissions to access your repositories

### Step 8: Done!
- Return to AWS Console
- Connection status should change to **AVAILABLE**

## Verify It Worked

```bash
aws codestar-connections get-connection \
  --connection-arn arn:aws:codestar-connections:us-east-2:520900722378:connection/876488de-c75b-4f86-9e7d-2a268bf24e70 \
  --region us-east-2 \
  --profile aws-cig
```

Expected output:
```json
{
    "Connection": {
        "ConnectionStatus": "AVAILABLE"
    }
}
```

## What This Means

- **With App Installation:** Connects as a bot (requires app owner permission)
- **Without App Installation (blank):** Connects as a GitHub user (your account)

Since you're the one authorizing, leave it blank to connect as yourself.

## Next Steps

Once the connection is AVAILABLE:

1. Push code to `main` branch
2. Pipeline automatically triggers
3. CodeBuild validates, builds, and deploys
4. Lambda function updates

---

**Quick Fix:** Clear the App Installation field and leave it blank!

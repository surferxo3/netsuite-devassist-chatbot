# F3 SuiteScript Dev Assist Chatbot

A proof-of-concept chatbot that interfaces with NetSuite's DevAssist API, powered by Oracle OCI Cohere Command R model. This chatbot provides code assistance for NetSuite development with proper formatting, code blocks, and copy functionality.

![F3 Dev Assist](https://img.shields.io/badge/F3-Dev%20Assist-purple)
![NetSuite](https://img.shields.io/badge/NetSuite-SuiteScript-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

---

## Features

- 🤖 **AI-Powered Code Generation** - Leverages NetSuite's DevAssist API
- 🔐 **OAuth 2.0 Authentication** - Secure PKCE flow with auto token refresh
- 💬 **Real-time Streaming** - Server-Sent Events for live responses
- 📝 **Markdown Rendering** - Properly formatted code blocks, headers, lists
- 📋 **One-Click Copy** - Copy code snippets with a single click
- 🎨 **Modern UI** - Clean, responsive design with dark code themes
- 📜 **Conversation History** - Context-aware responses (last 30 exchanges)

---

## Prerequisites

- **Node.js** 18+ installed
- **NetSuite Account** with Administrator access
- **SuiteCloud Development Framework** knowledge (helpful)

---

## Setup Guide

### Step 1: Create NetSuite Integration Record

1. Log in to your **NetSuite account** as Administrator
2. Navigate to: **Setup → Integration → Manage Integrations → New**
3. Fill in the following details:

| Field | Value |
|-------|-------|
| **Name** | `F3 SuiteScript Dev Assist` |
| **State** | `Enabled` |

4. Under **OAuth 2.0** section, configure:

| Setting | Value |
|---------|-------|
| **Authorization Code Grant** | ☑️ Checked |
| **Public Client** | ☑️ Checked |
| **Redirect URI** | `http://localhost:3000/auth/callback` |
| **Refresh Token Validity (in hours)** | `720` |
| **Maximum Time for Token Rotation (in hours)** | `720` |

5. Under **Scope** section:

| Scope | Value |
|-------|-------|
| **Restlets** | ☑️ Checked |
| **REST Web Services** | ☑️ Checked |

6. Click **Save**

7. **⚠️ IMPORTANT**: Copy the **Consumer Key / Client ID** shown on the confirmation page. You will only see this once!

   Example: `b2a08923443c7a763c2ecd27f08d5403a53cec043f9b70c2d5e25944114b3e03`

---

### Step 2: Clone & Configure the Project

```bash
# Clone the repository
git clone https://bitbucket.org/folio3/f3-suitecloud-devassist.git
cd f3-suitecloud-devassist

# Install dependencies
npm install
```

---

### Step 3: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit the `.env` file with your settings:

```env
# NetSuite Account ID (e.g., 4073908-sb4 for sandbox, 4073908 for production)
NETSUITE_ACCOUNT_ID=<ACCOUNT_ID>

# NetSuite DevAssist API URL (your account-specific URL)
NETSUITE_API_URL=https://<ACCOUNT_ID>.app.netsuite.com:443/api/internal/devassist/chat/completions

# OAuth 2.0 Configuration
NETSUITE_CLIENT_ID=<YOUR_CONSUMER_KEY_FROM_STEP_1>
NETSUITE_REDIRECT_URI=http://localhost:3000/auth/callback
NETSUITE_SCOPE=restlets,rest_webservices
NETSUITE_DISCOVERY_URL=https://<ACCOUNT_ID>.suitetalk.api.netsuite.com/.well-known/oauth-authorization-server

# Server Configuration
PORT=3000
```

**Replace `<ACCOUNT_ID>`** with your NetSuite account ID (e.g., `4073908_SB4` for sandbox or `4073908` for production).

**Replace `<YOUR_CONSUMER_KEY_FROM_STEP_1>`** with the Consumer Key you copied from Step 1.

---

### Step 4: Start the Server

```bash
npm start
```

You should see:

```
✓ Loaded system prompt from: /path/to/system-prompt.md
✓ OAuth endpoints loaded:
  Authorization: https://<ACCOUNT_ID>.app.netsuite.com/app/login/oauth2/authorize.nl
  Token: https://<ACCOUNT_ID>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token

═══════════════════════════════════════════════════════
  NetSuite DevAssist Chatbot
═══════════════════════════════════════════════════════
  Server:    http://localhost:3000
  Auth:      http://localhost:3000/auth/login
  Status:    http://localhost:3000/auth/status
═══════════════════════════════════════════════════════
```

---

### Step 5: Authenticate & Use

1. Open your browser and go to: **http://localhost:3000**

2. Click **"Login with NetSuite"**

3. You'll be redirected to NetSuite's login page. Enter your credentials.

4. Authorize the application when prompted.

5. You'll be redirected back to the chatbot - **You're now ready to use it!**

---

## Usage

### Ask Questions
Type your NetSuite development questions in the chat:
- *"Create a Suitelet to list open sales orders"*
- *"Write a User Event script to validate customer credit limit"*
- *"Build a Map/Reduce script to process invoices"*

### Copy Code
Click the **Copy** button on any code block to copy to clipboard.

### Clear Conversation
Click **"Clear Conversation"** to start fresh.

### Logout
Click **"Logout"** in the header to end your session.

---

## Naming Conventions

All generated code follows Folio3 naming conventions:

| Type | Format | Example |
|------|--------|---------|
| Suitelet | `customscript_f3_<name>_sl` | `customscript_f3_open_so_sl` |
| User Event | `customscript_f3_<name>_ue` | `customscript_f3_validate_cust_ue` |
| Client Script | `customscript_f3_<name>_cs` | `customscript_f3_field_val_cs` |
| Map/Reduce | `customscript_f3_<name>_mr` | `customscript_f3_process_inv_mr` |
| Scheduled | `customscript_f3_<name>_ss` | `customscript_f3_daily_sync_ss` |
| RESTlet | `customscript_f3_<name>_rl` | `customscript_f3_api_orders_rl` |

---

## Project Structure

```
f3-suitecloud-devassist/
├── .env                    # Environment configuration (not committed)
├── .env.example            # Example environment file (template)
├── .gitignore              # Git ignore rules
├── package.json            # Node.js dependencies
├── server.js               # Express backend with OAuth 2.0
├── system-prompt.md        # AI system prompt configuration
├── README.md               # This file
└── public/
    ├── index.html          # Chat UI
    ├── styles.css          # Styling
    └── app.js              # Frontend JavaScript
```

---

## Troubleshooting

### "Authentication Required" Error
- Ensure your Integration Record is set up correctly
- Verify the Consumer Key in `.env` matches your Integration Record
- Check that Redirect URI is exactly `http://localhost:3000/auth/callback`

### "Token Expired" Error
- The app automatically refreshes tokens
- If issues persist, click Logout and Login again

### "Network Error" or Timeout
- Check your internet connection
- Verify the NETSUITE_API_URL is correct for your account
- Ensure you have access to the DevAssist API

### Code Not Following Naming Conventions
- The AI model suggestions may vary; copy and rename files as needed
- Reference the naming conventions table above

---

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | GET | Initiates OAuth 2.0 login |
| `/auth/callback` | GET | OAuth callback handler |
| `/auth/status` | GET | Check authentication status |
| `/auth/logout` | POST | Logout and revoke tokens |

### Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send chat message |
| `/api/health` | GET | Health check |

### NetSuite REST API Proxy (for debugging)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metadata/:recordType` | GET | Get record field schema |
| `/api/record/:recordType/:id` | GET | Get a specific record |
| `/api/suiteql` | POST | Execute SuiteQL query |

---

## Testing API Endpoints in Postman

After authenticating in the browser, you can test the proxy endpoints in Postman:

### Get Record Metadata
```
GET http://localhost:3000/api/metadata/salesorder
```
Returns the field schema for Sales Orders - useful to know which fields exist.

### Get Record Metadata (Direct to NetSuite)
```
GET https://<ACCOUNT_ID>.suitetalk.api.netsuite.com/services/rest/record/v1/metadata-catalog/salesorder
Authorization: Bearer <YOUR_ACCESS_TOKEN>
Accept: application/schema+json
```

### Execute SuiteQL Query
```
POST http://localhost:3000/api/suiteql
Content-Type: application/json

{
  "query": "SELECT id, tranid, trandate FROM transaction WHERE type = 'SalesOrd' AND ROWNUM <= 10"
}
```

### Execute SuiteQL (Direct to NetSuite)
```
POST https://<ACCOUNT_ID>.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql
Authorization: Bearer <YOUR_ACCESS_TOKEN>
Content-Type: application/json
Prefer: transient

{
  "q": "SELECT id, tranid FROM transaction WHERE ROWNUM <= 5"
}
```

### Get Single Record
```
GET http://localhost:3000/api/record/salesorder/12345
```

### Get Record (Direct to NetSuite)
```
GET https://<ACCOUNT_ID>.suitetalk.api.netsuite.com/services/rest/record/v1/salesorder/12345
Authorization: Bearer <YOUR_ACCESS_TOKEN>
Accept: application/json
```

---

## Tech Stack

- **Backend**: Node.js, Express
- **Authentication**: OAuth 2.0 with PKCE
- **Streaming**: Server-Sent Events (SSE)
- **Frontend**: Vanilla JavaScript, CSS3
- **AI Model**: NetSuite DevAssist (Oracle OCI Cohere Command R)

---

## Data Storage Strategy

This PoC uses browser storage for simplicity:

| Data | Storage | Persistence | Notes |
|------|---------|-------------|-------|
| **Chat History** | `localStorage` | Permanent (until cleared) | Survives browser close |
| **Active Chat** | `sessionStorage` | Tab session | Lost on tab close |
| **Auth Tokens** | Server memory | Server session | Lost on server restart |

### Optional: Auto-Inject Metadata

The server includes an optional feature to automatically fetch NetSuite field metadata and inject it into the LLM context. This helps the LLM generate correct field names in SuiteQL queries.

**To enable** (in `server.js`):
```javascript
const AUTO_INJECT_METADATA = true; // Change from false to true
```

When enabled, if you ask about "sales orders", the server will:
1. Detect the record type
2. Fetch metadata from NetSuite REST API
3. Inject available field names into your message
4. LLM uses correct field names!

**Note**: This is disabled by default because the NetSuite-trained Cohere LLM should already know standard fields.

### Future Enhancements

For production, consider:
- **Database storage** (MongoDB, PostgreSQL) for chat history
- **Redis** for session management
- **User accounts** for multi-device sync
- **Export/Import** functionality for chat backups

---

## Security Notes

- ⚠️ Never commit `.env` file to version control
- 🔐 Auth tokens are stored in server memory only
- 🔄 Access tokens auto-refresh when expired
- 🚪 Logout revokes tokens at NetSuite
- 💬 Chat history stored locally in browser

---

## License

Internal use only - Folio3 Software

---

## Support

For issues or questions, contact the Folio3 NetSuite development team.

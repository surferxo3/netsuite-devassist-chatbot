# NetSuite DevAssist Chatbot

A proof-of-concept chatbot that interfaces with NetSuite's DevAssist API, powered by Oracle OCI Cohere Command R model. This chatbot provides code assistance for NetSuite development with proper formatting, code blocks, and copy functionality.

![NetSuite](https://img.shields.io/badge/NetSuite-DevAssist-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Features

- 🤖 **AI-Powered Code Generation** - Leverages NetSuite's DevAssist API
- 🔐 **OAuth 2.0 Authentication** - Secure PKCE flow with auto token refresh
- 💬 **Real-time Streaming** - Server-Sent Events for live responses
- 📝 **Markdown Rendering** - Properly formatted code blocks, headers, lists
- 📋 **One-Click Copy** - Copy code snippets with a single click
- 🎨 **Modern UI** - Clean, responsive design with dark code themes
- 📜 **Multiple Chat Sessions** - Create, switch, and manage separate conversations
- 💾 **Persistent History** - Chats saved in browser localStorage across sessions

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
| **Name** | `NetSuite DevAssist Chatbot` |
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

   Example: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2`

---

### Step 2: Clone & Configure the Project

```bash
# Clone the repository
git clone https://github.com/surferxo3/netsuite-devassist-chatbot.git
cd netsuite-devassist-chatbot

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

**Replace `<ACCOUNT_ID>`** with your NetSuite account ID (e.g., `1234567_SB1` for sandbox or `1234567` for production).

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

### Multiple Chat Sessions
- Click **"New Chat"** in the sidebar to start a fresh conversation
- Switch between chats by clicking on them in the sidebar
- Each chat maintains its own conversation history
- Delete individual chats using the 🗑️ button

### Clear All History
Click **"Clear All History"** in the sidebar to delete all saved chats.

### Logout
Click **"Logout"** in the header to end your session.

---

## Naming Conventions

The generated code follows a configurable naming convention. You can customize the prefix in `system-prompt.md`:

| Type | Format | Example |
|------|--------|---------|
| Suitelet | `customscript_<prefix>_<name>_sl` | `customscript_myco_open_so_sl` |
| User Event | `customscript_<prefix>_<name>_ue` | `customscript_myco_validate_cust_ue` |
| Client Script | `customscript_<prefix>_<name>_cs` | `customscript_myco_field_val_cs` |
| Map/Reduce | `customscript_<prefix>_<name>_mr` | `customscript_myco_process_inv_mr` |
| Scheduled | `customscript_<prefix>_<name>_ss` | `customscript_myco_daily_sync_ss` |
| RESTlet | `customscript_<prefix>_<name>_rl` | `customscript_myco_api_orders_rl` |

**To customize**: Edit `system-prompt.md` and replace `_ns_` with your company prefix (e.g., `_myco_`).

---

## Project Structure

```
netsuite-devassist-chatbot/
├── .env                    # Environment configuration (not committed)
├── .env.example            # Example environment file (template)
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
├── package.json            # Node.js dependencies
├── server.js               # Express backend with OAuth 2.0
├── system-prompt.md        # AI system prompt configuration (customizable)
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
- Customize `system-prompt.md` for your preferred naming convention

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

## Contributing

Contributions are welcome! Feel free to:
- Open issues for bugs or feature requests
- Submit pull requests
- Improve documentation

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Folio3 NetSuite Services](https://netsuite.folio3.com/) - Award-winning NetSuite Alliance Partner
- [Oracle OCI Cohere](https://docs.cohere.com/docs/oracle-cloud-infrastructure-oci) - LLM powering the responses

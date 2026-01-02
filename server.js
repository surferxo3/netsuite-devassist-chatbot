const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// SYSTEM PROMPT CONFIGURATION
// =============================================================================
let SYSTEM_PROMPT = '';
const PROMPT_FILE_PATH = process.env.PROMPT_FILE_PATH || path.join(__dirname, 'system-prompt.md');

try {
  SYSTEM_PROMPT = fs.readFileSync(PROMPT_FILE_PATH, 'utf8');
  SYSTEM_PROMPT = SYSTEM_PROMPT.replace(/^# SYSTEM PROMPT\s*\n/, '');
  console.log(`✓ Loaded system prompt from: ${PROMPT_FILE_PATH}`);
} catch (error) {
  console.warn(`⚠ Could not load prompt file, using default:`, error.message);
  SYSTEM_PROMPT = process.env.DEFAULT_SYSTEM_PROMPT || 'You are NetSuite Dev Assist, a highly skilled software engineer with extensive knowledge in NetSuite, SuiteScript, SuiteQL, and modern web development.';
}

// =============================================================================
// OAUTH 2.0 CONFIGURATION
// =============================================================================
const OAUTH_CONFIG = {
  clientId: process.env.NETSUITE_CLIENT_ID,
  redirectUri: process.env.NETSUITE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scope: process.env.NETSUITE_SCOPE || 'restlets,rest_webservices',
  discoveryUrl: process.env.NETSUITE_DISCOVERY_URL
};

// OAuth endpoints (populated from discovery)
let oauthEndpoints = {
  authorizationEndpoint: null,
  tokenEndpoint: null,
  revocationEndpoint: null
};

// Token storage (in-memory)
let tokenStore = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  tokenType: 'Bearer'
};

// PKCE storage (temporary, per auth flow)
let pkceStore = {
  codeVerifier: null,
  state: null
};

// NetSuite API URL (required)
const NETSUITE_API_URL = process.env.NETSUITE_API_URL;

// =============================================================================
// VALIDATE REQUIRED ENV VARS
// =============================================================================
function validateEnv() {
  const required = [
    'NETSUITE_API_URL',
    'NETSUITE_CLIENT_ID',
    'NETSUITE_DISCOVERY_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n📝 Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

validateEnv();

// =============================================================================
// PKCE HELPERS
// =============================================================================
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// OAUTH DISCOVERY
// =============================================================================
async function fetchOAuthMetadata() {
  try {
    console.log('Fetching OAuth metadata from:', OAUTH_CONFIG.discoveryUrl);
    const response = await axios.get(OAUTH_CONFIG.discoveryUrl, { timeout: 10000 });
    
    oauthEndpoints = {
      authorizationEndpoint: response.data.authorization_endpoint,
      tokenEndpoint: response.data.token_endpoint,
      revocationEndpoint: response.data.revocation_endpoint
    };
    
    console.log('✓ OAuth endpoints loaded:');
    console.log('  Authorization:', oauthEndpoints.authorizationEndpoint);
    console.log('  Token:', oauthEndpoints.tokenEndpoint);
    return true;
  } catch (error) {
    console.error('✗ Failed to fetch OAuth metadata:', error.message);
    // Fallback to hardcoded endpoints
    console.error('❌ Failed to fetch OAuth metadata. Check NETSUITE_DISCOVERY_URL in .env');
    process.exit(1);
    console.log('⚠ Using fallback OAuth endpoints');
    return false;
  }
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================
function isAuthenticated() {
  return tokenStore.accessToken !== null;
}

function isTokenExpired() {
  if (!tokenStore.expiresAt) return true;
  // Add 60 second buffer before expiry
  return Date.now() >= (tokenStore.expiresAt - 60000);
}

async function refreshAccessToken() {
  if (!tokenStore.refreshToken) {
    throw new Error('No refresh token available. Please login again.');
  }

  console.log('Refreshing access token...');
  
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenStore.refreshToken,
      client_id: OAUTH_CONFIG.clientId
    });

    const response = await axios.post(oauthEndpoints.tokenEndpoint, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // Update token store
    tokenStore.accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      tokenStore.refreshToken = response.data.refresh_token;
    }
    tokenStore.expiresAt = Date.now() + (response.data.expires_in * 1000);
    tokenStore.tokenType = response.data.token_type || 'Bearer';

    console.log('✓ Access token refreshed successfully');
    console.log('  Expires in:', response.data.expires_in, 'seconds');
    
    return tokenStore.accessToken;
  } catch (error) {
    console.error('✗ Token refresh failed:', error.response?.data || error.message);
    // Clear tokens on refresh failure
    tokenStore = { accessToken: null, refreshToken: null, expiresAt: null, tokenType: 'Bearer' };
    throw error;
  }
}

async function getValidAccessToken() {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated. Please login first.');
  }

  if (isTokenExpired()) {
    await refreshAccessToken();
  }

  return tokenStore.accessToken;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  next();
});

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

// Check authentication status
app.get('/auth/status', (req, res) => {
  res.json({
    authenticated: isAuthenticated(),
    tokenExpired: isTokenExpired(),
    expiresAt: tokenStore.expiresAt ? new Date(tokenStore.expiresAt).toISOString() : null
  });
});

// Initiate OAuth login
app.get('/auth/login', (req, res) => {
  // Generate PKCE values
  pkceStore.codeVerifier = generateCodeVerifier();
  pkceStore.state = generateState();
  const codeChallenge = generateCodeChallenge(pkceStore.codeVerifier);

  // Build authorization URL
  const authUrl = new URL(oauthEndpoints.authorizationEndpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
  authUrl.searchParams.set('scope', OAUTH_CONFIG.scope);
  authUrl.searchParams.set('state', pkceStore.state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('Redirecting to NetSuite authorization...');
  res.redirect(authUrl.toString());
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle errors from OAuth provider
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.redirect(`/?auth_error=${encodeURIComponent(error_description || error)}`);
  }

  // Validate state
  if (state !== pkceStore.state) {
    console.error('State mismatch - possible CSRF attack');
    return res.redirect('/?auth_error=Invalid%20state%20parameter');
  }

  if (!code) {
    return res.redirect('/?auth_error=No%20authorization%20code%20received');
  }

  try {
    // Exchange code for tokens
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      client_id: OAUTH_CONFIG.clientId,
      code_verifier: pkceStore.codeVerifier
    });

    console.log('Exchanging authorization code for tokens...');
    
    const response = await axios.post(oauthEndpoints.tokenEndpoint, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    // Store tokens
    tokenStore.accessToken = response.data.access_token;
    tokenStore.refreshToken = response.data.refresh_token;
    tokenStore.expiresAt = Date.now() + (response.data.expires_in * 1000);
    tokenStore.tokenType = response.data.token_type || 'Bearer';

    // Clear PKCE store
    pkceStore = { codeVerifier: null, state: null };

    console.log('✓ Authentication successful!');
    console.log('  Access token expires in:', response.data.expires_in, 'seconds');
    console.log('  Refresh token received:', !!response.data.refresh_token);

    res.redirect('/?auth_success=true');
  } catch (error) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    res.redirect(`/?auth_error=${encodeURIComponent(errorMsg)}`);
  }
});

// Logout
app.post('/auth/logout', async (req, res) => {
  // Optionally revoke token at NetSuite
  if (tokenStore.accessToken && oauthEndpoints.revocationEndpoint) {
    try {
      await axios.post(oauthEndpoints.revocationEndpoint, 
        new URLSearchParams({ token: tokenStore.accessToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      console.log('Token revoked at NetSuite');
    } catch (error) {
      console.warn('Token revocation failed:', error.message);
    }
  }

  // Clear local tokens
  tokenStore = { accessToken: null, refreshToken: null, expiresAt: null, tokenType: 'Bearer' };
  console.log('✓ Logged out successfully');
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// =============================================================================
// CHAT ENDPOINT
// =============================================================================
app.post('/api/chat', async (req, res) => {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      return res.status(401).json({ 
        error: 'Not authenticated', 
        message: 'Please login first',
        requiresAuth: true 
      });
    }

    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Schema injection disabled - relying on LLM's NetSuite training
    // To enable dynamic schema discovery, implement SuiteQL query: 
    // SELECT * FROM {table} WHERE ROWNUM <= 1
    let metadataContext = '';

    // Build messages array - optimized for natural conversation flow
    const messages = [];
    
    // System message (always first)
    messages.push({
      role: 'system',
      content: SYSTEM_PROMPT
    });
    
    // Conversation history - Best practice: First message + recent window
    // This preserves original intent while keeping recent context
    const historyWithoutSystem = conversationHistory.filter(msg => msg.role !== 'system');
    
    // Smart context: Keep first 2 messages (original intent) + last 6 messages (recent context)
    // Also enforce max payload size to prevent 413 errors
    const MAX_HISTORY_CHARS = 50000; // ~50KB max for history
    
    let limitedHistory = [];
    if (historyWithoutSystem.length <= 8) {
      limitedHistory = historyWithoutSystem;
    } else {
      // First exchange (user + assistant) + last 3 exchanges
      const firstMessages = historyWithoutSystem.slice(0, 2);
      const recentMessages = historyWithoutSystem.slice(-6);
      limitedHistory = [...firstMessages, ...recentMessages];
    }
    
    // Trim history if still too large (long code responses)
    let historySize = JSON.stringify(limitedHistory).length;
    while (historySize > MAX_HISTORY_CHARS && limitedHistory.length > 2) {
      // Remove oldest messages (but keep at least first 2)
      limitedHistory.splice(2, 2); // Remove 3rd and 4th message
      historySize = JSON.stringify(limitedHistory).length;
      console.log(`⚠️ Trimmed history to ${limitedHistory.length} msgs (${(historySize/1024).toFixed(1)}KB)`);
    }
    
    // Format history messages consistently
    for (const msg of limitedHistory) {
      // Extract text content from various formats
      let textContent;
      if (Array.isArray(msg.content)) {
        textContent = msg.content.map(c => c.text || c.content || '').join('');
      } else {
        textContent = String(msg.content || '');
      }
      
      // Skip empty messages
      if (!textContent.trim()) continue;
      
      // Both user and assistant messages in consistent format
      if (msg.role === 'user') {
        messages.push({
          role: 'user',
          content: [{ type: 'text', text: textContent }]
        });
      } else if (msg.role === 'assistant') {
        // Truncate very long assistant responses to prevent payload issues
        // Keep first 2000 chars + last 500 chars for context
        let truncatedContent = textContent;
        if (textContent.length > 3000) {
          truncatedContent = textContent.substring(0, 2000) + 
            '\n\n[... response truncated for context ...]\n\n' + 
            textContent.substring(textContent.length - 500);
          console.log(`⚠️ Truncated assistant message from ${textContent.length} to ${truncatedContent.length} chars`);
        }
        messages.push({
          role: 'assistant',
          content: truncatedContent
        });
      }
    }
    
    // Current user message (the new query)
    // Note: Removed follow-up hint as it may cause issues with NetSuite API
    const isFollowUp = limitedHistory.length >= 2;
    
    const enrichedMessage = metadataContext 
      ? `${message}\n${metadataContext}`
      : message;
    
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: enrichedMessage }]
    });

    const requestBody = {
      model: 'F3 NS Dev Assist',
      messages: messages,
      // OpenAI-compatible params to prevent caching/storing
      store: false,              // Don't store this conversation
      // stream: true,           // Streaming is default for this API
      // temperature: 0.7,       // Uncomment to control randomness
      // max_tokens: 4096,       // Uncomment to limit response length
    };

    // Log conversation context for debugging
    const totalChars = JSON.stringify(messages).length;
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`📤 CHAT REQUEST`);
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`   System prompt: ${SYSTEM_PROMPT.length} chars`);
    console.log(`   History: ${limitedHistory.length} msgs (from ${historyWithoutSystem.length} total)`);
    console.log(`   Total messages: ${messages.length}`);
    console.log(`   Payload size: ~${(totalChars / 1024).toFixed(1)} KB`);
    console.log(`   Follow-up: ${isFollowUp ? 'YES' : 'NO'}`);
    console.log(`   Current msg: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`);
    
    // Log message structure for debugging
    messages.forEach((m, i) => {
      const contentPreview = typeof m.content === 'string' 
        ? m.content.substring(0, 50) 
        : JSON.stringify(m.content).substring(0, 50);
      console.log(`   [${i}] ${m.role}: ${contentPreview}...`);
    });
    console.log(`───────────────────────────────────────────────────────`);

    // Make API request with auto-refresh
    const makeApiRequest = async (retryCount = 0) => {
      const accessToken = await getValidAccessToken();
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'User-Agent': 'Dn/JS 6.9.0'
      };

      console.log('Sending request to NetSuite API...');

      const response = await axios.post(NETSUITE_API_URL, requestBody, {
        headers: headers,
        timeout: 120000,
        responseType: 'stream',
        validateStatus: (status) => status < 500
      });

      // Handle 401 - retry once after refresh
      if (response.status === 401 && retryCount < 1) {
        console.log('Received 401, refreshing token and retrying...');
        await refreshAccessToken();
        return makeApiRequest(retryCount + 1);
      }

      return response;
    };

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const response = await makeApiRequest();

      if (response.status !== 200) {
        let errorData = '';
        response.data.setEncoding('utf8');
        response.data.on('data', (chunk) => { errorData += chunk; });
        response.data.on('end', () => {
          res.write(`data: ${JSON.stringify({ error: 'API Error', message: errorData || `HTTP ${response.status}` })}\n\n`);
          res.end();
        });
        return;
      }

      // Forward stream with proper UTF-8 encoding
      response.data.setEncoding('utf8');
      let fullResponse = ''; // For debugging
      
      response.data.on('data', (chunk) => {
        fullResponse += chunk;
        // Check for API error in stream
        if (chunk.includes('unexpected_error') || chunk.includes('AN_UNEXPECTED_ERROR')) {
          console.error('❌ NetSuite API Error in stream:', chunk);
        }
        res.write(chunk);
      });
      
      response.data.on('end', () => { 
        // Log if response was an error
        if (fullResponse.includes('error')) {
          console.log('📩 Full API response (may contain error):', fullResponse.substring(0, 500));
        }
        res.write('\n\n'); 
        res.end(); 
      });
      
      response.data.on('error', (error) => {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream error', message: error.message })}\n\n`);
        res.end();
      });

    } catch (streamError) {
      console.error('Streaming error:', streamError.message);
      
      // Check if it's an auth error
      if (streamError.message.includes('Not authenticated') || streamError.message.includes('login')) {
        res.write(`data: ${JSON.stringify({ error: 'Auth Error', message: 'Please login again', requiresAuth: true })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Error', message: streamError.message })}\n\n`);
      }
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error.message);
    
    // Handle auth errors
    if (error.message.includes('Not authenticated') || error.message.includes('login')) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        message: error.message,
        requiresAuth: true 
      });
    }
    
    res.status(500).json({ error: 'Server Error', message: error.message });
  }
});

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    authenticated: isAuthenticated(),
    tokenExpired: isTokenExpired()
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================
async function startServer() {
  // Fetch OAuth metadata
  await fetchOAuthMetadata();
  
  // Start server
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  NetSuite DevAssist Chatbot');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Server:    http://localhost:${PORT}`);
    console.log(`  Auth:      http://localhost:${PORT}/auth/login`);
    console.log(`  Status:    http://localhost:${PORT}/auth/status`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  });
}

startServer();

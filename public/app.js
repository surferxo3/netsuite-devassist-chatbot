// =============================================================================
// STORAGE CONFIGURATION
// =============================================================================
const STORAGE_KEYS = {
    CHAT_HISTORY: 'f3_devassist_chats',      // localStorage - all chats
    ACTIVE_CHAT_ID: 'f3_devassist_active',   // sessionStorage - current chat ID
    CURRENT_MESSAGES: 'f3_devassist_msgs'    // sessionStorage - current chat messages HTML
};

const CONFIG = {
    MAX_CHATS: 50,           // Max chats in history
    MAX_MESSAGES: 100,       // Max messages per chat
    TRIM_TO_MESSAGES: 60,    // Trim to this many on overflow
    MAX_TITLE_LENGTH: 50     // Chat title max length
};

// =============================================================================
// STATE
// =============================================================================
let currentChatId = null;
let conversationHistory = [];
let allChats = [];
let isAuthenticated = false;

// =============================================================================
// DOM ELEMENTS
// =============================================================================
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const status = document.getElementById('status');
const authOverlay = document.getElementById('authOverlay');
const loginButton = document.getElementById('loginButton');
const logoutButton = document.getElementById('logoutButton');
const authStatus = document.getElementById('authStatus');
const sidebar = document.getElementById('sidebar');
const chatHistoryContainer = document.getElementById('chatHistory');
const newChatButton = document.getElementById('newChatButton');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const toggleSidebarButton = document.getElementById('toggleSidebar');

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Hide auth overlay initially
    if (authOverlay) {
        authOverlay.style.opacity = '0';
        authOverlay.style.transition = 'opacity 0.3s ease';
    }
    
    // Check URL params for auth result
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth_success')) {
        showToast('Login successful!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('auth_error')) {
        showToast(`Login failed: ${urlParams.get('auth_error')}`, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Load chat history from localStorage
    loadAllChats();
    
    // Check authentication
    await checkAuthStatus();
    
    // Load or create active chat
    if (isAuthenticated) {
        const activeId = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
        if (activeId && allChats.find(c => c.id === activeId)) {
            loadChat(activeId);
        } else if (allChats.length > 0) {
            loadChat(allChats[0].id);
        } else {
            createNewChat();
        }
    }
    
    // Show auth overlay if needed
    if (authOverlay) {
        authOverlay.style.opacity = isAuthenticated ? '0' : '1';
        if (isAuthenticated) {
            setTimeout(() => { authOverlay.style.display = 'none'; }, 300);
        }
    }
    
    // Render chat history sidebar
    renderChatHistory();
    
    // Setup event listeners
    setupEventListeners();
});

// =============================================================================
// CHAT HISTORY MANAGEMENT (localStorage)
// =============================================================================
function loadAllChats() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
        allChats = saved ? JSON.parse(saved) : [];
        // Sort by updatedAt descending
        allChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (e) {
        console.warn('Failed to load chat history:', e);
        allChats = [];
    }
}

function saveAllChats() {
    try {
        // Limit number of chats
        if (allChats.length > CONFIG.MAX_CHATS) {
            allChats = allChats.slice(0, CONFIG.MAX_CHATS);
        }
        localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(allChats));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            // Remove oldest chats
            allChats = allChats.slice(0, Math.floor(allChats.length / 2));
            try {
                localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(allChats));
            } catch (e2) {
                console.error('Failed to save even after trimming:', e2);
            }
        }
    }
}

function createNewChat() {
    const chat = {
        id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    allChats.unshift(chat);
    saveAllChats();
    loadChat(chat.id);
    renderChatHistory();
    
    return chat;
}

function loadChat(chatId) {
    const chat = allChats.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    conversationHistory = chat.messages || [];
    
    // Save active chat ID to sessionStorage
    sessionStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, chatId);
    
    // Render messages
    renderMessages();
    renderChatHistory();
}

function saveCurrentChat() {
    if (!currentChatId) return;
    
    const chat = allChats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // Trim messages if needed
    if (conversationHistory.length > CONFIG.MAX_MESSAGES) {
        conversationHistory = conversationHistory.slice(-CONFIG.TRIM_TO_MESSAGES);
    }
    
    chat.messages = conversationHistory;
    chat.updatedAt = new Date().toISOString();
    
    // Update title from first user message
    if (chat.title === 'New Chat' && conversationHistory.length > 0) {
        const firstUserMsg = conversationHistory.find(m => m.role === 'user');
        if (firstUserMsg) {
            const text = Array.isArray(firstUserMsg.content) 
                ? firstUserMsg.content.map(c => c.text || '').join('') 
                : firstUserMsg.content;
            chat.title = text.substring(0, CONFIG.MAX_TITLE_LENGTH) + (text.length > CONFIG.MAX_TITLE_LENGTH ? '...' : '');
        }
    }
    
    // Move to top
    const idx = allChats.findIndex(c => c.id === currentChatId);
    if (idx > 0) {
        allChats.splice(idx, 1);
        allChats.unshift(chat);
    }
    
    saveAllChats();
    
    // Also save to sessionStorage for refresh persistence
    sessionStorage.setItem(STORAGE_KEYS.CURRENT_MESSAGES, chatMessages ? chatMessages.innerHTML : '');
}

function deleteChat(chatId) {
    allChats = allChats.filter(c => c.id !== chatId);
    saveAllChats();
    
    if (currentChatId === chatId) {
        if (allChats.length > 0) {
            loadChat(allChats[0].id);
        } else {
            createNewChat();
        }
    }
    
    renderChatHistory();
}

function clearAllHistory() {
    if (confirm('Delete all chat history? This cannot be undone.')) {
        allChats = [];
        localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
        sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_MESSAGES);
        createNewChat();
        showToast('All history cleared', 'success');
    }
}

function renderChatHistory() {
    if (!chatHistoryContainer) return;
    
    if (allChats.length === 0) {
        chatHistoryContainer.innerHTML = '<p class="empty-history">No chat history yet</p>';
        return;
    }
    
    chatHistoryContainer.innerHTML = allChats.map(chat => `
        <div class="chat-history-item ${chat.id === currentChatId ? 'active' : ''}" 
             data-chat-id="${chat.id}" onclick="loadChat('${chat.id}')">
            <span class="chat-icon">💬</span>
            <div class="chat-info">
                <div class="chat-title">${escapeHtml(chat.title)}</div>
                <div class="chat-date">${formatDate(chat.updatedAt)}</div>
            </div>
            <button class="delete-chat" onclick="event.stopPropagation(); deleteChat('${chat.id}')" title="Delete">
                🗑️
            </button>
        </div>
    `).join('');
}

function renderMessages() {
    if (!chatMessages) return;
    
    // Check sessionStorage for cached HTML first (refresh case)
    const cachedHtml = sessionStorage.getItem(STORAGE_KEYS.CURRENT_MESSAGES);
    const activeId = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    
    if (cachedHtml && activeId === currentChatId) {
        chatMessages.innerHTML = cachedHtml;
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }
    
    // Render from conversation history
    chatMessages.innerHTML = `
        <div class="message bot-message">
            <div class="message-content">
                <p>Hello! I'm F3 Dev Assist. I can help you create SuiteScripts, Suitelets, RESTlets, and more. What would you like to build today?</p>
            </div>
        </div>
    `;
    
    for (const msg of conversationHistory) {
        const text = Array.isArray(msg.content) 
            ? msg.content.map(c => c.text || '').join('') 
            : msg.content;
        addMessageToDOM(text, msg.role === 'user' ? 'user' : 'bot');
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =============================================================================
// AUTHENTICATION
// =============================================================================
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        isAuthenticated = data.authenticated;
        updateAuthUI();
    } catch (error) {
        console.error('Failed to check auth status:', error);
        isAuthenticated = false;
        updateAuthUI();
    }
}

function updateAuthUI() {
    if (authOverlay) {
        authOverlay.style.display = isAuthenticated ? 'none' : 'flex';
        authOverlay.style.opacity = isAuthenticated ? '0' : '1';
    }
    
    if (logoutButton) {
        logoutButton.style.display = isAuthenticated ? 'inline-flex' : 'none';
    }
    
    if (authStatus) {
        authStatus.textContent = isAuthenticated ? '🟢 Connected' : '🔴 Not Connected';
        authStatus.className = isAuthenticated ? 'auth-status connected' : 'auth-status disconnected';
    }
    
    if (messageInput) {
        messageInput.disabled = !isAuthenticated;
        messageInput.placeholder = isAuthenticated 
            ? 'Ask about NetSuite development...'
            : 'Please login to start chatting...';
    }
    
    if (sendButton) {
        sendButton.disabled = !isAuthenticated;
    }
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        isAuthenticated = false;
        updateAuthUI();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('Logout failed', 'error');
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================
function setupEventListeners() {
    // Textarea auto-resize and send on Enter
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (loginButton) loginButton.addEventListener('click', () => window.location.href = '/auth/login');
    if (logoutButton) logoutButton.addEventListener('click', logout);
    if (newChatButton) newChatButton.addEventListener('click', () => { createNewChat(); showToast('New chat started', 'success'); });
    if (clearHistoryButton) clearHistoryButton.addEventListener('click', clearAllHistory);
    if (toggleSidebarButton) toggleSidebarButton.addEventListener('click', toggleSidebar);
}

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('open');
    }
}

// =============================================================================
// SEND MESSAGE
// =============================================================================
async function sendMessage() {
    if (!isAuthenticated) {
        showToast('Please login first', 'warning');
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Disable input
    messageInput.disabled = true;
    sendButton.disabled = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Add user message
    addMessageToDOM(message, 'user');
    conversationHistory.push({ role: 'user', content: [{ type: 'text', text: message }] });
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📤 FRONTEND: Sending chat request');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   Current message:', message.substring(0, 80) + (message.length > 80 ? '...' : ''));
    console.log('   History being sent:', conversationHistory.length - 1, 'messages (excluding current)');
    if (conversationHistory.length > 1) {
      console.log('   Last 3 history items:');
      conversationHistory.slice(-4, -1).forEach((msg, i) => {
        const text = Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('') : msg.content;
        console.log(`     [${conversationHistory.length - 4 + i}] ${msg.role}: "${String(text).substring(0, 60)}..."`);
      });
    }
    
    saveCurrentChat();
    renderChatHistory();
    
    // Show loading
    const loadingId = addMessageToDOM('<div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>', 'bot', true);
    
    try {
        updateStatus('Sending request...');
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                conversationHistory: conversationHistory.slice(0, -1)
            })
        });
        
        if (response.status === 401) {
            removeMessage(loadingId);
            isAuthenticated = false;
            updateAuthUI();
            showToast('Session expired. Please login again.', 'warning');
            return;
        }
        
        // Remove loading before processing response
        removeMessage(loadingId);
        
        if (!response.ok) {
            // User-friendly error messages
            const errorMessages = {
                401: 'Session expired. Please login again.',
                403: 'Access denied. Check your NetSuite permissions.',
                413: 'Message too long. Try starting a new chat or shorter messages.',
                429: 'Too many requests. Please wait a moment and try again.',
                500: 'NetSuite server error. Please try again.',
                502: 'NetSuite gateway error. Please try again.',
                503: 'NetSuite service unavailable. Please try again later.',
                504: 'Request timeout. NetSuite took too long to respond.'
            };
            throw new Error(errorMessages[response.status] || `Server error (${response.status})`);
        }
        
        // Add streaming message
        const streamMsgId = addMessageToDOM('', 'bot');
        let accumulatedText = '';
        let reader = null;
        
        try {
            const streamEl = document.getElementById(streamMsgId);
            if (streamEl) {
                const content = streamEl.querySelector('.message-content');
                if (content) content.classList.add('streaming');
            }
            
            reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        if (data === '[DONE]') break;
                        
                        if (data) {
                            try {
                                const parsed = JSON.parse(data);
                                
                                if (parsed.requiresAuth) {
                                    throw new Error('Session expired');
                                }
                                
                                if (parsed.error) {
                                    // Handle error objects properly
                                    const errMsg = parsed.message 
                                        || (typeof parsed.error === 'string' ? parsed.error : parsed.error?.message)
                                        || JSON.stringify(parsed.error);
                                    throw new Error(errMsg);
                                }
                                
                                if (parsed.choices?.[0]) {
                                    const choice = parsed.choices[0];
                                    if (choice.delta?.content) {
                                        accumulatedText += choice.delta.content;
                                        updateStreamingMessage(streamMsgId, accumulatedText);
                                    } else if (choice.message?.content) {
                                        accumulatedText = typeof choice.message.content === 'string'
                                            ? choice.message.content
                                            : choice.message.content.map(i => i.text || '').join('');
                                        updateStreamingMessage(streamMsgId, accumulatedText);
                                    }
                                }
                            } catch (e) {
                                if (!(e instanceof SyntaxError)) throw e;
                            }
                        }
                    }
                }
            }
        } finally {
            if (reader) {
                try { await reader.cancel(); } catch (e) {}
                try { reader.releaseLock(); } catch (e) {}
            }
            
            // ALWAYS remove streaming class
            const streamEl = document.getElementById(streamMsgId);
            if (streamEl) {
                const content = streamEl.querySelector('.message-content');
                if (content) content.classList.remove('streaming');
            }
        }
        
        // Save to history (only if we got content)
        if (accumulatedText && accumulatedText.trim()) {
            conversationHistory.push({ role: 'assistant', content: [{ type: 'text', text: accumulatedText }] });
            saveCurrentChat();
        } else {
            // No content received - remove the empty streaming message
            console.log('⚠️ No content received, removing empty message');
            removeMessage(streamMsgId);
        }
        
        updateStatus('');
        
    } catch (error) {
        console.error('❌ Chat error:', error);
        
        // Clean up: remove loading message if still present
        try { removeMessage(loadingId); } catch (e) {}
        
        // Clean up: remove any empty bot messages (failed streaming)
        document.querySelectorAll('.bot-message').forEach(el => {
            const content = el.querySelector('.message-content');
            if (content && !content.textContent.trim() && !content.querySelector('.loading-dots') && !content.querySelector('.error-message')) {
                console.log('🧹 Removing empty bot message');
                el.remove();
            }
        });
        
        // Remove streaming class from any streaming message
        document.querySelectorAll('.message-content.streaming').forEach(el => {
            el.classList.remove('streaming');
        });
        
        // Remove the failed user message from history (it was added before the request)
        // This prevents orphaned user messages without responses
        if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
            console.log('🗑️ Removing failed user message from history');
            conversationHistory.pop();
            saveCurrentChat();
        }
        
        // Extract error message properly (handle objects)
        let errorMsg = 'Unknown error occurred';
        if (typeof error === 'string') {
            errorMsg = error;
        } else if (error?.message) {
            errorMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
        } else if (error) {
            errorMsg = JSON.stringify(error);
        }
        
        console.error('❌ Error details:', error);
        
        addMessageToDOM(`
            <div class="error-message">
                <div class="error-title">⚠️ Error</div>
                <div class="error-details">${escapeHtml(errorMsg)}</div>
                <button class="retry-button" onclick="retryLastMessage()">🔄 Retry</button>
            </div>
        `, 'bot', true);
        
        window.lastFailedMessage = message;
        console.log('💾 Stored failed message for retry:', message.substring(0, 50) + '...');
        showToast(errorMsg, 'error');
        updateStatus('');
    } finally {
        messageInput.disabled = !isAuthenticated;
        sendButton.disabled = !isAuthenticated;
        if (isAuthenticated) messageInput.focus();
    }
}

function retryLastMessage() {
    if (window.lastFailedMessage) {
        console.log('🔄 Retry initiated');
        
        // Remove error message from DOM
        const lastBotMsg = chatMessages.querySelector('.bot-message:last-child');
        if (lastBotMsg && lastBotMsg.querySelector('.error-message')) {
            lastBotMsg.remove();
        }
        
        // Remove the failed user message from DOM (it will be re-added by sendMessage)
        const lastUserMsg = chatMessages.querySelector('.user-message:last-child');
        if (lastUserMsg) {
            lastUserMsg.remove();
        }
        
        // Note: The failed user message was already removed from conversationHistory
        // in the catch block of sendMessage, so we don't need to pop again
        
        // Get and clear the stored message
        const retryMessage = window.lastFailedMessage;
        window.lastFailedMessage = null;
        
        console.log('📤 Retrying:', retryMessage.substring(0, 50) + '...');
        console.log('📜 History length:', conversationHistory.length);
        
        // Set input and send
        messageInput.value = retryMessage;
        sendMessage();
    } else {
        console.log('⚠️ No failed message to retry');
        showToast('No message to retry', 'warning');
    }
}
window.retryLastMessage = retryLastMessage;

// =============================================================================
// UI HELPERS
// =============================================================================
function addMessageToDOM(text, role, isHtml = false) {
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    messageDiv.id = messageId;
    messageDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isHtml) {
        contentDiv.innerHTML = text;
    } else {
        contentDiv.innerHTML = formatMessage(text);
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageId;
}

function removeMessage(messageId) {
    const el = document.getElementById(messageId);
    if (el) el.remove();
}

function updateStreamingMessage(messageId, text) {
    const el = document.getElementById(messageId);
    if (el) {
        const content = el.querySelector('.message-content');
        if (content) {
            content.innerHTML = formatMessage(text);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

function formatMessage(text) {
    if (!text) return '<p></p>';
    
    // Store code blocks - preserve exact whitespace
    const codeBlocks = [];
    let formatted = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const id = 'code-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        // Remove only leading/trailing empty lines, preserve internal formatting
        const cleanCode = code.replace(/^\n+/, '').replace(/\n+$/, '');
        const escapedCode = escapeHtml(cleanCode);
        // Store original code in global map for accurate copying
        if (!window.codeBlockStore) window.codeBlockStore = {};
        window.codeBlockStore[id] = cleanCode;
        // Build HTML without extra whitespace that could affect rendering
        const html = '<div class="code-block-wrapper">' +
            '<div class="code-header">' +
            '<span class="code-lang">' + (lang || 'code') + '</span>' +
            '<button class="copy-code-button" onclick="copyCode(\'' + id + '\')" data-code-id="' + id + '">Copy</button>' +
            '</div>' +
            '<pre><code id="' + id + '">' + escapedCode + '</code></pre>' +
            '</div>';
        codeBlocks.push(html);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    
    // Store inline code
    const inlineCodes = [];
    formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
        inlineCodes.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
        return `__INLINE_${inlineCodes.length - 1}__`;
    });
    
    // Escape HTML
    formatted = escapeHtml(formatted);
    
    // Restore placeholders
    codeBlocks.forEach((block, i) => {
        formatted = formatted.replace(`__CODE_BLOCK_${i}__`, block);
    });
    inlineCodes.forEach((code, i) => {
        formatted = formatted.replace(`__INLINE_${i}__`, code);
    });
    
    // Headers
    formatted = formatted.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // Horizontal rules
    formatted = formatted.replace(/^---+$/gm, '<hr>');
    
    // Bold and italic
    formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Lists
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Paragraphs
    const parts = formatted.split(/\n\n+/);
    formatted = parts.map(p => {
        p = p.trim();
        if (!p) return '';
        if (/^<(h[2-4]|ul|ol|hr|div|li)/.test(p)) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    
    return formatted || '<p></p>';
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function copyCode(codeId) {
    // First try to get original code from our store (preserves exact formatting)
    let codeText = window.codeBlockStore && window.codeBlockStore[codeId];
    
    // Fallback to DOM if not in store
    if (!codeText) {
        const el = document.getElementById(codeId);
        if (!el) {
            console.error('Code element not found:', codeId);
            showToast('Code element not found', 'error');
            return;
        }
        codeText = el.innerText || el.textContent;
    }
    
    const btn = document.querySelector(`[data-code-id="${codeId}"]`);
    
    // Debug logging
    console.log('Code to copy (first 200 chars):', codeText.substring(0, 200));
    console.log('Total code length:', codeText.length);
    
    navigator.clipboard.writeText(codeText).then(() => {
        if (btn) {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
        }
        showToast('Code copied to clipboard!', 'success');
    }).catch(err => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = codeText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            if (btn) {
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
            }
            showToast('Code copied to clipboard!', 'success');
        } catch (e) {
            showToast('Failed to copy', 'error');
        }
        document.body.removeChild(textarea);
    });
}
window.copyCode = copyCode;

function updateStatus(text) {
    if (status) status.textContent = text;
}

function showToast(message, type = 'info') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    // Ensure message is a string
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-message">${escapeHtml(msg)}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Make functions available globally
window.loadChat = loadChat;
window.deleteChat = deleteChat;

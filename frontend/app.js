let ws;
let userTags = [];
let textRotationInterval = null;
let isWaitingToJoin = false; 
let isConnected = false; // Active connection state tracker

const loadingPhrases = [
    "Calibrating interest vectors...",
    "Scanning active anonymous nodes...",
    "Filtering matching frequencies...",
    "Knocking on secure tunnels...",
    "Routing downbound pathways...",
    "Encrypting session tokens...",
    "Checking tag overlaps...",
    "Almost there, formatting the chatroom..."
];

// DOM Element Selectors
const homeView = document.getElementById('homeView');
const matchOverlay = document.getElementById('matchOverlay');
const overlayStatusMsg = document.getElementById('overlayStatusMsg');
const messagesBox = document.getElementById('messagesBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const tagInput = document.getElementById('tagInput');
const tagChips = document.getElementById('tagChips');

// Action Deck Control Elements
const skipBtn = document.getElementById('skipBtn');
const endBtn = document.getElementById('endBtn');

// Sidebar Control Handles (Desktop)
const statusDot = document.getElementById('statusDot');
const statusTxt = document.getElementById('statusTxt');
const timerVal = document.getElementById('timerVal');

// Navbar Control Handles (Mobile Layout Split)
const mobileStatusDot = document.getElementById('mobileStatusDot');
const mobileStatusTxt = document.getElementById('mobileStatusTxt');
const mobileTimerVal = document.getElementById('mobileTimerVal');

function initSocket() {
    console.log("Initializing protocol channel connection...");
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsUrl = isLocalhost 
        ? 'ws://127.0.0.1:4000/ws' 
        : 'wss://oneminutechat-rpl3.onrender.com/ws'; 

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("Secure network link consolidated.");
        if (isWaitingToJoin) {
            isWaitingToJoin = false;
            executeJoinPacket();
        }
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("Packet downbound stream:", msg);
        
        switch (msg.type) {
            case 'status':
                // INTERCEPT: If we were connected and receive a status update, the stranger left!
                if (isConnected) {
                    isConnected = false;
                    appendMessage('sys', "❌ Stranger disconnected early.");
                    toggleActionDeck(true);
                    
                    // Delay the radar overlay slightly so the user can read the chatbox notice
                    setTimeout(() => {
                        if (!isConnected && !homeView.classList.contains('hidden')) {
                            matchOverlay.classList.remove('hidden');
                            updateUIState('matching', 'Finding a new partner...');
                            startTextRotation("Stranger disconnected early. Finding a new partner...");
                        }
                    }, 1200);
                } else {
                    updateUIState('matching', msg.payload);
                    if (!textRotationInterval) {
                        startTextRotation(msg.payload);
                    }
                }
                break;
                
            case 'match_found':
                console.log("Match verified. Unlocking conversation fields.");
                isConnected = true;
                stopTextRotation();
                messagesBox.innerHTML = ''; 
                matchOverlay.classList.add('hidden');
                homeView.classList.add('hidden');
                updateUIState('connected', 'Connected to Stranger');
                
                toggleActionDeck(false);
                msgInput.focus();
                break;
                
            case 'chat_message':
                appendMessage('them', msg.payload.text);
                break;
                
            case 'timer':
                const secs = msg.payload.remaining_seconds;
                updateTimerDisplay(`00:${secs < 10 ? '0' : ''}${secs}`);
                
                // If timer runs out naturally, reset state
                if (secs === 0) {
                    isConnected = false;
                    appendMessage('sys', "⏳ Time is up! Session dissolved.");
                    toggleActionDeck(true);
                }
                break;
        }
    };

    ws.onclose = () => {
        stopTextRotation();
        updateUIState('disconnected', 'Disconnected');
        
        if (homeView.classList.contains('hidden')) {
            overlayStatusMsg.innerText = 'Uplink dropped by phone. Re-establishing connection...';
            isWaitingToJoin = true; 
        }
        
        isConnected = false;
        toggleActionDeck(true);
        setTimeout(initSocket, 2000); 
    };
}

function launchMatchmaking() {
    homeView.classList.add('hidden');
    matchOverlay.classList.remove('hidden');
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("Socket not open yet. Queuing matchmaking packet operation...");
        isWaitingToJoin = true;
        updateUIState('matching', 'Waking up secure server channel...');
        startTextRotation("Waking up secure server channel...");
        return;
    }

    executeJoinPacket();
}

function executeJoinPacket() {
    isConnected = false;
    updateUIState('matching', 'Searching for a stranger...');
    startTextRotation("Searching for a stranger...");
    console.log("Submitting match protocol request with tracking tags:", userTags);
    ws.send(JSON.stringify({
        type: 'join',
        payload: { tags: userTags }
    }));
}

function sendCancel() {
    console.log("Canceling matchmaking procedure. Transmitting queue eviction frame.");
    isWaitingToJoin = false;
    isConnected = false;
    stopTextRotation();
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'cancel' }));
    }
    showHome();
}

function sendDisconnect() {
    console.log("Forcing immediate session termination. Re-routing straight to Home.");
    messagesBox.innerHTML = '';
    updateTimerDisplay("01:00");
    isConnected = false;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'cancel' }));
    }
    showHome();
}

function startTextRotation(initialBackendMsg) {
    stopTextRotation();
    overlayStatusMsg.innerText = initialBackendMsg;
    
    let phraseIndex = 0;
    textRotationInterval = setInterval(() => {
        overlayStatusMsg.style.animation = 'none';
        void overlayStatusMsg.offsetWidth; 
        overlayStatusMsg.style.animation = 'text-fade-in 0.4s ease-out';
        
        overlayStatusMsg.innerText = loadingPhrases[phraseIndex];
        phraseIndex = (phraseIndex + 1) % loadingPhrases.length;
    }, 2800);
}

function stopTextRotation() {
    if (textRotationInterval) {
        clearInterval(textRotationInterval);
        textRotationInterval = null;
    }
}

function showHome() {
    stopTextRotation();
    isWaitingToJoin = false;
    isConnected = false;
    homeView.classList.remove('hidden');
    matchOverlay.classList.add('hidden');
    updateUIState('home', 'Home Dashboard');
    toggleActionDeck(true);
}

function handleTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        // Convert the tag to lowercase immediately to prevent iOS capitalization bugs
        const tag = tagInput.value.trim().replace(/,/g, '').toLowerCase();
        if (tag && !userTags.includes(tag)) {
            userTags.push(tag);
            renderChips();
        }
        tagInput.value = '';
    }
}

function removeTag(tag) {
    userTags = userTags.filter(t => t !== tag);
    renderChips();
}

function renderChips() {
    tagChips.innerHTML = '';
    userTags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.innerHTML = `${tag} <i class="fa-solid fa-xmark" onclick="removeTag('${tag}')"></i>`;
        tagChips.appendChild(chip);
    });
}

function toggleActionDeck(shouldDisable) {
    msgInput.disabled = shouldDisable;
    sendBtn.disabled = shouldDisable;
    skipBtn.disabled = shouldDisable;
    endBtn.disabled = shouldDisable;
    
    const targetOpacity = shouldDisable ? "0.4" : "1";
    const targetCursor = shouldDisable ? "not-allowed" : "pointer";
    
    skipBtn.style.opacity = targetOpacity;
    skipBtn.style.cursor = targetCursor;
    endBtn.style.opacity = targetOpacity;
    endBtn.style.cursor = targetCursor;
    
    if (shouldDisable) msgInput.value = '';
}

function updateUIState(state, text) {
    statusTxt.innerText = text;
    mobileStatusTxt.innerText = text;
    
    statusDot.className = 'dot';
    mobileStatusDot.className = 'dot';
    
    if (state === 'connected') {
        statusDot.classList.add('active');
        mobileStatusDot.classList.add('active');
    } else if (state === 'matching') {
        statusDot.classList.add('matching');
        mobileStatusDot.classList.add('matching');
    }
}

function updateTimerDisplay(timeString) {
    timerVal.innerText = timeString;
    mobileTimerVal.innerText = timeString;
}

function appendMessage(classification, text) {
    const row = document.createElement('div');
    row.className = `msg-row ${classification}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerText = text;
    row.appendChild(bubble);
    messagesBox.appendChild(row);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !isConnected) return;

    ws.send(JSON.stringify({
        type: 'send_message',
        payload: { text }
    }));
    
    appendMessage('me', text);
    msgInput.value = '';
}

function sendSkip() {
    console.log("Skip initiated. Forcing clean local interface reset.");
    messagesBox.innerHTML = '';
    updateTimerDisplay("01:00");
    isConnected = false;
    
    startTextRotation("Searching for a stranger...");
    updateUIState('matching', 'Searching for a stranger...');
    matchOverlay.classList.remove('hidden');
    toggleActionDeck(true);

    ws.send(JSON.stringify({ type: 'skip' }));
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

initSocket();
let ws;
let userTags = [];
let textRotationInterval = null;
let isWaitingToJoin = false; // Tracks if the user clicked join while socket was connecting

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
        // If they clicked start chatting while it was disconnected, process the action now
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
                updateUIState('matching', msg.payload);
                if (!textRotationInterval) {
                    startTextRotation(msg.payload);
                }
                break;
                
            case 'match_found':
                console.log("Match verified. Unlocking conversation fields.");
                stopTextRotation();
                messagesBox.innerHTML = ''; 
                matchOverlay.classList.add('hidden');
                homeView.classList.add('hidden');
                updateUIState('connected', 'Connected to Stranger');
                
                msgInput.disabled = false;
                sendBtn.disabled = false;
                msgInput.focus();
                break;
                
            case 'chat_message':
                appendMessage('them', msg.payload.text);
                break;
                
            case 'timer':
                const secs = msg.payload.remaining_seconds;
                updateTimerDisplay(`00:${secs < 10 ? '0' : ''}${secs}`);
                break;
        }
    };

    ws.onclose = () => {
        stopTextRotation();
        updateUIState('disconnected', 'Disconnected');
        
        // If they are in the middle of matching, let them know we are recovering the link smoothly
        if (homeView.classList.contains('hidden')) {
            overlayStatusMsg.innerText = 'Uplink dropped by phone. Re-establishing connection...';
            isWaitingToJoin = true; // Auto-re-enqueue them once back online
        }
        
        setTimeout(initSocket, 2000); // Quick retry window
    };
}

function launchMatchmaking() {
    // Show the radar screen immediately to provide instant visual feedback
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
    updateUIState('matching', 'Searching for a stranger... ');
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
    stopTextRotation();
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
    homeView.classList.remove('hidden');
    matchOverlay.classList.add('hidden');
    updateUIState('home', 'Home Dashboard');
    msgInput.disabled = true;
    sendBtn.disabled = true;
}

function handleTagKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = tagInput.value.trim().replace(/,/g, '');
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
    if (!text) return;

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
    
    startTextRotation("Searching for a stranger...");
    
    updateUIState('matching', 'Searching for a stranger...');
    matchOverlay.classList.remove('hidden');
    msgInput.disabled = true;
    sendBtn.disabled = true;

    ws.send(JSON.stringify({ type: 'skip' }));
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

initSocket();
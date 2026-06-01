let ws;
let userTags = [];

// DOM Element Selectors
const homeView = document.getElementById('homeView');
const matchOverlay = document.getElementById('matchOverlay');
const overlayStatusMsg = document.getElementById('overlayStatusMsg');
const messagesBox = document.getElementById('messagesBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const tagInput = document.getElementById('tagInput');
const tagChips = document.getElementById('tagChips');

// Sidebar Control Handles
const statusDot = document.getElementById('statusDot');
const statusTxt = document.getElementById('statusTxt');
const timerVal = document.getElementById('timerVal');

function initSocket() {
    console.log("Initializing protocol channel connection...");
    
    // Change this string to your production wss:// url when deploying to Render
    ws = new WebSocket('ws://127.0.0.1:4000/ws');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("Packet downbound stream:", msg);
        
        switch (msg.type) {
            case 'status':
                updateUIState('matching', msg.payload);
                overlayStatusMsg.innerText = msg.payload;
                matchOverlay.classList.remove('hidden');
                homeView.classList.add('hidden');
                
                msgInput.disabled = true;
                sendBtn.disabled = true;
                updateTimerDisplay("01:00");
                break;
                
            case 'match_found':
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
        updateUIState('disconnected', 'Disconnected');
        overlayStatusMsg.innerText = 'Network link disrupted. Reconnecting...';
        matchOverlay.classList.remove('hidden');
        setTimeout(initSocket, 3000);
    };
}

function launchMatchmaking() {
    console.log("Submitting match protocol request with tracking tags:", userTags);
    ws.send(JSON.stringify({
        type: 'join',
        payload: { tags: userTags }
    }));
}

function showHome() {
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
    statusDot.className = 'dot';
    
    if (state === 'connected') statusDot.classList.add('active');
    else if (state === 'matching') statusDot.classList.add('matching');
}

function updateTimerDisplay(timeString) {
    timerVal.innerText = timeString;
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
    
    // Reset layout states instantly to remove instant-rematch latency perception
    messagesBox.innerHTML = '';
    updateUIState('matching', 'Searching for a stranger...');
    overlayStatusMsg.innerText = 'Searching for a stranger...';
    matchOverlay.classList.remove('hidden');
    msgInput.disabled = true;
    sendBtn.disabled = true;
    updateTimerDisplay("01:00");

    ws.send(JSON.stringify({ type: 'skip' }));
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

initSocket();
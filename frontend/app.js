let ws;

// DOM Elements Lookups
const messagesBox = document.getElementById('messagesBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const matchOverlay = document.getElementById('matchOverlay');
const overlayStatusMsg = document.getElementById('overlayStatusMsg');

// Desktop Elements Lookups
const statusDot = document.getElementById('statusDot');
const statusTxt = document.getElementById('statusTxt');
const timerVal = document.getElementById('timerVal');

// Mobile Elements Lookups
const mobileStatusDot = document.getElementById('mobileStatusDot');
const mobileStatusTxt = document.getElementById('mobileStatusTxt');
const mobileTimerVal = document.getElementById('mobileTimerVal');

function connect() {
    console.log("Initializing protocol channel connection...");
    
    // Change this string to your production wss:// url when deploying to Render
    ws = new WebSocket('ws://127.0.0.1:4000/ws');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("Network frame received:", msg);
        
        switch (msg.type) {
            case 'status':
                updateUIState('matching', msg.payload);
                overlayStatusMsg.innerText = msg.payload;
                matchOverlay.classList.remove('hidden');
                
                msgInput.disabled = true;
                sendBtn.disabled = true;
                updateTimerDisplays("01:00");
                break;
                
            case 'match_found':
                console.log("Match verified. Unlocking conversation fields.");
                messagesBox.innerHTML = ''; 
                matchOverlay.classList.add('hidden');
                updateUIState('connected', 'Connected to Stranger');
                
                msgInput.disabled = false;
                sendBtn.disabled = false;
                msgInput.focus();
                break;
                
            case 'chat_message':
                // Messages arriving from the server are exclusively from the stranger
                appendMessage('them', msg.payload.text);
                break;
                
            case 'timer':
                const secs = msg.payload.remaining_seconds;
                const formattedTime = `00:${secs < 10 ? '0' : ''}${secs}`;
                updateTimerDisplays(formattedTime);
                break;
        }
    };

    ws.onclose = () => {
        console.warn("Connection link dropped.");
        updateUIState('disconnected', 'Disconnected');
        overlayStatusMsg.innerText = 'Connection lost. Reconnecting to interface...';
        matchOverlay.classList.remove('hidden');
        msgInput.disabled = true;
        sendBtn.disabled = true;
        
        setTimeout(connect, 3000);
    };
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

function updateTimerDisplays(timeString) {
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
    
    // Render your own bubble instantly on click/enter
    appendMessage('me', text);
    msgInput.value = '';
}

function sendSkip() {
    ws.send(JSON.stringify({ type: 'skip' }));
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

connect();
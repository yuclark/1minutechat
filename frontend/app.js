let ws;
const statusLabel = document.getElementById('statusLabel');
const timerBadge = document.getElementById('timerBadge');
const timerEl = document.getElementById('timer');
const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const searchOverlay = document.getElementById('searchOverlay');
const searchStatus = document.getElementById('searchStatus');

function connect() {
    // Note: When deploying to Render, swap this string to your live wss:// URL
    ws = new WebSocket('ws://127.0.0.1:4000/ws');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
            case 'status':
                appendMessage('system', msg.payload);
                if (msg.payload.includes('Searching')) {
                    statusLabel.innerHTML = `<span style="color: #6366f1">●</span> Matchmaking`;
                    searchStatus.innerText = msg.payload;
                    searchOverlay.classList.remove('hidden');
                    msgInput.disabled = true;
                    sendBtn.disabled = true;
                    timerBadge.classList.remove('timer-urgent');
                    timerEl.innerText = "01:00";
                }
                break;
                
            case 'match_found':
                messagesEl.innerHTML = ''; 
                searchOverlay.classList.add('hidden');
                statusLabel.innerHTML = `<span style="color: #10b981">●</span> Stranger`;
                msgInput.disabled = false;
                sendBtn.disabled = false;
                msgInput.focus();
                break;
                
            case 'chat_message':
                const senderClass = msg.payload.sender.toLowerCase() === 'you' ? 'you' : 'stranger';
                appendMessage(senderClass, msg.payload.text);
                break;
                
            case 'timer':
                const secs = msg.payload.remaining_seconds;
                timerEl.innerText = `00:${secs < 10 ? '0' : ''}${secs}`;
                
                // Add the heartbeat glow animation when time drops below 10 seconds
                if (secs <= 10) {
                    timerBadge.classList.add('timer-urgent');
                } else {
                    timerBadge.classList.remove('timer-urgent');
                }
                break;
        }
    };

    ws.onclose = () => {
        statusLabel.innerHTML = `<span style="color: #ef4444">●</span> Disconnected`;
        searchStatus.innerText = 'Connection lost. Reconnecting...';
        searchOverlay.classList.remove('hidden');
        msgInput.disabled = true;
        sendBtn.disabled = true;
        setTimeout(connect, 3000);
    };
}

function appendMessage(type, text) {
    const div = document.createElement('div');
    div.className = `bubble ${type}`;
    div.innerText = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    ws.send(JSON.stringify({
        type: 'send_message',
        payload: { text }
    }));
    
    msgInput.value = '';
}

function sendSkip() {
    ws.send(JSON.stringify({ type: 'skip' }));
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

connect();
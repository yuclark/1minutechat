let ws;
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const messagesEl = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

function connect() {
    ws = new WebSocket('ws://127.0.0.1:4000/ws');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
            case 'status':
                appendMessage('system', msg.payload);
                statusEl.innerText = msg.payload.includes('Searching') ? 'Searching...' : 'Connected';
                if (msg.payload.includes('Searching')) {
                    msgInput.disabled = true;
                    sendBtn.disabled = true;
                    timerEl.innerText = "01:00";
                }
                break;
                
            case 'match_found':
                messagesEl.innerHTML = ''; // Clear chat history for the new match
                appendMessage('system', 'You are now chatting with a random stranger!');
                statusEl.innerText = 'Connected';
                msgInput.disabled = false;
                sendBtn.disabled = false;
                msgInput.focus();
                break;
                
            case 'chat_message':
                const senderClass = msg.payload.sender.toLowerCase() === 'you' ? 'you' : 'stranger';
                appendMessage(senderClass, `${msg.payload.sender}: ${msg.payload.text}`);
                break;
                
            case 'timer':
                const secs = msg.payload.remaining_seconds;
                timerEl.innerText = `00:${secs < 10 ? '0' : ''}${secs}`;
                break;
        }
    };

    ws.onclose = () => {
        statusEl.innerText = 'Disconnected';
        appendMessage('system', 'Connection lost. Retrying in 3 seconds...');
        msgInput.disabled = true;
        sendBtn.disabled = true;
        setTimeout(connect, 3000);
    };
}

function appendMessage(type, text) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
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

// Start connection on load
connect();

import express from 'express';
import http  from "http";

import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- In-memory room management (2 peers max per room) ---
const rooms = new Map(); // roomId -> Set<ws>

function getOtherPeer(ws) {
  const set = rooms.get(ws.roomId);
  if (!set) return null;
  for (const peer of set) {
    if (peer !== ws) return peer;
  }
  return null;
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const roomId = String(msg.room || 'lobby');
      const username = String(msg.user || 'Guest');
      let set = rooms.get(roomId);
      if (!set) { set = new Set(); rooms.set(roomId, set); }

      if (set.size >= 2) {
        ws.send(JSON.stringify({ type: 'room-full', room: roomId }));
        ws.close();
        return;
      }

      ws.roomId = roomId;
      ws.username = username;
      set.add(ws);

      if (set.size === 1) {
        // first peer becomes leader (will create DataChannel)
        ws.role = 'leader';
        ws.send(JSON.stringify({ type: 'room-status', role: 'leader', room: roomId }));
      } else if (set.size === 2) {
        // notify leader that a follower joined, so it should create an offer
        const leader = [...set].find(p => p.role === 'leader') || [...set][0];
        const follower = [...set].find(p => p !== leader);
        leader.send(JSON.stringify({ type: 'peer-joined', user: username }));
        follower.role = 'follower';
        follower.send(JSON.stringify({ type: 'room-status', role: 'follower', room: roomId }));
      }
      return;
    }

    if (msg.type === 'signal') {
      // forward SDP/ICE to the other peer
      const other = getOtherPeer(ws);
      if (other && other.readyState === 1) {
        other.send(JSON.stringify({ type: 'signal', data: msg.data }));
      }
      return;
    }

    if (msg.type === 'goodbye') {
      ws.close();
      return;
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    const set = rooms.get(roomId);
    if (set) {
      set.delete(ws);
      const other = [...set][0];
      if (other && other.readyState === 1) {
        other.send(JSON.stringify({ type: 'peer-left' }));
      }
      if (set.size === 0) rooms.delete(roomId);
    }
  });
});

// --- SSR page ---
app.get('/', (req, res) => {
 
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/privacy-policy',(req, res) => {
    res.send(privacyAndPolicy)
})

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ P2P chat running on  http://localhost:${PORT}\nOpen this URL in two different browsers/devices, join the same room, and chat!`);
});

 const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>P2P Chat (WebRTC, SSR, Single File)</title>
  <style>
    :root {
      --bg: #0b0f14;
      --card: #121826;
      --text: #e6edf3;
      --muted: #9fb0c3;
      --accent: #4da3ff;
      --accent-hover: #6bb5ff;
      --success: #3fb27f;
      --warning: #ff994d;
      --error: #ff4d4d;
      --border: #253044;
      --input-bg: #0f1522;
      --msg-bg: #1a2235;
      --msg-me: #19324a;
      --msg-sys: rgba(159, 176, 195, 0.15);
      --online: #3fb27f;
      --offline: #9fb0c3;
      --typing: #4da3ff;
    }
    
    * { 
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body { 
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; 
      background: var(--bg); 
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .wrap { 
      width: 100%;
      max-width: 1000px;
      margin: 0 auto;
    }
    
    .card { 
      background: var(--card); 
      border-radius: 20px; 
      padding: 24px; 
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      overflow: hidden;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 700;
    }
    
    .title-icon {
      background: linear-gradient(135deg, var(--accent), #2b7de0);
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(77, 163, 255, 0.25);
    }
    
    .status-badge {
      background: var(--msg-sys);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
    }
    
    .topbar { 
      display: flex; 
      gap: 12px; 
      align-items: center; 
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .pill { 
      padding: 6px 12px; 
      border-radius: 12px; 
      border: 1px solid var(--border); 
      color: var(--muted);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 21, 34, 0.5);
    }
    
    .pill b { 
      color: var(--text);
      font-weight: 600;
    }
    
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    
    .status-online { background: var(--online); }
    .status-offline { background: var(--offline); }
    .status-connecting { background: var(--warning); animation: pulse 1.5s infinite; }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    
    .chat-container {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 20px;
    }
    
    @media (max-width: 768px) {
      .chat-container {
        grid-template-columns: 1fr;
      }
    }
    
    .chat-main {
      display: flex;
      flex-direction: column;
    }
    
    .chat-sidebar {
      background: rgba(15, 21, 34, 0.5);
      border-radius: 16px;
      padding: 16px;
      border: 1px solid var(--border);
    }
    
    .sidebar-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    #messages { 
      height: 400px; 
      overflow-y: auto; 
      border: 1px solid var(--border); 
      border-radius: 16px; 
      padding: 16px; 
      background: var(--input-bg);
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
      scroll-behavior: smooth;
    }
    
    /* Custom scrollbar for messages */
    #messages::-webkit-scrollbar {
      width: 6px;
    }
    
    #messages::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #messages::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    
    #messages::-webkit-scrollbar-thumb:hover {
      background: var(--muted);
    }
    
    .msg { 
      padding: 12px 16px; 
      margin: 0;
      border-radius: 16px; 
      background: var(--msg-bg);
      max-width: 80%;
      align-self: flex-start;
      animation: fadeIn 0.3s ease;
      position: relative;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .me { 
      background: var(--msg-me); 
      align-self: flex-end;
    }
    
    .msg-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    
    .msg-content {
      word-break: break-word;
    }
    
    .sys { 
      background: var(--msg-sys);
      color: var(--muted);
      font-style: italic;
      align-self: center;
      max-width: 90%;
      text-align: center;
      font-size: 14px;
    }
    
    #typing { 
      height: 22px; 
      color: var(--typing);
      font-size: 14px;
      margin-bottom: 12px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .typing-indicator {
      display: flex;
      gap: 4px;
    }
    
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--typing);
      opacity: 0.6;
      animation: typingAnimation 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingAnimation {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.6;
      }
      30% {
        transform: translateY(-5px);
        opacity: 1;
      }
    }
    
    .input-group {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    input, button { 
      border-radius: 12px; 
      border: 1px solid var(--border); 
      background: var(--input-bg); 
      color: var(--text); 
      padding: 12px 16px;
      font-family: inherit;
      font-size: 14px;
      transition: all 0.2s ease;
    }
    
    input:focus { 
      outline: none; 
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.2);
    }
    
    button { 
      background: linear-gradient(to right, var(--accent), #2b7de0);
      border: none;
      color: white;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    
    button:hover {
      background: linear-gradient(to right, var(--accent-hover), #3c8ce6);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(77, 163, 255, 0.3);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .footer { 
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      gap: 12px;
      margin-top: 16px;
    }
    
    @media (max-width: 640px) {
      .footer {
        grid-template-columns: 1fr;
      }
    }
    
    .status { 
      font-size: 12px; 
      color: var(--muted);
      margin-top: 16px;
      text-align: center;
    }
    
    a { 
      color: var(--accent); 
      text-decoration: none;
      transition: color 0.2s;
    }
    
    a:hover {
      color: var(--accent-hover);
      text-decoration: underline;
    }
    
    /* Connection state styles */
    .state-new { color: var(--muted); }
    .state-connecting { color: var(--warning); }
    .state-connected { color: var(--success); }
    .state-disconnected { color: var(--error); }
    .state-failed { color: var(--error); }
    .state-closed { color: var(--muted); }
    
    /* User list in sidebar */
    .user-list {
      list-style: none;
    }
    
    .user-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(37, 48, 68, 0.3);
    }
    
    .user-item:last-child {
      border-bottom: none;
    }
    
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4da3ff, #3fb27f);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }
    
    .user-details {
      flex: 1;
    }
    
    .user-name {
      font-weight: 500;
      font-size: 14px;
    }
    
    .user-role {
      font-size: 12px;
      color: var(--muted);
    }
    
    /* Animation for new messages */
    @keyframes highlight {
      0% { background-color: rgba(77, 163, 255, 0.2); }
      100% { background-color: transparent; }
    }
    
    .highlight {
      animation: highlight 1.5s ease;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div class="title">
          <div class="title-icon">⚡</div>
          <h1>P2P Chat</h1>
        </div>
        <div class="status-badge" id="role">Unknown</div>
      </div>
      
      <div class="topbar">
        <div class="pill">
          <span class="status-indicator status-online" id="connectionIndicator"></span>
          Room: <b id="roomLabel">lobby</b>
        </div>
        <div class="pill">
          <span class="status-indicator status-offline" id="userIndicator"></span>
          User: <b id="userLabel">User123</b>
        </div>
        <div class="pill" id="connState">
          <span class="status-indicator state-new"></span>
          Connecting...
        </div>
      </div>
      
      <div class="chat-container">
        <div class="chat-main">
          <div id="messages"></div>
          <div id="typing"></div>
          
          <div class="input-group">
            <input id="msg" placeholder="Type a message and hit Enter" autocomplete="off" />
            <button id="sendBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Send
            </button>
          </div>
          
          <div class="footer">
            <input id="room" placeholder="room id (optional)" />
            <input id="user" placeholder="your name (optional)" />
            <button id="joinBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 21V19C19 17.9391 18.5786 16.9217 17.8284 16.1716C17.0783 15.4214 16.0609 15 15 15H9C7.93913 15 6.92172 15.4214 6.17157 16.1716C5.42143 16.9217 5 17.9391 5 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Join / Rejoin
            </button>
            <button id="leaveBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Leave
            </button>
          </div>
          
          <div class="status">
            Tip: open this page in two browsers with the same room to chat peer-to-peer. Uses WebRTC DataChannel; WebSocket is only for signaling.
          </div>
           <div class="status" style="margin-top:8px;">
                <a href="/privacy-policy" target="_blank" style="color:var(--accent);font-weight:500;text-decoration:underline;">
                    📜 Read our Privacy Policy
                </a>
            </div>
        </div>
        
        <div class="chat-sidebar">
          <div class="sidebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Online Users
          </div>
          <ul class="user-list" id="userList">
            <li class="user-item">
              <div class="user-avatar">Y</div>
              <div class="user-details">
                <div class="user-name">You</div>
                <div class="user-role" id="userRole">Unknown</div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <script>
    // --- helpers ---
    const qs = new URLSearchParams(location.search);
    const $ = (id) => document.getElementById(id);
    const messages = $('messages');
    const typing = $('typing');
    const input = $('msg');
    const sendBtn = $('sendBtn');
    const roleEl = $('role');
    const userRoleEl = $('userRole');
    const roomInput = $('room');
    const userInput = $('user');
    const joinBtn = $('joinBtn');
    const leaveBtn = $('leaveBtn');
    const connState = $('connState');
    const roomLabel = $('roomLabel');
    const userLabel = $('userLabel');
    const connectionIndicator = $('connectionIndicator');
    const userIndicator = $('userIndicator');
    const userList = $('userList');

    let ws; // signaling
    let pc; // RTCPeerConnection
    let dc; // RTCDataChannel
    let role = 'unknown';
    let room = qs.get('room') || 'lobby';
    let username = qs.get('user') || ('User' + Math.floor(Math.random()*1000));
    let typingTimeout;
    
    roomInput.value = room; 
    userInput.value = username;
    roomLabel.textContent = room; 
    userLabel.textContent = username;
    userRoleEl.textContent = role;

    function logMsg(text, cls='', user='') {
      const div = document.createElement('div');
      div.className = 'msg ' + cls;
      
      if (cls !== 'sys') {
        const header = document.createElement('div');
        header.className = 'msg-header';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = user || (cls === 'me' ? 'You' : 'Peer');
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        header.appendChild(nameSpan);
        header.appendChild(timeSpan);
        div.appendChild(header);
      }
      
      const content = document.createElement('div');
      content.className = 'msg-content';
      content.textContent = text;
      div.appendChild(content);
      
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
      
      // Add highlight animation
      div.classList.add('highlight');
    }

    function setConnState() {
      const s = pc ? pc.connectionState : 'new';
      connState.textContent = 'State: ' + s;
      connState.className = 'pill state-' + s;
      
      // Update connection indicator
      connectionIndicator.className = 'status-indicator';
      if (s === 'connected') {
        connectionIndicator.classList.add('status-online');
      } else if (s === 'connecting' || s === 'checking') {
        connectionIndicator.classList.add('status-connecting');
      } else {
        connectionIndicator.classList.add('status-offline');
      }
      
      // Update user indicator
      userIndicator.className = 'status-indicator';
      if (ws && ws.readyState === WebSocket.OPEN) {
        userIndicator.classList.add('status-online');
      } else {
        userIndicator.classList.add('status-offline');
      }
    }

    function connectSignaling() {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      
      // Update UI to show connecting state
      setConnState();
      
      // ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws = new WebSocket('wss://real-chat-with-ankit.vercel.app');
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', room, user: username }));
        setConnState();
      };
      ws.onclose = () => {
        logMsg('Disconnected from signaling server', 'sys');
        setConnState();
      };
      ws.onerror = () => {
        logMsg('Error connecting to signaling server', 'sys');
        setConnState();
      };
      ws.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'room-full') { 
          logMsg('Room is full. Try another.', 'sys'); 
          return; 
        }
        if (m.type === 'room-status') {
          role = m.role; 
          roleEl.textContent = role;
          userRoleEl.textContent = role;
          logMsg('Joined room as ' + role, 'sys');
          if (role === 'leader') preparePeer(true);
          if (role === 'follower') preparePeer(false);
          return;
        }
        if (m.type === 'peer-joined') {
          logMsg('Peer joined: starting offer...', 'sys');
          // leader creates the offer when peer joins
          if (role === 'leader' && pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'signal', data: { sdp: pc.localDescription } }));
          }
          return;
        }
        if (m.type === 'peer-left') {
          logMsg('Peer left the room', 'sys');
          cleanupPeer();
          return;
        }
        if (m.type === 'signal') {
          const data = m.data;
          if (data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'signal', data: { sdp: pc.localDescription } }));
            }
          } else if (data.candidate) {
            try { 
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); 
            } catch (e) { 
              console.warn('ICE add error', e); 
            }
          }
        }
      };
    }

    function preparePeer(isLeader) {
      // ICE servers include a public STUN; for production add TURN for NAT traversal
      pc = new RTCPeerConnection({ 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
      });
      
      pc.onicecandidate = (e) => { 
        if (e.candidate) {
          ws.send(JSON.stringify({ type:'signal', data: { candidate: e.candidate } })); 
        }
      };
      
      pc.onconnectionstatechange = () => {
        setConnState();
        if (pc.connectionState === 'connected') {
          logMsg('Peer connection established successfully!', 'sys');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          logMsg('Peer connection lost', 'sys');
        }
      };
      
      setConnState();

      if (isLeader) {
        dc = pc.createDataChannel('chat');
        bindDataChannel(dc);
      } else {
        pc.ondatachannel = (ev) => { 
          dc = ev.channel; 
          bindDataChannel(dc); 
        };
      }
    }

    function bindDataChannel(channel) {
      channel.onopen = () => { 
        logMsg('DataChannel open ✔', 'sys'); 
        setConnState();
      };
      
      channel.onclose = () => { 
        logMsg('DataChannel closed', 'sys'); 
        setConnState();
      };
      
      channel.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.kind === 'typing') {
            typing.innerHTML = 
              '<span>' + payload.user + ' is typing</span>' +
              '<div class="typing-indicator">' +
                '<div class="typing-dot"></div>' +
                '<div class="typing-dot"></div>' +
                '<div class="typing-dot"></div>' +
              '</div>';
            typing.classList.add('active');

            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
              typing.textContent = '';
            }, 2000);
          }
          
          if (payload.kind === 'message') {
            typing.textContent = '';
            logMsg(payload.text, '', payload.user);
          }
        } catch (e) { 
          console.warn('Failed to parse message:', e); 
        }
      };
    }

    function cleanupPeer() {
      if (dc) { 
        try { dc.close(); } catch (e) {} 
        dc = null; 
      }
      
      if (pc) { 
        try { pc.close(); } catch (e) {} 
        pc = null; 
        setConnState(); 
      }
    }

    // --- UI wiring ---
    sendBtn.onclick = () => {
      const text = input.value.trim();
      if (!text || !dc || dc.readyState !== 'open') return;
      
      dc.send(JSON.stringify({ kind: 'message', text, user: username }));
      logMsg(text, 'me', username);
      input.value = '';
    };
    
    input.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter') sendBtn.click(); 
    });
    
    input.addEventListener('input', () => {
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ kind: 'typing', user: username }));
      }
    });

    joinBtn.onclick = () => {
      const newRoom = roomInput.value.trim() || 'lobby';
      const newUser = userInput.value.trim() || username;
      
      room = newRoom; 
      username = newUser;
      roomLabel.textContent = room; 
      userLabel.textContent = username;
      
      // Clear messages
      messages.innerHTML = '';
      
      cleanupPeer();
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      
      connectSignaling();
    };

    leaveBtn.onclick = () => {
      cleanupPeer();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'goodbye' }));
        ws.close();
      }
      
      logMsg('You left the room', 'sys');
      setConnState();
    };

    // auto connect on load
    connectSignaling();
  </script>
</body>
</html>`;

const privacyAndPolicy = `
    <style>
        .privacy-container {
            background: var(--card, #121826);
            color: var(--text, #e6edf3);
            border-radius: 16px;
            padding: 32px;
            max-width: 700px;
            margin: 40px auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.7;
        }
        .privacy-container h2 {
            font-size: 2rem;
            margin-bottom: 18px;
            color: var(--accent, #4da3ff);
            font-weight: 700;
        }
        .privacy-container h3 {
            font-size: 1.2rem;
            margin-top: 24px;
            margin-bottom: 10px;
            color: var(--muted, #9fb0c3);
            font-weight: 600;
        }
        .privacy-container p {
            margin-bottom: 12px;
        }
    </style>
    <div class="privacy-container">
        <h2>Privacy Policy</h2>
        <p>Your privacy is important to us. This privacy policy explains how we collect, use, and protect your information.</p>
        <h3>Information We Collect</h3>
        <p>We may collect personal information such as your name, email address, and usage data.</p>
        <h3>How We Use Your Information</h3>
        <p>We use your information to provide and improve our services, communicate with you, and comply with legal obligations.</p>
        <h3>Data Security</h3>
        <p>We take reasonable measures to protect your information from unauthorized access, use, or disclosure.</p>
        <h3>Changes to This Policy</h3>
        <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on our website.</p>
        <h3>Contact Us</h3>
        <p>If you have any questions or concerns about this privacy policy, please contact us.</p>
    </div>
`
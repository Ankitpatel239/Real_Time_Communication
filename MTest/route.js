// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// userId -> ws mapping
const users = new Map();

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (payload) => {
    try {
      const data = JSON.parse(payload.toString());

      if (data.type === "register") {
        // save userId -> ws mapping
        users.set(data.userId, ws);
        ws.userId = data.userId;
        console.log("Registered:", data.userId);
        return;
      }

      // Relay signaling messages (offer, answer, ice)
      if (["offer", "answer", "ice"].includes(data.type)) {
        const target = users.get(data.to);
        console.log("Received", data.type, "from", ws.userId);
        console.log("Relaying message to:", data.to);   
        if (target && target.readyState === target.OPEN) {
          target.send(JSON.stringify({ ...data, from: ws.userId }));
        }
      }
    } catch (err) {
      console.error("Invalid message:", err);
    }
  });

  ws.on("close", () => {
    if (ws.userId) {
      users.delete(ws.userId);
      console.log("User disconnected:", ws.userId);
    }
  });
});

// Homepage
app.get("/", (_, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Audio Call App</title></head>
    <body>
      <h1>Start an Audio Call</h1>
      <form id="form">
        <input id="myId" placeholder="Your ID" required />
        <input id="peerId" placeholder="Call User ID" />
        <button type="submit">Start Call</button>
      </form>
      <script>
        const form = document.getElementById("form");
        form.onsubmit = (e) => {
          e.preventDefault();
          const myId = document.getElementById("myId").value;
          const peerId = document.getElementById("peerId").value;
          if (myId) {
            window.location.href = "/webrtc/" + encodeURIComponent(myId) + (peerId ? "?peer=" + encodeURIComponent(peerId) : "");
          }
        };
      </script>
    </body>
    </html>
  `);
});

// WebRTC page
app.get("/webrtc/:userId", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Audio Call with ${req.params.userId}</title></head>
    <body>
      <h2>Logged in as: ${req.params.userId}</h2>
      <audio id="remoteAudio" autoplay></audio>
      <button id="callBtn">Call Peer</button>

      <script>
        const userId = "${req.params.userId}";
        const peerId = new URLSearchParams(window.location.search).get("peer");
        const wsProtocol = location.protocol === "https:" ? "wss://" : "ws://";
        const ws = new WebSocket(wsProtocol + location.host);

        let pc, localStream;
        const remoteAudio = document.getElementById("remoteAudio");

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "register", userId }));
        };

        document.getElementById("callBtn").onclick = async () => {
          if (!peerId) return alert("No peer specified!");

          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          pc = createPeerConnection(peerId);

          localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", offer, to: peerId }));
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "offer") {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            pc = createPeerConnection(msg.from);

            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer, to: msg.from }));
          }

          if (msg.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          }

          if (msg.type === "ice" && msg.candidate) {
            try { await pc.addIceCandidate(msg.candidate); } catch (e) {}
          }
        };

        function createPeerConnection(targetId) {
          const pc = new RTCPeerConnection();

          pc.ontrack = (event) => {
            remoteAudio.srcObject = event.streams[0];
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              ws.send(JSON.stringify({ type: "ice", candidate: event.candidate, to: targetId }));
            }
          };
          return pc;
        }
      </script>
    </body>
    </html>
  `);
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
  console.log("Open two browser tabs and use different IDs to test the audio call.");
  //open in mobail using this url 
  console.log(``)
});

export default app;   




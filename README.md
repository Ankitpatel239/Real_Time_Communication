# P2P Chatting App (WebRTC, SSR, Free)

Welcome to the **P2P Chat** app! This is a real-time, peer-to-peer chat application built using WebRTC and Node.js. It features a typing indicator, room management, and a privacy policy. The app is completely free and open source.

## Features

- **Peer-to-peer chat** using WebRTC DataChannel (no server relay for messages)
- **Typing indicator** shows when your peer is typing
- **Room system** (max 2 users per room)
- **Single-file SSR** (server-side rendering)
- **No registration required**
- **Privacy policy included**

## How to Run

1. **Install dependencies:**
    ```bash
    npm i express ws
    ```

2. **Start the server:**
    ```bash
    node webrtc-ssr-chat.js
    ```

3. **Open the app:**
    - Visit [http://localhost:3000](http://localhost:3000) in two browsers/devices.
    - Enter the same room name to chat peer-to-peer.

## Code Overview

The app is a single file containing both the server and the SSR HTML page. It uses:
- **Express** for HTTP server
- **ws** for WebSocket signaling
- **WebRTC** for direct peer-to-peer messaging

### Main Server Logic

- Handles room management (max 2 peers per room)
- Uses WebSocket for signaling (SDP/ICE exchange)
- Cleans up rooms when users leave

### Frontend

- Modern UI with chat, typing indicator, and user list
- Connects to signaling server, establishes WebRTC connection
- Handles sending/receiving messages and typing notifications

## Privacy Policy

See the [Privacy Policy](http://localhost:3000/privacy-policy) for details on data handling.

## License

This project is free to use and modify.

---

## Quick Start

```bash
npm i express ws
node webrtc-ssr-chat.js
```

Open [http://localhost:3000](http://localhost:3000) in two browsers/devices, join the same room, and start chatting!

---

## Screenshots

![Chat UI](https://user-images.githubusercontent.com/your-screenshot.png)

---

## Contact

For questions or feedback, open an issue or contact the maintainer.

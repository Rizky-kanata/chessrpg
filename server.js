const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

const lobbies = new Map();
const users = new Map();

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);
  if (!MIME[ext]) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function broadcast(lobbyId, data, excludeWs) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  const msg = JSON.stringify(data);
  for (const player of [lobby.host, lobby.guest]) {
    if (player && player.ws && player.ws !== excludeWs && player.ws.readyState === 1) {
      player.ws.send(msg);
    }
  }
}

function sendTo(ws, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

function generateId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getLobbyList() {
  const list = [];
  for (const [id, lobby] of lobbies) {
    if (!lobby.guest && lobby.host) {
      list.push({ id, host: lobby.host.username });
    }
  }
  return list;
}

function cleanupLobby(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  if (lobby.host && lobby.host.ws) {
    lobby.host.ws._lobbyId = null;
  }
  if (lobby.guest && lobby.guest.ws) {
    lobby.guest.ws._lobbyId = null;
  }
  lobbies.delete(lobbyId);
  broadcastLobbyList();
}

function broadcastLobbyList() {
  const list = getLobbyList();
  wss.clients.forEach(client => {
    if (client.readyState === 1 && !client._lobbyId) {
      sendTo(client, { type: 'lobbyList', lobbies: list });
    }
  });
}

wss.on('connection', (ws) => {
  ws._username = null;
  ws._lobbyId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'register': {
        const name = (msg.username || '').trim();
        const pass = msg.password || '';
        if (name.length < 3) { sendTo(ws, { type: 'registerResult', ok: false, error: 'Username minimal 3 karakter' }); return; }
        if (pass.length < 4) { sendTo(ws, { type: 'registerResult', ok: false, error: 'Password minimal 4 karakter' }); return; }
        if (users.has(name.toLowerCase())) { sendTo(ws, { type: 'registerResult', ok: false, error: 'Username sudah dipakai' }); return; }
        users.set(name.toLowerCase(), { username: name, password: pass, wins: 0, losses: 0 });
        sendTo(ws, { type: 'registerResult', ok: true });
        break;
      }

      case 'login': {
        const name = (msg.username || '').trim();
        const pass = msg.password || '';
        const u = users.get(name.toLowerCase());
        if (!u || u.password !== pass) { sendTo(ws, { type: 'loginResult', ok: false, error: 'Username atau password salah' }); return; }
        ws._username = u.username;
        sendTo(ws, { type: 'loginResult', ok: true, username: u.username });
        sendTo(ws, { type: 'lobbyList', lobbies: getLobbyList() });
        break;
      }

      case 'relogin': {
        const name = (msg.username || '').trim();
        if (name) {
          ws._username = name;
          sendTo(ws, { type: 'reloginOk', username: name });
          sendTo(ws, { type: 'lobbyList', lobbies: getLobbyList() });
        }
        break;
      }

      case 'createLobby': {
        if (!ws._username) { sendTo(ws, { type: 'joinResult', ok: false, error: 'Belum login, coba refresh halaman' }); return; }
        let id;
        do { id = generateId(); } while (lobbies.has(id));
        lobbies.set(id, { host: { username: ws._username, ws }, guest: null, created: Date.now() });
        ws._lobbyId = id;
        sendTo(ws, { type: 'lobbyCreated', lobbyId: id });
        broadcastLobbyList();
        break;
      }

      case 'joinLobby': {
        if (!ws._username) { sendTo(ws, { type: 'joinResult', ok: false, error: 'Belum login, coba refresh halaman' }); return; }
        const id = (msg.lobbyId || '').toUpperCase();
        const lobby = lobbies.get(id);
        if (!lobby) { sendTo(ws, { type: 'joinResult', ok: false, error: 'Lobby tidak ditemukan' }); return; }
        if (lobby.guest) { sendTo(ws, { type: 'joinResult', ok: false, error: 'Lobby sudah penuh' }); return; }
        if (lobby.host && lobby.host.username === ws._username) { sendTo(ws, { type: 'joinResult', ok: false, error: 'Tidak bisa join lobby sendiri' }); return; }
        lobby.guest = { username: ws._username, ws };
        ws._lobbyId = id;
        sendTo(ws, { type: 'joinResult', ok: true, lobbyId: id });
        sendTo(lobby.host.ws, {
          type: 'gameStart',
          lobbyId: id,
          host: lobby.host.username,
          guest: ws._username,
          color: 'w'
        });
        sendTo(ws, {
          type: 'gameStart',
          lobbyId: id,
          host: lobby.host.username,
          guest: ws._username,
          color: 'b'
        });
        broadcastLobbyList();
        break;
      }

      case 'cancelLobby': {
        if (ws._lobbyId) {
          cleanupLobby(ws._lobbyId);
        }
        break;
      }

      case 'move': {
        if (!ws._lobbyId) return;
        broadcast(ws._lobbyId, {
          type: 'move',
          fr: msg.fr, fc: msg.fc, tr: msg.tr, tc: msg.tc,
          promotion: msg.promotion || null,
          username: ws._username
        }, ws);
        break;
      }

      case 'battleResult': {
        if (!ws._lobbyId) return;
        broadcast(ws._lobbyId, {
          type: 'battleResult',
          rounds: msg.rounds,
          attackerWins: msg.attackerWins,
          seed: msg.seed
        }, ws);
        break;
      }

      case 'chat': {
        if (!ws._lobbyId || !ws._username) return;
        const text = (msg.text || '').slice(0, 200);
        broadcast(ws._lobbyId, { type: 'chat', username: ws._username, text }, null);
        break;
      }

      case 'leaveLobby': {
        if (!ws._lobbyId) return;
        const lobby = lobbies.get(ws._lobbyId);
        if (lobby) {
          broadcast(ws._lobbyId, { type: 'opponentLeft', username: ws._username }, ws);
          cleanupLobby(ws._lobbyId);
        }
        ws._lobbyId = null;
        sendTo(ws, { type: 'lobbyList', lobbies: getLobbyList() });
        break;
      }

      case 'getLobbies': {
        sendTo(ws, { type: 'lobbyList', lobbies: getLobbyList() });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws._lobbyId) {
      const lobby = lobbies.get(ws._lobbyId);
      if (lobby) {
        broadcast(ws._lobbyId, { type: 'opponentLeft', username: ws._username }, ws);
        cleanupLobby(ws._lobbyId);
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, lobby] of lobbies) {
    if (now - lobby.created > 3600000 && !lobby.guest) {
      cleanupLobby(id);
    }
  }
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log('=== CHESS GG SERVER STARTED ===');
  console.log('');
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://${localIP}:${PORT}`);
  console.log('');
  console.log('Buka link Network di device lain (HP/Laptop lain)');
  console.log('yang terhubung ke WiFi yang sama.');
  console.log('');
  console.log('Untuk online dari luar jaringan:');
  console.log('1. Port forward port ' + PORT + ' di router');
  console.log('2. Atau gunakan ngrok: ngrok http ' + PORT);
  console.log('3. Atau deploy ke cloud (Railway, Render, VPS)');
  console.log('================================');
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let tiktokConnection = null;
let currentUsername = '';

io.on('connection', (socket) => {
    console.log('Client conectat:', socket.id);

    if (currentUsername) {
        socket.emit('status-update', { connected: true, username: currentUsername });
    }

    // Conectare la un cont de TikTok Live
    socket.on('connect-tiktok', (username) => {
        const cleanUser = username.replace('@', '').trim();
        if (!cleanUser) return;

        if (tiktokConnection) {
            try { tiktokConnection.disconnect(); } catch (e) {}
        }

        currentUsername = cleanUser;
        tiktokConnection = new WebcastPushConnection(cleanUser, {
            processInitialData: false,
            enableExtendedGiftInfo: true
        });

        tiktokConnection.connect()
            .then(state => {
                console.log(`Conectat la live-ul lui ${cleanUser} (Room ID: ${state.roomId})`);
                io.emit('status-update', { connected: true, username: cleanUser });
            })
            .catch(err => {
                console.error('Eroare conectare TikTok:', err.message);
                io.emit('status-update', { 
                    connected: false, 
                    error: 'Nu ești LIVE acum sau userul nu a fost găsit. Folosește butoanele de test!' 
                });
            });

        // 1. Comentariu -> Intră în cursă sau primește un mic impuls
        tiktokConnection.on('chat', (data) => {
            io.emit('race-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                type: 'chat',
                boost: 5,
                detail: data.comment
            });
        });

        // 2. Like (Tap-tap) -> Impuls constant
        tiktokConnection.on('like', (data) => {
            io.emit('race-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                type: 'like',
                boost: Math.min(data.likeCount || 1, 10),
                detail: `${data.likeCount} like-uri`
            });
        });

        // 3. Cadouri (Trandafir etc.) -> Super Turbo!
        tiktokConnection.on('gift', (data) => {
            // Așteptăm finalul seriei de cadouri (streak) sau luăm fiecare bucată
            if (data.giftType === 1 && !data.repeatEnd) return;

            const coins = (data.diamondCount || 1) * (data.repeatCount || 1);
            const boostAmount = 15 + (coins * 10); // Trandafirul (1 coin) = +25 pași!

            io.emit('race-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                type: 'gift',
                boost: boostAmount,
                giftName: data.giftName || 'Cadou',
                coins: coins
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});

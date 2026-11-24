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
    if (currentUsername) {
        socket.emit('status-update', { connected: true, username: currentUsername });
    }

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
            .then(() => {
                io.emit('status-update', { connected: true, username: cleanUser });
            })
            .catch(() => {
                io.emit('status-update', { 
                    connected: false, 
                    error: 'TikTok blocat temporar (folosește butoanele Demo sau reîncearcă)' 
                });
            });

        // 1. Intrarea în live (Member Join)
        tiktokConnection.on('member', (data) => {
            io.emit('bubble-action', {
                type: 'join',
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 10
            });
        });

        // 2. Comentariu în chat -> Intră sau primește +15 puncte
        tiktokConnection.on('chat', (data) => {
            io.emit('bubble-action', {
                type: 'chat',
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 15
            });
        });

        // 3. Like-uri (Tap-Tap) -> Crește dimensiunea și punctele
        tiktokConnection.on('like', (data) => {
            const count = data.likeCount || 1;
            io.emit('bubble-action', {
                type: 'like',
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: count * 5
            });
        });

        // 4. Cadouri -> Creștere masivă + Undă de șoc
        tiktokConnection.on('gift', (data) => {
            // Procesăm la finalul seriei de combo sau la cadouri individuale
            if (data.giftType === 1 && !data.repeatEnd) return;
            const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
            io.emit('bubble-action', {
                type: 'gift',
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: diamonds * 100
            });
        });

        // 5. Follow / Share -> Boost special
        tiktokConnection.on('social', (data) => {
            io.emit('bubble-action', {
                type: 'gift',
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 150
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul Bubble Battle rulează pe portul ${PORT}`);
});

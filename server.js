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
                    error: 'TikTok blocat temporar (foloseștebutoanele de test)' 
                });
            });

        // 1. Cine intră sau comentează devine glob/cadou în brad
        tiktokConnection.on('member', (data) => {
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 10,
                type: 'member'
            });
        });

        tiktokConnection.on('chat', (data) => {
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 20,
                type: 'chat'
            });
        });

        // 2. Like-uri (Tap-Tap) adaugă puncte
        tiktokConnection.on('like', (data) => {
            const count = data.likeCount || 1;
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: count * 2,
                type: 'like'
            });
        });

        // 3. Cadouri -> Cadouri uriașe în brad
        tiktokConnection.on('gift', (data) => {
            if (data.giftType === 1 && !data.repeatEnd) return;
            const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: diamonds * 50,
                type: 'gift'
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Bradul de Crăciun rulează pe portul ${PORT}`);
});

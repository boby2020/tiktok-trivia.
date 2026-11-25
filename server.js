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
        console.log(`Conectare la live-ul: @${cleanUser}`);

        tiktokConnection = new WebcastPushConnection(cleanUser, {
            processInitialData: true,
            enableExtendedGiftInfo: true,
            requestOptions: {
                timeout: 10000
            }
        });

        tiktokConnection.connect()
            .then(state => {
                console.log(`Conectat cu succes la roomID: ${state.roomId}`);
                io.emit('status-update', { connected: true, username: cleanUser });
            })
            .catch(err => {
                console.error('Eroare conexiune TikTok:', err);
                io.emit('status-update', { 
                    connected: false, 
                    error: 'Eroare conexiune TikTok. Verifică dacă ești LIVE sau folosește testele.' 
                });
            });

        // Spectator nou intrat în live
        tiktokConnection.on('member', (data) => {
            io.emit('wall-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 20,
                type: 'member'
            });
        });

        // Mesaj în chat
        tiktokConnection.on('chat', (data) => {
            io.emit('wall-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 30,
                type: 'chat'
            });
        });

        // Like-uri (Tap-Tap)
        tiktokConnection.on('like', (data) => {
            const count = data.likeCount || 1;
            io.emit('wall-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: count * 5,
                type: 'like'
            });
        });

        // Cadouri trimise
        tiktokConnection.on('gift', (data) => {
            if (data.giftType === 1 && !data.repeatEnd) return;
            const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
            io.emit('wall-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: diamonds * 100,
                type: 'gift',
                giftName: data.giftName
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});

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
        console.log(`Se încearcă conectarea la live-ul: @${cleanUser}`);

        tiktokConnection = new WebcastPushConnection(cleanUser, {
            processInitialData: true,
            enableExtendedGiftInfo: true,
            requestOptions: {
                timeout: 10000
            }
        });

        tiktokConnection.connect()
            .then(state => {
                console.log(`Conectat cu succes la camera roomID: ${state.roomId}`);
                io.emit('status-update', { connected: true, username: cleanUser });
            })
            .catch(err => {
                console.error('Eroare conexiune TikTok:', err);
                io.emit('status-update', { 
                    connected: false, 
                    error: 'Conexiune blocată de TikTok. Folosește butoanele de test sau reîncearcă.' 
                });
            });

        // Eveniment: Spectator care intră în live
        tiktokConnection.on('member', (data) => {
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 15,
                type: 'member'
            });
        });

        // Eveniment: Mesaj în chat
        tiktokConnection.on('chat', (data) => {
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: 25,
                type: 'chat'
            });
        });

        // Eveniment: Like-uri (Tap-Tap)
        tiktokConnection.on('like', (data) => {
            const count = data.likeCount || 1;
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: count * 3,
                type: 'like'
            });
        });

        // Eveniment: Cadouri trimise
        tiktokConnection.on('gift', (data) => {
            if (data.giftType === 1 && !data.repeatEnd) return;
            const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
            io.emit('tree-action', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                avatar: data.profilePictureUrl,
                points: diamonds * 80,
                type: 'gift'
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});

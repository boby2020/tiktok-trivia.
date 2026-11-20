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
            enableExtendedGiftInfo: false
        });

        tiktokConnection.connect()
            .then(state => {
                io.emit('status-update', { connected: true, username: cleanUser });
            })
            .catch(err => {
                io.emit('status-update', { 
                    connected: false, 
                    error: 'Nu s-a putut conecta la TikTok (jocul rulează automat).' 
                });
            });

        // Ascultăm comentariile (1, 2, 3, 4 sau A, B, C, D)
        tiktokConnection.on('chat', (data) => {
            const msg = (data.comment || '').trim().toUpperCase();
            let answerIndex = -1;

            if (msg === '1' || msg === 'A') answerIndex = 0;
            else if (msg === '2' || msg === 'B') answerIndex = 1;
            else if (msg === '3' || msg === 'C') answerIndex = 2;
            else if (msg === '4' || msg === 'D') answerIndex = 3;

            if (answerIndex !== -1) {
                io.emit('player-answer', {
                    userId: data.uniqueId,
                    nickname: data.nickname || data.uniqueId,
                    avatar: data.profilePictureUrl,
                    answerIndex: answerIndex
                });
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul Milionar rulează pe portul ${PORT}`);
});

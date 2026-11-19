const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let tiktokConnection = null;

io.on('connection', (socket) => {
    console.log('Utilizator conectat!');

    socket.on('connect_tiktok', (username) => {
        if (tiktokConnection) {
            tiktokConnection.disconnect();
        }

        const cleanUsername = username.replace('@', '').trim();
        tiktokConnection = new WebcastPushConnection(cleanUsername);

        tiktokConnection.connect().then(state => {
            socket.emit('tiktok_status', { connected: true, msg: `Conectat la @${cleanUsername}!` });
        }).catch(err => {
            socket.emit('tiktok_status', { connected: false, msg: `Eroare: Asigură-te că @${cleanUsername} este LIVE!` });
        });

        tiktokConnection.on('chat', data => {
            io.emit('tiktok_chat', {
                user: data.uniqueId,
                nickname: data.nickname,
                comment: data.comment.trim()
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));

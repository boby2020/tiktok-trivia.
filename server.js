const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servim fișierele statice din folderul public
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Un utilizator s-a conectat:', socket.id);

    // Trimitem o întrebare de test când cineva apasă un buton
    socket.on('request-question', () => {
        const sampleQuestion = {
            question: "Care este capitala României?",
            answers: ["Cluj-Napoca", "București", "Timișoara", "Iași"],
            correct: 1
        };
        io.emit('new-question', sampleQuestion);
    });

    socket.on('disconnect', () => {
        console.log('Utilizator deconectat:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});

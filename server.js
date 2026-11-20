const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servim fișierele statice din folderul public
app.use(express.static('public'));

// Întrebările pentru trivia
const questions = [
    {
        question: "Care este capitala României?",
        options: ["Cluj-Napoca", "București", "Timișoara", "Iași"],
        correct: 1
    },
    {
        question: "Câte continente sunt pe Pământ?",
        options: ["5", "6", "7", "8"],
        correct: 2
    }
];

let currentQuestionIndex = 0;

io.on('connection', (socket) => {
  console.log('Un utilizator s-a conectat:', socket.id);

  // Trimitem prima întrebare când cineva se conectează
  socket.emit('new-question', questions[currentQuestionIndex]);

  // Ascultăm răspunsurile primite de la utilizatori
  socket.on('submit-answer', (data) => {
    console.log(`Răspuns primit de la ${socket.id}: opțiunea ${data.optionIndex}`);
    
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = (data.optionIndex === currentQ.correct);

    // Trimitem rezultatul înapoi clientului
    socket.emit('answer-result', { correct: isCorrect, correctIndex: currentQ.correct });
  });

  socket.on('disconnect', () => {
    console.log('Utilizator deconectat:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serverul rulează pe portul ${PORT}`);
});

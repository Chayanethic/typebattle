const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Adjust to your Railway URL in production (e.g., 'https://your-app.up.railway.app')
        methods: ['GET', 'POST']
    }
});

app.use(express.static('public'));

const sentences = [
    "Narula Institute of Technology is a premier educational institute in Kolkata. It is a part of JIS Educational Initiatives. Today, it ranks among the top private engineering college in Kolkata, West Bengal. Most of its eligible programs are NBA accredited.",
    "Annada Mistanna Bhandar is a renowned sweet shop located in Kalyani, West Bengal. It is listed among the miscellaneous manufacturing companies in Nadia district.",
    "Despite the heavy rain and strong winds that threatened to uproot trees, the marathon runners continued their race with unwavering determination, each step echoing their resilience and passion for the sport.",
    "In an era where technology is rapidly evolving and artificial intelligence is seamlessly integrating into various aspects of our daily lives, the debate about its ethical implications and long-term consequences continues to spark discussions among researchers, policymakers, and the general public.",
    "The breathtaking view from the mountaintop, with the golden rays of the setting sun casting a warm glow over the vast, rolling hills and the winding river below, made the grueling five-hour hike feel entirely worth the effort.",
    "As she flipped through the dusty pages of the ancient manuscript, she realized that the cryptic symbols and mysterious diagrams contained within were not just random scribbles but rather a forgotten language that held the secrets of a lost civilization.",
    "With the deadline looming ever closer and the pressure mounting from both colleagues and superiors, he found himself struggling to balance perfection and efficiency, knowing that even the slightest mistake could result in a disastrous outcome.",
];

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create-room', (playerName) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const text = sentences[Math.floor(Math.random() * sentences.length)];
        rooms[roomId] = { 
            players: [{ id: socket.id, name: playerName, progress: 0, isCreator: true, startTime: null, endTime: null }], 
            text, 
            winner: null, 
            started: false
        };
        socket.join(roomId);
        socket.emit('room-created', { roomId, text, isCreator: true });
    });

    socket.on('join-room', ({ roomId, playerName }) => {
        if (rooms[roomId] && !rooms[roomId].winner) {
            const isSpectator = rooms[roomId].started;
            rooms[roomId].players.push({ id: socket.id, name: playerName, progress: 0, isCreator: false, startTime: null, endTime: null });
            socket.join(roomId);
            io.to(roomId).emit('player-joined', rooms[roomId].players);
            socket.emit('joined-room', { roomId, text: rooms[roomId].text, isSpectator });
        } else {
            socket.emit('error', rooms[roomId]?.winner ? 'Game already ended' : 'Room not found');
        }
    });

    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (room && !room.started && room.players.find(p => p.id === socket.id)?.isCreator) {
            room.started = true;
            io.to(roomId).emit('game-starting', room.text);
        }
    });

    socket.on('submit-text', ({ roomId, typedText, startTime, endTime }) => {
        const room = rooms[roomId];
        if (room && !room.winner && typedText === room.text && room.started) {
            const player = room.players.find(p => p.id === socket.id);
            player.endTime = endTime;
            player.startTime = startTime;
            room.winner = player.name;
            const wordCount = room.text.split(' ').length;
            const wpmData = room.players.map(p => {
                if (p.endTime && p.startTime) {
                    const timeInMinutes = (p.endTime - p.startTime) / 60000;
                    return { name: p.name, wpm: Math.round(wordCount / timeInMinutes) };
                }
                return { name: p.name, wpm: Math.round((p.progress / 100) * wordCount / ((Date.now() - p.startTime) / 60000)) || 0 };
            });
            io.to(roomId).emit('game-over', { winner: player.name, wpmData });
        }
    });

    socket.on('update-progress', ({ roomId, progress, startTime }) => {
        const room = rooms[roomId];
        if (room && !room.winner && room.started) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.progress = progress;
                if (!player.startTime) player.startTime = startTime;
                io.to(roomId).emit('progress-update', room.players);
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) delete rooms[roomId];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

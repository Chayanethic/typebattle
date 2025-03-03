const socket = io(window.location.origin, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfo = document.getElementById('roomInfo');
const gameDiv = document.getElementById('game');
const startGameBtn = document.getElementById('startGame');
const countdownDiv = document.getElementById('countdown');
const textToType = document.getElementById('textToType');
const typingProgress = document.getElementById('typingProgress');
const typingInput = document.getElementById('typingInput');
const playersDiv = document.getElementById('players');
const winnerDiv = document.getElementById('winner');
const wpmResultsDiv = document.getElementById('wpmResults');
const shareUrl = document.getElementById('shareUrl');
const copyLinkBtn = document.getElementById('copyLink');
const aboutBtn = document.getElementById('aboutBtn');
const aboutDiv = document.getElementById('about');
const startScreen = document.getElementById('startScreen');
const soundToggleBtn = document.getElementById('soundToggle');

const urlParams = new URLSearchParams(window.location.search);
const roomIdFromUrl = urlParams.get('room');
if (roomIdFromUrl) roomIdInput.value = roomIdFromUrl;

let startTime = null;
let isSoundEnabled = true;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const typingSound = new Audio('/sounds/keypress.mp3');
function playTypingSound() {
    if (isSoundEnabled) {
        typingSound.currentTime = 0; // Reset to start
        typingSound.play();
    }
}

createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) socket.emit('create-room', name);
    else alert('Please enter your name!');
});

joinRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const roomId = roomIdInput.value.trim() || roomIdFromUrl;
    if (name && roomId) socket.emit('join-room', { roomId, playerName: name });
    else alert('Please enter your name' + (roomId ? '' : ' and room ID!'));
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (err) => {
    console.error('WebSocket connection failed:', err);
    roomInfo.textContent = 'Failed to connect to server. Please refresh or try again later.';
});

socket.on('room-created', ({ roomId, text, isCreator }) => {
    roomInfo.textContent = `Room ID: ${roomId}`;
    shareUrl.value = `${window.location.origin}?room=${roomId}`;
    shareLink.style.display = 'block';
    startScreen.style.display = 'none';
    startGameBtn.style.display = isCreator ? 'block' : 'none';
    prepareGame(roomId, text, false);
});

socket.on('joined-room', ({ roomId, text, isSpectator }) => {
    roomInfo.textContent = `Joined Room: ${roomId}`;
    startScreen.style.display = 'none';
    prepareGame(roomId, text, isSpectator);
});

socket.on('error', (msg) => alert(msg));

socket.on('player-joined', (players) => {
    updatePlayers(players);
});

socket.on('game-starting', (text) => {
    startGameBtn.style.display = 'none';
    startCountdown(text);
});

socket.on('progress-update', (players) => {
    updatePlayers(players);
});

socket.on('game-over', ({ winner, wpmData }) => {
    winnerDiv.style.display = 'block';
    winnerDiv.textContent = `${winner} Wins!`;
    typingInput.disabled = true;
    displayWpmResults(wpmData);
    gsap.to('#winner', { scale: 1.2, duration: 0.5, yoyo: true, repeat: 3, ease: 'bounce' });
    gsap.to('#game', { background: 'rgba(0, 255, 153, 0.2)', duration: 1, repeat: 1, yoyo: true });
    gsap.from('#wpmResults', { y: 50, opacity: 0, duration: 1, delay: 0.5, ease: 'power2.out' });
});

copyLinkBtn.addEventListener('click', () => {
    shareUrl.select();
    navigator.clipboard.writeText(shareUrl.value);
    gsap.to('#copyLink', { background: '#00ff99', duration: 0.3, yoyo: true, repeat: 1 });
});

aboutBtn.addEventListener('click', () => {
    const isVisible = aboutDiv.style.display === 'block';
    aboutDiv.style.display = isVisible ? 'none' : 'block';
    startScreen.style.display = isVisible ? 'block' : 'none';
    gameDiv.style.display = 'none';
    if (!isVisible) {
        gsap.from('#creatorImg', { scale: 0, opacity: 0, duration: 1, ease: 'elastic' });
        gsap.from('#about p', { y: 50, opacity: 0, duration: 1, delay: 0.5 });
    }
});

startGameBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim() || roomIdFromUrl || roomInfo.textContent.split(' ')[2];
    socket.emit('start-game', roomId);
});

soundToggleBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    soundToggleBtn.classList.toggle('muted');
    soundToggleBtn.querySelector('i').classList.toggle('fa-volume-low');
    soundToggleBtn.querySelector('i').classList.toggle('fa-volume-xmark');
});

function prepareGame(roomId, text, isSpectator) {
    gameDiv.style.display = 'block';
    textToType.textContent = text;
    typingInput.value = '';
    typingInput.disabled = true;
    winnerDiv.style.display = 'none';
    wpmResultsDiv.style.display = 'none';

    typingInput.addEventListener('paste', (e) => e.preventDefault());

    if (!isSpectator) {
        typingInput.addEventListener('keydown', () => {
            playTypingSound();
        });
        typingInput.addEventListener('input', () => {
            const typedText = typingInput.value;
            const progress = (typedText.length / text.length) * 100;
            const isCorrect = text.startsWith(typedText);

            if (!isCorrect) {
                typingInput.classList.add('error');
                gsap.to('#typingInput', { x: 10, duration: 0.1, yoyo: true, repeat: 4 });
            } else {
                typingInput.classList.remove('error');
                gsap.to(typingProgress, { width: `${Math.min(progress, 100)}%`, duration: 0.3 });
                gsap.to('#textToType', { color: `hsl(${progress * 3.6}, 70%, 70%)`, duration: 0.2 });
                animateWordPerMinute(typedText, text);
                socket.emit('update-progress', { roomId, progress: Math.min(progress, 100), startTime });
            }

            if (typedText === text) {
                socket.emit('submit-text', { roomId, typedText, startTime, endTime: Date.now() });
            }
        });
    }

    gsap.from('#textToType', { opacity: 0, y: 50, duration: 1, ease: 'power2.out' });
    gsap.to('#textContainer', { rotation: 1, duration: 2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

function startCountdown(text) {
    countdownDiv.style.display = 'block';
    let count = 3;
    const timeline = gsap.timeline({
        onComplete: () => {
            countdownDiv.style.display = 'none';
            typingInput.disabled = false;
            typingInput.focus();
            startTime = Date.now();
            gsap.from('#typingInput', { scale: 0.8, opacity: 0, duration: 1 });
        }
    });

    countdownDiv.textContent = count;
    timeline.fromTo('#countdown', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back' });
    timeline.to('#countdown', { scale: 0, opacity: 0, duration: 0.5, delay: 0.5, ease: 'back', onComplete: () => countdownDiv.textContent = --count });
    timeline.fromTo('#countdown', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back' });
    timeline.to('#countdown', { scale: 0, opacity: 0, duration: 0.5, delay: 0.5, ease: 'back', onComplete: () => countdownDiv.textContent = --count });
    timeline.fromTo('#countdown', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back' });
    timeline.to('#countdown', { scale: 0, opacity: 0, duration: 0.5, delay: 0.5, ease: 'back' });
}

function updatePlayers(players) {
    playersDiv.innerHTML = '';
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-progress';
        div.textContent = `${player.name}: ${player.progress.toFixed(0)}%${player.isCreator ? ' (Creator)' : ''}`;
        playersDiv.appendChild(div);
    });
}

function displayWpmResults(wpmData) {
    wpmResultsDiv.style.display = 'block';
    wpmResultsDiv.innerHTML = '';
    wpmData.forEach(data => {
        const p = document.createElement('p');
        p.textContent = `${data.name}: ${data.wpm} WPM`;
        wpmResultsDiv.appendChild(p);
    });
}

function animateWordPerMinute(typedText, fullText) {
    const typedWords = typedText.trim().split(/\s+/).length;
    const totalWords = fullText.trim().split(/\s+/).length;
    if (typedWords > 0 && typedWords <= totalWords) {
        const currentWordIndex = typedWords - 1;
        const words = fullText.split(/\s+/);
        const wordElement = document.createElement('span');
        wordElement.textContent = words[currentWordIndex];
        wordElement.style.position = 'absolute';
        wordElement.style.color = '#ffcc00';
        wordElement.style.fontSize = '1.5em';
        textToType.appendChild(wordElement);

        gsap.fromTo(wordElement, 
            { opacity: 0, y: 20 }, 
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', 
              onComplete: () => {
                  gsap.to(wordElement, { opacity: 0, duration: 0.3, onComplete: () => wordElement.remove() });
              }
            }
        );
    }
}

gsap.from('h1', { y: -100, opacity: 0, duration: 1.5, ease: 'bounce' });
gsap.from('#startScreen', { opacity: 0, stagger: 0.2, duration: 1, delay: 0.5 });

if (roomIdFromUrl && playerNameInput.value.trim()) {
    socket.emit('join-room', { roomId: roomIdFromUrl, playerName: playerNameInput.value.trim() });
}

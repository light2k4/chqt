const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 5500;

const USER_LOG_FILE = 'user_log.txt';
const MESSAGE_LOG_FILE = 'message_log.txt';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'src')));
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'chat.html'));
});

app.post('/upload-voice', upload.single('voice'), (req, res) => {
    res.json({ filePath: `/uploads/${req.file.filename}` });
});

const logToFile = (filePath, logEntry) => {
    fs.appendFile(filePath, logEntry, (err) => {
        if (err) {
            console.error(`Error logging to ${filePath}:`, err);
        }
    });
};

io.on('connection', (socket) => {
    const userIdentifier = uuidv4();
    socket.handshake.headers.cookie = `user_id=${userIdentifier}`;

    console.log('a user connected with id:', userIdentifier);

    socket.on('set user', (data) => {
        const logEntry = `Identifier: ${userIdentifier}, IP: ${socket.handshake.address}, Username: ${data.username}\n`;
        logToFile(USER_LOG_FILE, logEntry);
        socket.username = data.username;
        socket.color = data.color;
    });

    socket.on('chat message', (msg) => {
        const logEntry = `Identifier: ${userIdentifier}, Username: ${socket.username}, Message: ${msg}\n`;
        if (msg.length > 250) {
            socket.emit('error message', 'Message too long. Maximum length is 250 characters.');
        } else {
            logToFile(MESSAGE_LOG_FILE, logEntry);
            io.emit('chat message', { message: msg, username: socket.username, color: socket.color });
        }
    });

    socket.on('image message', (data) => {
        const logEntry = `Identifier: ${userIdentifier}, Username: ${socket.username}, Image: [binary data not logged]\n`;
        logToFile(MESSAGE_LOG_FILE, logEntry);
        io.emit('image message', { image: data.image, username: socket.username, color: socket.color });
    });

    socket.on('voice message', (data) => {
        const logEntry = `Identifier: ${userIdentifier}, Username: ${data.username}, Voice: ${data.voicePath}\n`;
        logToFile(MESSAGE_LOG_FILE, logEntry);
        io.emit('voice message', { voicePath: data.voicePath, username: data.username, color: data.color });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});
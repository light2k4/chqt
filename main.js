const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); // updated

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

const port = 5500;

const uuid = require('uuid');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
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
    res.sendFile(__dirname + '/src/chat.html');
});

app.post('/upload-voice', upload.single('voice'), (req, res) => {
    res.json({ filePath: `/uploads/${req.file.filename}` });
});



io.on('connection', (socket) => {
    const userIdentifier = uuid.v4(); // Generate a unique identifier
    socket.handshake.headers.cookie = `user_id=${userIdentifier}`;

    console.log('a user connected with id:', userIdentifier);

    socket.on('set user', (data) => {
        // Save the username and IP
        const logEntry = `Identifier: ${userIdentifier}, IP: ${socket.handshake.address}, Username: ${data.username}\n`;
        fs.appendFileSync('user_log.txt', logEntry, (err) => {
            if (err) {
                console.error('Error logging user data:', err);
            }
        });
        socket.username = data.username;
        socket.color = data.color;
    });

    socket.on('chat message', (msg) => {
        // Log the chat message with username and IP
        const userIp = socket.handshake.address;
        const chatLogEntry = `Identifier: ${userIdentifier}, Username: ${socket.username}, Message: ${msg}\n`;
        fs.appendFileSync('message_log.txt', chatLogEntry, (err) => {
            if (err) {
                console.error('Error logging chat message:', err);
            }
        });

        io.emit('chat message', { message: msg, username: socket.username, color: socket.color });
    });

    socket.on('image message', (data) => {
        // Log the image message with username and IP
        const imageLogEntry = `Identifier: ${userIdentifier}, Username: ${socket.username}, Image: [binary data not logged]\n`;
        fs.appendFileSync('message_log.txt', imageLogEntry, (err) => {
            if (err) {
                console.error('Error logging image message:', err);
            }
        });

        io.emit('image message', { image: data.image, username: socket.username, color: socket.color });
    });

    socket.on('voice message', (data) => {
        const userIp = socket.handshake.address;
        const voiceLogEntry = `Identifier: ${socket.id}, Username: ${data.username}, Voice: ${data.voicePath}\n`;
        fs.appendFileSync('message_log.txt', voiceLogEntry);

        io.emit('voice message', { voicePath: data.voicePath, username: data.username, color: data.color });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 5500;

app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/chat', (req, res) => {
  res.sendFile(__dirname + '/src/chat.html');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    
    socket.on('set user', (user) => {
      socket.username = user.username;
      socket.color = user.color;
    });
  
    socket.on('chat message', (msg) => {
      io.emit('chat message', {
        username: socket.username,
        color: socket.color,
        message: msg // Ensure this is a string
      });
    });
  
    socket.on('image message', (data) => {
      io.emit('image message', {
        username: socket.username,
        color: socket.color,
        image: data.image // Ensure this is the image data
      });
    });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
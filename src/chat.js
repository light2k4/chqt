const socket = io();

const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const usernameInput = document.getElementById('username');
const colorInput = document.getElementById('color');
const joinBtn = document.getElementById('join-btn');
const emojiPicker = document.getElementById('emoji-picker');
const imageInput = document.getElementById('image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const cancelImageBtn = document.getElementById('cancel-image-btn');
const imageFullscreenContainer = document.getElementById('image-fullscreen-container');
const fullscreenImage = document.getElementById('fullscreen-image');
const closeFullscreen = document.getElementById('close-fullscreen');

let selectedImage = null;

function enableChat() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    imageInput.disabled = false;
}

// Function to set a cookie
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Function to get a cookie
function getCookie(name) {
    const cname = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(cname) === 0) {
            return c.substring(cname.length, c.length);
        }
    }
    return "";
}

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value;
    const color = colorInput.value;
    if (username.trim()) {
        socket.emit('set user', { username, color });
        enableChat();

        // Set cookies for username and color
        setCookie('username', username, 30);
        setCookie('color', color, 30);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const savedUsername = getCookie('username');
    const savedColor = getCookie('color');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
    if (savedColor) {
        colorInput.value = savedColor;
    }
});

sendBtn.addEventListener('click', () => {
    if (selectedImage) {
        socket.emit('image message', { image: selectedImage, username: usernameInput.value, color: colorInput.value });
        selectedImage = null;
        imagePreviewContainer.style.display = 'none';
    } else {
        sendMessage();
    }
});

userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

emojiPicker.addEventListener('emoji-click', (event) => {
    userInput.value += event.detail.unicode;
});

imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) {
        if (file.size > 1 * 1024 * 1024) { // 1 MB
            new Compressor(file, {
                quality: 0.6,
                success(result) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        selectedImage = reader.result;
                        imagePreview.src = selectedImage;
                        imagePreviewContainer.style.display = 'flex';
                    };
                    reader.readAsDataURL(result);
                },
                error(err) {
                    console.error('Error compressing image:', err);
                },
            });
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                selectedImage = reader.result;
                imagePreview.src = selectedImage;
                imagePreviewContainer.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        }
    }
});

cancelImageBtn.addEventListener('click', () => {
    selectedImage = null;
    imagePreviewContainer.style.display = 'none';
    imageInput.value = '';
});

function sendMessage() {
    const message = userInput.value;
    if (message.trim()) {
        socket.emit('chat message', message); // Send message as a string
        userInput.value = '';
    }
}

socket.on('chat message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === usernameInput.value ? 'user-message' : 'bot-message');
    messageElement.textContent = `${data.username}: ${data.message}`;
    messageElement.style.color = data.color;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

closeFullscreen.addEventListener('click', () => {
    imageFullscreenContainer.style.display = 'none';
    fullscreenImage.src = '';
});

function showFullscreenImage(src) {
    fullscreenImage.src = src;
    imageFullscreenContainer.style.display = 'flex';
}

socket.on('image message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === usernameInput.value ? 'user-message' : 'bot-message');

    // Username display
    const usernameElement = document.createElement('div');
    usernameElement.textContent = `${data.username}:`;
    usernameElement.style.color = data.color;
    usernameElement.style.fontWeight = 'bold';

    // Image display
    const img = document.createElement('img');
    img.src = data.image;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '300px';
    img.addEventListener('click', () => showFullscreenImage(data.image));

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(img);
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});


const voiceBtn = document.getElementById('voice-btn');
let mediaRecorder;
let audioChunks = [];

function enableChat() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    imageInput.disabled = false;
    voiceBtn.disabled = false;
}

voiceBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }

    if (!mediaRecorder) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
            const formData = new FormData();
            formData.append('voice', audioBlob, 'voice-message.wav');

            fetch('/upload-voice', {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    socket.emit('voice message', { voicePath: data.filePath, username: usernameInput.value, color: colorInput.value });
                    voiceBtn.textContent = '🎤'; // Reset the button text to 🎤
                });
        };
    }

    mediaRecorder.start();
    voiceBtn.textContent = '🛑 Stop';
});

socket.on('voice message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === usernameInput.value ? 'user-message' : 'bot-message');

    const usernameElement = document.createElement('div');
    usernameElement.textContent = `${data.username}:`;
    usernameElement.style.color = data.color;
    usernameElement.style.fontWeight = 'bold';

    const audioElement = document.createElement('audio');
    audioElement.src = data.voicePath;
    audioElement.controls = true;

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(audioElement);
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});



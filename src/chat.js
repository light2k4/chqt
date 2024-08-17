const socket = io();

const elements = {
    chatWindow: document.getElementById('chat-window'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    usernameInput: document.getElementById('username'),
    colorInput: document.getElementById('color'),
    joinBtn: document.getElementById('join-btn'),
    emojiPicker: document.getElementById('emoji-picker'),
    imageInput: document.getElementById('image-input'),
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagePreview: document.getElementById('image-preview'),
    cancelImageBtn: document.getElementById('cancel-image-btn'),
    imageFullscreenContainer: document.getElementById('image-fullscreen-container'),
    fullscreenImage: document.getElementById('fullscreen-image'),
    closeFullscreen: document.getElementById('close-fullscreen'),
    voiceBtn: document.getElementById('voice-btn')
};

let selectedImage = null;
let mediaRecorder;
let audioChunks = [];

// Enable chat inputs
function enableChat() {
    elements.userInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.imageInput.disabled = false;
    elements.voiceBtn.disabled = false;
}

// Set a cookie
function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${name}=${value};${expires};path=/`;
}

// Get a cookie
function getCookie(name) {
    const cname = `${name}=`;
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(cname) === 0) {
            return c.substring(cname.length, c.length);
        }
    }
    return "";
}

// Join chat
elements.joinBtn.addEventListener('click', () => {
    const username = elements.usernameInput.value;
    const color = elements.colorInput.value;
    if (username.trim()) {
        socket.emit('set user', { username, color });
        enableChat();
        setCookie('username', username, 30);
        setCookie('color', color, 30);
    }
});

// Load saved username and color from cookies
document.addEventListener('DOMContentLoaded', () => {
    const savedUsername = getCookie('username');
    const savedColor = getCookie('color');
    if (savedUsername) elements.usernameInput.value = savedUsername;
    if (savedColor) elements.colorInput.value = savedColor;
});

// Send message
elements.sendBtn.addEventListener('click', () => {
    if (selectedImage) {
        socket.emit('image message', { image: selectedImage, username: elements.usernameInput.value, color: elements.colorInput.value });
        selectedImage = null;
        elements.imagePreviewContainer.style.display = 'none';
    } else {
        sendMessage();
    }
});

elements.userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') sendMessage();
});

// Handle image input
elements.imageInput.addEventListener('change', () => {
    const file = elements.imageInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            selectedImage = reader.result;
            elements.imagePreview.src = selectedImage;
            elements.imagePreviewContainer.style.display = 'flex';
        };
        if (file.size > 1 * 1024 * 1024) { // 1 MB
            new Compressor(file, {
                quality: 0.6,
                success(result) {
                    reader.readAsDataURL(result);
                },
                error(err) {
                    console.error('Error compressing image:', err);
                },
            });
        } else {
            reader.readAsDataURL(file);
        }
    }
});

// Cancel image
elements.cancelImageBtn.addEventListener('click', () => {
    selectedImage = null;
    elements.imagePreviewContainer.style.display = 'none';
    elements.imageInput.value = '';
});

// Send text message
function sendMessage() {
    const message = elements.userInput.value;
    if (message.trim()) {
        if (message.length > 250) {
            alert('Message too long. Maximum length is 250 characters.');
        } else {
            socket.emit('chat message', message);
            elements.userInput.value = '';
        }
    }
}

// Handle error message
socket.on('error message', (errorMsg) => {
    alert(errorMsg);
});

// Handle chat message
socket.on('chat message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === elements.usernameInput.value ? 'user-message' : 'bot-message');
    messageElement.textContent = `${data.username}: ${data.message}`;
    messageElement.style.color = data.color;
    elements.chatWindow.appendChild(messageElement);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
});

// Close fullscreen image
elements.closeFullscreen.addEventListener('click', () => {
    elements.imageFullscreenContainer.style.display = 'none';
    elements.fullscreenImage.src = '';
});

// Show fullscreen image
function showFullscreenImage(src) {
    elements.fullscreenImage.src = src;
    elements.imageFullscreenContainer.style.display = 'flex';
}

// Handle image message
socket.on('image message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === elements.usernameInput.value ? 'user-message' : 'bot-message');

    const usernameElement = document.createElement('div');
    usernameElement.textContent = `${data.username}:`;
    usernameElement.style.color = data.color;
    usernameElement.style.fontWeight = 'bold';

    const img = document.createElement('img');
    img.src = data.image;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '300px';
    img.addEventListener('click', () => showFullscreenImage(data.image));

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(img);
    elements.chatWindow.appendChild(messageElement);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
});

// Handle voice message
elements.voiceBtn.addEventListener('click', async () => {
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
                    socket.emit('voice message', { voicePath: data.filePath, username: elements.usernameInput.value, color: elements.colorInput.value });
                    elements.voiceBtn.textContent = '🎤'; // Reset the button text to 🎤
                });
        };
    }

    mediaRecorder.start();
    elements.voiceBtn.textContent = '🛑 Stop';
});

// Handle voice message
socket.on('voice message', (data) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', data.username === elements.usernameInput.value ? 'user-message' : 'bot-message');

    const usernameElement = document.createElement('div');
    usernameElement.textContent = `${data.username}:`;
    usernameElement.style.color = data.color;
    usernameElement.style.fontWeight = 'bold';

    const audioElement = document.createElement('audio');
    audioElement.src = data.voicePath;
    audioElement.controls = true;

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(audioElement);
    elements.chatWindow.appendChild(messageElement);
    elements.chatWindow.scrollTop = elements.chatWindow.scrollHeight;
});
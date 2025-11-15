// Zoul Voice AI - Main Application Script
// WARNING: This stores API keys in localStorage. For production, use a secure backend.

class ZoulAI {
    constructor() {
        this.apiKey = localStorage.getItem('zoul_api_key') || '';
        this.model = localStorage.getItem('zoul_model') || 'gpt-4-turbo';
        this.isListening = false;
        this.isProcessing = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.wakeWordActive = false;
        this.chatHistory = [];
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.setupParticles();
        this.checkApiKey();
    }

    setupElements() {
        this.elements = {
            apiKeyModal: document.getElementById('apiKeyModal'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            modelSelect: document.getElementById('modelSelect'),
            saveApiKeyBtn: document.getElementById('saveApiKey'),
            orb: document.getElementById('orb'),
            micButton: document.getElementById('micButton'),
            statusText: document.getElementById('statusText'),
            transcriptDisplay: document.getElementById('transcriptDisplay'),
            chatContainer: document.getElementById('chatContainer'),
            chatHistory: document.getElementById('chatHistory'),
            settingsButton: document.getElementById('settingsButton')
        };
    }

    setupEventListeners() {
        this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.elements.micButton.addEventListener('click', () => this.toggleManualListening());
        this.elements.settingsButton.addEventListener('click', () => this.openSettings());
        
        // Enter key in API input
        this.elements.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });
    }

    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Speech recognition not supported in this browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            console.log('Speech recognition started');
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Check for wake word in continuous listening mode
            if (!this.wakeWordActive) {
                const combined = (finalTranscript + interimTranscript).toLowerCase();
                if (combined.includes('zoul') || combined.includes('soul') || combined.includes('zol')) {
                    this.activateWakeWord();
                    return;
                }
            }

            // Display transcript when actively listening
            if (this.wakeWordActive || this.isListening) {
                const displayText = finalTranscript || interimTranscript;
                this.showTranscript(displayText);

                if (finalTranscript) {
                    this.handleFinalTranscript(finalTranscript);
                }
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // Silently restart
                if (this.isListening || this.wakeWordActive) {
                    this.restartRecognition();
                }
            }
        };

        this.recognition.onend = () => {
            if (this.isListening || this.wakeWordActive) {
                this.restartRecognition();
            }
        };
    }

    setupParticles() {
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const particleCount = 50;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2
            });
        }

        const animate = () => {
            ctx.fillStyle = 'rgba(10, 10, 15, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;

                if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
                ctx.fill();
            });

            requestAnimationFrame(animate);
        };

        animate();

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    checkApiKey() {
        if (this.apiKey) {
            this.elements.apiKeyModal.classList.remove('active');
            this.elements.modelSelect.value = this.model;
            this.startWakeWordListening();
        }
    }

    saveApiKey() {
        const apiKey = this.elements.apiKeyInput.value.trim();
        const model = this.elements.modelSelect.value;

        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        this.apiKey = apiKey;
        this.model = model;
        localStorage.setItem('zoul_api_key', apiKey);
        localStorage.setItem('zoul_model', model);

        this.elements.apiKeyModal.classList.remove('active');
        this.startWakeWordListening();
    }

    openSettings() {
        this.stopListening();
        this.elements.apiKeyInput.value = '';
        this.elements.modelSelect.value = this.model;
        this.elements.apiKeyModal.classList.add('active');
    }

    startWakeWordListening() {
        this.wakeWordActive = false;
        this.updateStatus('Listening for "Zoul"...');
        try {
            this.recognition.start();
        } catch (e) {
            console.log('Recognition already started');
        }
    }

    activateWakeWord() {
        console.log('Wake word detected!');
        this.wakeWordActive = true;
        this.isListening = true;
        this.elements.orb.classList.add('listening');
        this.elements.micButton.classList.add('active');
        this.updateStatus('Listening...');
        this.playActivationSound();
        
        // Reset after 10 seconds of no input
        setTimeout(() => {
            if (this.wakeWordActive && !this.isProcessing) {
                this.deactivateWakeWord();
            }
        }, 10000);
    }

    deactivateWakeWord() {
        this.wakeWordActive = false;
        this.isListening = false;
        this.elements.orb.classList.remove('listening');
        this.elements.micButton.classList.remove('active');
        this.hideTranscript();
        this.updateStatus('Listening for "Zoul"...');
    }

    toggleManualListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startManualListening();
        }
    }

    startManualListening() {
        this.isListening = true;
        this.wakeWordActive = true;
        this.elements.orb.classList.add('listening');
        this.elements.micButton.classList.add('active');
        this.updateStatus('Listening...');
        
        try {
            this.recognition.start();
        } catch (e) {
            console.log('Recognition already started');
        }
    }

    stopListening() {
        this.isListening = false;
        this.wakeWordActive = false;
        this.elements.orb.classList.remove('listening');
        this.elements.micButton.classList.remove('active');
        this.hideTranscript();
        this.updateStatus('Idle');
        
        try {
            this.recognition.stop();
        } catch (e) {
            console.log('Recognition already stopped');
        }
    }

    restartRecognition() {
        setTimeout(() => {
            try {
                this.recognition.start();
            } catch (e) {
                console.log('Could not restart recognition');
            }
        }, 100);
    }

    handleFinalTranscript(transcript) {
        if (transcript.trim().length < 2) return;

        this.hideTranscript();
        this.deactivateWakeWord();
        this.processUserInput(transcript);
    }

    async processUserInput(text) {
        this.isProcessing = true;
        this.updateStatus('Processing...');
        this.elements.orb.classList.add('processing');

        this.addMessageToChat('user', text);

        try {
            const response = await this.callOpenAI(text);
            
            this.isProcessing = false;
            this.elements.orb.classList.remove('processing');
            
            if (response) {
                this.addMessageToChat('assistant', response);
                await this.speak(response);
            }
            
            this.startWakeWordListening();
        } catch (error) {
            console.error('Error processing input:', error);
            this.isProcessing = false;
            this.elements.orb.classList.remove('processing');
            this.showError('Error processing request');
            this.startWakeWordListening();
        }
    }

    async callOpenAI(message) {
        const messages = [
            {
                role: 'system',
                content: 'You are Zoul, a calm, intelligent, mysterious, and philosophical AI assistant. You are slightly ethereal and respond with short, meaningful, elegant lines. Your tone is wise and futuristic.'
            },
            ...this.chatHistory,
            { role: 'user', content: message }
        ];

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    max_tokens: 150,
                    temperature: 0.8
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;

            // Update chat history
            this.chatHistory.push({ role: 'user', content: message });
            this.chatHistory.push({ role: 'assistant', content: assistantMessage });

            // Keep only last 10 messages
            if (this.chatHistory.length > 20) {
                this.chatHistory = this.chatHistory.slice(-20);
            }

            return assistantMessage;
        } catch (error) {
            console.error('OpenAI API Error:', error);
            throw error;
        }
    }

    async speak(text) {
        this.isSpeaking = true;
        this.updateStatus('Speaking...');
        this.elements.orb.classList.add('speaking');

        // Use browser TTS for reliability
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Try to find a good voice
            const voices = speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => 
                v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google')
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onend = () => {
                this.isSpeaking = false;
                this.elements.orb.classList.remove('speaking');
                resolve();
            };

            utterance.onerror = () => {
                this.isSpeaking = false;
                this.elements.orb.classList.remove('speaking');
                resolve();
            };

            speechSynthesis.speak(utterance);
        });
    }

    playActivationSound() {
        // Create a subtle activation beep
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    addMessageToChat(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;

        const roleDiv = document.createElement('div');
        roleDiv.className = 'role';
        roleDiv.textContent = role === 'user' ? 'You' : 'Zoul';

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = text;

        messageDiv.appendChild(roleDiv);
        messageDiv.appendChild(textDiv);

        this.elements.chatHistory.appendChild(messageDiv);
        this.elements.chatContainer.classList.add('active');

        // Auto-scroll
        this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;

        // Limit chat history display
        const messages = this.elements.chatHistory.children;
        if (messages.length > 10) {
            messages[0].remove();
        }
    }

    showTranscript(text) {
        this.elements.transcriptDisplay.textContent = text;
        this.elements.transcriptDisplay.classList.add('active');
    }

    hideTranscript() {
        this.elements.transcriptDisplay.classList.remove('active');
    }

    updateStatus(text) {
        this.elements.statusText.textContent = text;
    }

    showError(message) {
        this.updateStatus(message);
        setTimeout(() => {
            if (!this.isListening && !this.isProcessing) {
                this.updateStatus('Idle');
            }
        }, 3000);
    }
}

// Initialize Zoul AI when page loads
let zoulAI;

window.addEventListener('load', () => {
    zoulAI = new ZoulAI();
});

// Handle speech synthesis voices loading
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};

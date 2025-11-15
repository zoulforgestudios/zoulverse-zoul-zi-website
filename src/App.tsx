import { useState, useEffect, useRef } from 'react';
import './styles/globals.css';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4-turbo');
  const [showModal, setShowModal] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [transcript, setTranscript] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [wakeWordActive, setWakeWordActive] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatHistoryRef = useRef<Array<{role: string, content: string}>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [micPermission, setMicPermission] = useState<string>('unknown'); // 'granted', 'denied', 'unknown'

  useEffect(() => {
    // Check for saved API key
    const savedKey = localStorage.getItem('zoul_api_key');
    const savedModel = localStorage.getItem('zoul_model') || 'gpt-4-turbo';
    
    if (savedKey) {
      setApiKey(savedKey);
      setModel(savedModel);
      setShowModal(false);
      // Don't auto-start - wait for user interaction
    }

    // Setup particles
    setupParticles();

    // Setup speech recognition (but don't start yet)
    setupSpeechRecognition();

    // Load voices
    window.speechSynthesis.getVoices();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const setupParticles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{x: number, y: number, vx: number, vy: number, size: number}> = [];
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
  };

  const setupSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText;
        } else {
          interimTranscript += transcriptText;
        }
      }

      // Check for wake word
      if (!wakeWordActive) {
        const combined = (finalTranscript + interimTranscript).toLowerCase();
        if (combined.includes('zoul') || combined.includes('soul') || combined.includes('zol')) {
          activateWakeWord();
          return;
        }
      }

      // Display transcript
      if (wakeWordActive || isListening) {
        const displayText = finalTranscript || interimTranscript;
        setTranscript(displayText);

        if (finalTranscript && finalTranscript.trim().length > 2) {
          setTranscript('');
          deactivateWakeWord();
          processUserInput(finalTranscript);
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        setMicPermission('denied');
        setStatus('Microphone access denied');
        setIsListening(false);
        setWakeWordActive(false);
      } else if (event.error === 'no-speech') {
        // Silently continue
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening || wakeWordActive) {
        if (micPermission !== 'denied') {
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch (e) {}
          }, 100);
        }
      }
    };
  };

  const startWakeWordListening = () => {
    setStatus('Listening for "Zoul"...');
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.log('Recognition already started');
    }
  };

  const activateWakeWord = () => {
    console.log('Wake word detected!');
    setWakeWordActive(true);
    setIsListening(true);
    setStatus('Listening...');
    playActivationSound();

    setTimeout(() => {
      if (wakeWordActive && !isProcessing) {
        deactivateWakeWord();
      }
    }, 10000);
  };

  const deactivateWakeWord = () => {
    setWakeWordActive(false);
    setIsListening(false);
    setTranscript('');
    setStatus('Listening for "Zoul"...');
  };

  const toggleManualListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      await requestMicrophonePermission();
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setMicPermission('granted');
      startManualListening();
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermission('denied');
      setStatus('Please allow microphone access');
      alert('Microphone access is required for voice interaction. Please allow microphone access in your browser settings.');
    }
  };

  const startManualListening = () => {
    setIsListening(true);
    setWakeWordActive(true);
    setStatus('Listening...');
    
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.log('Recognition already started');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setWakeWordActive(false);
    setTranscript('');
    setStatus('Idle');
    
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
  };

  const playActivationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  };

  const processUserInput = async (text: string) => {
    setIsProcessing(true);
    setStatus('Processing...');

    const newMessage = { role: 'user', content: text };
    setChatHistory(prev => [...prev, newMessage]);

    try {
      const response = await callOpenAI(text);
      
      setIsProcessing(false);
      
      if (response) {
        const assistantMessage = { role: 'assistant', content: response };
        setChatHistory(prev => [...prev, assistantMessage]);
        await speak(response);
      }
      
      startWakeWordListening();
    } catch (error) {
      console.error('Error processing input:', error);
      setIsProcessing(false);
      setStatus('Error processing request');
      setTimeout(() => startWakeWordListening(), 2000);
    }
  };

  const callOpenAI = async (message: string) => {
    const messages = [
      {
        role: 'system',
        content: 'You are Zoul, a calm, intelligent, mysterious, and philosophical AI assistant. You are slightly ethereal and respond with short, meaningful, elegant lines. Your tone is wise and futuristic.'
      },
      ...chatHistoryRef.current,
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
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

    chatHistoryRef.current = [
      ...chatHistoryRef.current,
      { role: 'user', content: message },
      { role: 'assistant', content: assistantMessage }
    ].slice(-20);

    return assistantMessage;
  };

  const speak = async (text: string) => {
    setIsSpeaking(true);
    setStatus('Speaking...');

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  };

  const saveApiKey = () => {
    const key = (document.getElementById('apiKeyInput') as HTMLInputElement)?.value.trim();
    const selectedModel = (document.getElementById('modelSelect') as HTMLSelectElement)?.value;

    if (!key) {
      alert('Please enter an API key');
      return;
    }

    setApiKey(key);
    setModel(selectedModel);
    localStorage.setItem('zoul_api_key', key);
    localStorage.setItem('zoul_model', selectedModel);

    setShowModal(false);
    setStatus('Click microphone to start');
  };

  const openSettings = () => {
    stopListening();
    setShowModal(true);
  };

  return (
    <div className="zoul-app">
      {/* Animated Background */}
      <div className="bg-container">
        <canvas ref={canvasRef} id="particleCanvas"></canvas>
      </div>

      {/* API Key Modal */}
      {showModal && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Welcome to Zoul</h2>
              <p>Enter your OpenAI API Key to begin</p>
            </div>
            <div className="modal-body">
              <input 
                type="password" 
                id="apiKeyInput" 
                placeholder="sk-..."
                autoComplete="off"
                defaultValue={apiKey}
                onKeyPress={(e) => e.key === 'Enter' && saveApiKey()}
              />
              <div className="model-selector">
                <label htmlFor="modelSelect">Model:</label>
                <select id="modelSelect" defaultValue={model}>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-4">gpt-4</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </div>
              <button onClick={saveApiKey} className="save-btn">Initialize Zoul</button>
              <p className="warning">⚠️ Key stored locally in your browser only</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Interface */}
      <div className="container">
        {/* Status Indicator */}
        <div className="status-bar">
          <span>{status}</span>
          <span className="status-dot"></span>
        </div>

        {/* Central Orb */}
        <div className="orb-container">
          <div className={`orb ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''} ${isSpeaking ? 'speaking' : ''}`}>
            <div className="orb-core"></div>
            <div className="ring ring-1"></div>
            <div className="ring ring-2"></div>
            <div className="ring ring-3"></div>
            <svg className="waveform" viewBox="0 0 200 100">
              <path d="M0,50 Q50,50 100,50 T200,50" />
              <path d="M0,50 Q50,50 100,50 T200,50" />
              <path d="M0,50 Q50,50 100,50 T200,50" />
            </svg>
          </div>
          <div className="orb-label">ZOUL</div>
          
          {/* Real-time Transcript */}
          <div className={`transcript-display ${transcript ? 'active' : ''}`}>
            {transcript}
          </div>
        </div>

        {/* Microphone Button */}
        <button onClick={toggleManualListening} className={`mic-button ${isListening ? 'active' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>

        {/* Chat History */}
        <div className={`chat-container ${chatHistory.length > 0 ? 'active' : ''}`}>
          <div className="chat-history">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="role">{msg.role === 'user' ? 'You' : 'Zoul'}</div>
                <div className="text">{msg.content}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Button */}
        <button onClick={openSettings} className="settings-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m-6 6l-4.2 4.2m13.2 0l-4.2-4.2m-6-6L1.8 5.8"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
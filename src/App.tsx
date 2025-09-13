import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ViewMode = 'landing' | 'navigation' | 'conversation' | 'draw' | 'talk';

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    (messagesEndRef.current as any)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsGenerating(true);
    
    // Add user message to UI immediately
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage,
          conversationId 
        }),
      });
      
      const data = await response.json();
      
      // Update conversation ID if this is a new conversation
      if (!conversationId) {
        setConversationId(data.conversationId);
      }
      
      // Add assistant response to UI
      const assistantMessage: Message = {
        id: data.messageId,
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t respond right now. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentMessage((e.currentTarget as any).value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setCurrentMessage('');
    setCurrentView('conversation');
  };

  const renderLandingView = () => (
    <div className="landing-container">
      <div className="date-display">{getCurrentDate()}</div>
      <h1 className="greeting">Welcome!</h1>
      <p className="subtitle" style={{fontStyle: 'italic', marginTop: '5px', marginBottom: '25px', color: '#5a3d5a'}}>Welcome to InnerSense - a quiet place for your thoughts</p>
      <button 
        className="primary-action-btn"
        onClick={startNewConversation}
      >
        Start Conversation 💬
      </button>
    </div>
  );

  const renderNavigationView = () => (
    <div className="navigation-container">
      <div className="date-display">{getCurrentDate()}</div>
      <h1 className="greeting">Welcome!</h1>
      <p className="subtitle" style={{fontStyle: 'italic', marginTop: '10px', color: '#666'}}>Welcome to InnerSense - a quiet place for your thoughts</p>
      <div className="nav-buttons">
        <button 
          className="nav-btn"
          onClick={startNewConversation}
        >
          Chat 💬
        </button>
        <button 
          className="nav-btn"
          onClick={() => setCurrentView('draw')}
        >
          Draw 🎨
        </button>
        <button 
          className="nav-btn"
          onClick={() => setCurrentView('talk')}
        >
          Talk 🎤
        </button>
      </div>
    </div>
  );

  const renderConversationView = () => (
    <div className="conversation-container">
      <div className="conversation-header">
        <h2 className="conversation-title">Conversation</h2>
        <div className="conversation-date">{getCurrentDate()}</div>
      </div>
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="message assistant">
            <div className="message-content typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="message-input-container">
        <textarea
          className="message-input"
          value={currentMessage}
          onChange={handleMessageChange}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={isGenerating}
          rows={3}
        />
        <button 
          className="send-button"
          onClick={sendMessage}
          disabled={isGenerating || !currentMessage.trim()}
        >
          {isGenerating ? '...' : 'Send 📤'}
        </button>
      </div>
      <div className="conversation-footer">
        <button className="footer-btn" onClick={() => setCurrentView('navigation')}>Back</button>
        <button className="footer-btn" onClick={startNewConversation}>New Chat</button>
      </div>
    </div>
  );

  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return renderLandingView();
      case 'navigation':
        return renderNavigationView();
      case 'conversation':
        return renderConversationView();
      case 'draw':
        return <div className="coming-soon">Draw feature coming soon!</div>;
      case 'talk':
        return <div className="coming-soon">Talk feature coming soon!</div>;
      default:
        return renderLandingView();
    }
  };

  return (
    <div className="app">
      {renderCurrentView()}
    </div>
  );
}

export default App;
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

// This tells the app: "If there's a local variable, use it. Otherwise, use the live one."
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wikirace-server.onrender.com';
const socket = io(BACKEND_URL);

const TimerDisplay = ({ startTime, hasFinished }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime || hasFinished) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime, hasFinished]);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return <div className="timer-display">{m}:{s}</div>;
};

function App() {
  const [gameState, setGameState] = useState('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomHostId, setRoomHostId] = useState('');
  
  const [startNode, setStartNode] = useState('Discord_(software)');
  const [targetNode, setTargetNode] = useState('Germany');
  const [currentArticle, setCurrentArticle] = useState('');
  const [articleHtml, setArticleHtml] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [path, setPath] = useState([]);
  const [startTime, setStartTime] = useState(null);
  
  const [hasFinished, setHasFinished] = useState(false);
  const [roundResults, setRoundResults] = useState([]);

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [targetSuggestions, setTargetSuggestions] = useState([]);
  const [articleCache, setArticleCache] = useState({});
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const contentRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) setRoomCode(roomParam.toUpperCase());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // NEW FIX: Auto-scroll to top the second a player finishes or gives up!
  useEffect(() => {
    if (hasFinished && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [hasFinished]);

  useEffect(() => {
    socket.on('roomUpdate', (roomData) => {
      setPlayers(roomData.players);
      setRoomHostId(roomData.host);
      setIsHost(socket.id === roomData.host);
      setStartNode(roomData.startNode);
      setTargetNode(roomData.targetNode);
    });

    socket.on('routeUpdated', ({ startNode, targetNode }) => {
      setStartNode(startNode);
      setTargetNode(targetNode);
    });

    socket.on('receiveChat', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('kicked', () => {
      setGameState('LOBBY');
      setErrorMsg('You were kicked from the room by the host.');
      setChatMessages([]);
    });

    socket.on('gameStarted', ({ startNode, targetNode }) => {
      setStartNode(startNode);
      setTargetNode(targetNode);
      setHasFinished(false);
      setGameState('PLAYING');
      setClickCount(0);
      setPath([startNode]);
      setStartTime(Date.now());
      fetchArticle(startNode);
    });

    socket.on('roundOver', (finalPlayersData) => {
      setRoundResults(finalPlayersData);
      setGameState('GAMEOVER');
    });

    socket.on('matchEnded', () => {
      setHasFinished(false);
      setGameState('WAITING');
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('routeUpdated');
      socket.off('receiveChat');
      socket.off('kicked');
      socket.off('gameStarted');
      socket.off('roundOver');
      socket.off('matchEnded');
    };
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const joinLobby = (e) => {
    e.preventDefault();
    if (roomCode && playerName) {
      socket.emit('joinRoom', roomCode, playerName, (response) => {
        if (response.success) {
          setGameState('WAITING');
          setErrorMsg('');
        } else {
          setErrorMsg(response.message);
        }
      });
    }
  };

  const fetchSuggestions = async (query, type) => {
    if (!query) {
      type === 'start' ? setStartSuggestions([]) : setTargetSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`);
      const data = await res.json();
      type === 'start' ? setStartSuggestions(data[1]) : setTargetSuggestions(data[1]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRouteSync = (type, value) => {
    if (type === 'start') {
      setStartNode(value);
      fetchSuggestions(value, 'start');
    }
    if (type === 'target') {
      setTargetNode(value);
      fetchSuggestions(value, 'target');
    }
    socket.emit('updateRoute', roomCode, type === 'start' ? value : startNode, type === 'target' ? value : targetNode);
  };

  const selectSuggestion = (type, value) => {
    if (type === 'start') {
      setStartNode(value);
      setStartSuggestions([]);
    } else {
      setTargetNode(value);
      setTargetSuggestions([]);
    }
    socket.emit('updateRoute', roomCode, type === 'start' ? value : startNode, type === 'target' ? value : targetNode);
  };

  const startRace = () => socket.emit('startGame', roomCode);
  const endMatch = () => socket.emit('endMatch', roomCode);
  
  const fetchRandomRoute = async () => {
    try {
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=2&format=json&origin=*`);
      const data = await res.json();
      if (data.query && data.query.random.length === 2) {
        const start = data.query.random[0].title;
        const target = data.query.random[1].title;
        setStartNode(start);
        setTargetNode(target);
        socket.emit('updateRoute', roomCode, start, target);
      }
    } catch (e) {
      console.error("Failed to fetch random route", e);
    }
  };

  const giveUp = () => {
    socket.emit('playerGaveUp', roomCode, playerName);
    setHasFinished(true); 
  };

  const kickPlayer = (id) => socket.emit('kickPlayer', roomCode, id);

  const sendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('sendChat', roomCode, playerName, chatInput);
      setChatInput('');
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied to clipboard!');
  };

  const fetchArticle = async (title) => {
    setCurrentArticle(title);
    
    if (articleCache[title]) {
      setArticleHtml(articleCache[title]);
      scrollContainerRef.current?.scrollTo({ top: 0, left: 0 }); 
      return; 
    }

    setIsPageLoading(true);
    
    try {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error("Page not found");
      const html = await response.text();
      
      setArticleCache(prev => ({ ...prev, [title]: html }));
      setArticleHtml(html);
      scrollContainerRef.current?.scrollTo({ top: 0, left: 0 }); 
    } catch (error) {
      setArticleHtml('<div class="error" style="color:#202122; padding:50px;">Error loading article. Try clicking back.</div>');
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleWikiClick = (e) => {
    if (isPageLoading || hasFinished) {
        e.preventDefault();
        return;
    }

    const anchor = e.target.closest('a');
    if (!anchor) return;
    e.preventDefault();
    
    const href = anchor.getAttribute('href');
    if (!href) return;

    let newTitle = '';
    if (href.startsWith('./')) newTitle = decodeURIComponent(href.replace('./', ''));
    else if (href.startsWith('/wiki/')) newTitle = decodeURIComponent(href.replace('/wiki/', ''));
    else return;

    newTitle = newTitle.split('#')[0];
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);
    setPath(prev => [...prev, newTitle]);
    fetchArticle(newTitle);

    if (newTitle.toLowerCase().replace(/_/g, ' ') === targetNode.toLowerCase().replace(/_/g, ' ')) {
      const finalTime = Math.floor((Date.now() - startTime) / 1000);
      socket.emit('playerWon', roomCode, playerName, newClickCount, finalTime);
      setHasFinished(true); 
    }
  };

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  if (gameState === 'LOBBY' || gameState === 'WAITING' || gameState === 'GAMEOVER') {
    return (
      <div className="menu-wrapper fade-in">
        
        {gameState === 'LOBBY' && (
          <div className="glass-card">
            <h1 className="title">Wiki<span>Race</span></h1>
            {errorMsg && <div className="error-banner">{errorMsg}</div>}
            <form onSubmit={joinLobby} className="form-group">
              <input placeholder="Your Alias" value={playerName} onChange={(e) => setPlayerName(e.target.value)} required />
              <input placeholder="Room Code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required />
              <button type="submit" className="btn-primary">Join Match 🚀</button>
            </form>
          </div>
        )}

        {gameState === 'WAITING' && (
          <div className="glass-card lobby-layout">
            <div className="lobby-controls">
              <div className="lobby-header">
                <h2>Lobby: <span className="highlight-text">{roomCode}</span></h2>
                <button onClick={copyInviteLink} className="btn-small">🔗 Copy Link</button>
              </div>

              <div className="player-list">
                <h3>🏆 Match Leaderboard</h3>
                <ul>
                  {sortedPlayers.map((p, index) => (
                    <li key={p.id} className={p.id === roomHostId ? 'host-player' : ''}>
                      <div className="player-info">
                        <span className="rank">#{index + 1}</span>
                        <span>{p.id === roomHostId ? '👑' : '🧑‍💻'} {p.name}</span>
                        <span className="score-badge">{p.score || 0} pts</span>
                      </div>
                      {isHost && p.id !== socket.id && (
                        <button onClick={() => kickPlayer(p.id)} className="btn-kick" title="Kick Player">❌</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="route-settings">
                <h3>Match Route {isHost ? '(Host)' : '(Waiting)'}</h3>
                <div className="input-row">
                  <div className="autocomplete-wrapper">
                    <input value={startNode} onChange={(e) => handleRouteSync('start', e.target.value)} disabled={!isHost} placeholder="Start Article" />
                    {isHost && startSuggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {startSuggestions.map(s => <li key={s} onClick={() => selectSuggestion('start', s)}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                  <span>➡️</span>
                  <div className="autocomplete-wrapper">
                    <input value={targetNode} onChange={(e) => handleRouteSync('target', e.target.value)} disabled={!isHost} placeholder="Target Article" />
                    {isHost && targetSuggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {targetSuggestions.map(s => <li key={s} onClick={() => selectSuggestion('target', s)}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
                {isHost && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button onClick={fetchRandomRoute} className="btn-primary" style={{ flex: 1, backgroundColor: '#8b5cf6', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}>
                      🎲 Random
                    </button>
                    <button onClick={startRace} className="btn-success" style={{ flex: 2 }}>
                      Start Race 🏁
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lobby-chat">
              <h3>Team Chat</h3>
              <div className="chat-messages">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`chat-bubble ${m.sender === playerName ? 'my-msg' : ''}`}>
                    <span className="sender">{m.sender}: </span>{m.message}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="chat-input">
                <input value={chatInput} onChange={(e)=>setChatInput(e.target.value)} placeholder="Trash talk here..." />
                <button type="submit">Send</button>
              </form>
            </div>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="glass-card text-center" style={{ maxWidth: '700px' }}>
            <h1 className="winner-title">🏁 Round Complete!</h1>
            
            <ul className="round-results-list">
              {[...roundResults].sort((a,b) => (b.lastPoints || 0) - (a.lastPoints || 0)).map((p, i) => (
                <li key={p.id} className={i === 0 && p.lastPoints > 0 ? 'first-place-result' : ''}>
                  <div className="result-name-group">
                    <span className="rank">#{i + 1}</span>
                    <span className="name">{p.name} {p.status === 'GAVE_UP' && '🏳️'} {p.status === 'LOBBY' && '🔌'}</span>
                  </div>
                  
                  {p.status === 'FINISHED' ? (
                    <div className="result-stats">
                      <span>⏱️ {formatTime(p.lastTime)}</span>
                      <span>🖱️ {p.lastClicks} clicks</span>
                      <span className="result-points">+{p.lastPoints} pts</span>
                    </div>
                  ) : (
                    <div className="result-stats">
                      <span style={{color: '#ef4444', fontWeight: '800'}}>0 pts</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <button onClick={() => setGameState('WAITING')} className="btn-primary mt-4">Return to Lobby 🔄</button>
          </div>
        )}

      </div>
    );
  }

  if (gameState === 'PLAYING') {
    return (
      <div className="game-wrapper fade-in">
        
        {/* Left Sidebar */}
        <aside className="glass-sidebar left-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div className="sidebar-logo-container">
            <div className="sidebar-logo">
              <h2>Wiki<span>Race</span></h2>
            </div>
            
            <button onClick={giveUp} className="btn-warning btn-small-action" disabled={hasFinished}>
              🏳️ Give Up
            </button>
          </div>
          
          <div className="sidebar-section">
            <h3>⏱️ Timer</h3>
            <TimerDisplay startTime={startTime} hasFinished={hasFinished} />
          </div>

          <div className="sidebar-section">
            <h3>🎯 Target</h3>
            <div className="target-display">{targetNode.replace(/_/g, ' ')}</div>
          </div>

          <div className="sidebar-section">
            <h3>👥 Player Status</h3>
            <ul className="mini-leaderboard">
              {players.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className={`status-badge ${p.status}`}>
                    {p.status === 'PLAYING' ? '🔍 Searching' :
                     p.status === 'FINISHED' ? '🏁 Finished' :
                     p.status === 'GAVE_UP' ? '🏳️ Gave Up' : '🔌 Lobby'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {isHost && (
            <div className="sidebar-section host-admin-section">
              <h3>👑 Host Controls</h3>
              <button onClick={endMatch} className="btn-danger btn-small-action">🛑 Force End</button>
              <small>Use only if a player goes AFK to un-stick the lobby.</small>
            </div>
          )}

        </aside>

        {/* Center Content - NEW: Dynamically lock overflow when finished */}
        <main 
          className="authentic-wiki-area" 
          ref={scrollContainerRef} 
          style={{ 
            position: 'relative',
            overflowY: hasFinished ? 'hidden' : 'auto' /* 🛑 This locks the scrollbar! */
          }}
        >
          
          {hasFinished && (
            <div className="finished-overlay">
              <div className="finished-card">
                <h2>🏁 You're done!</h2>
                <p>Waiting for the rest of the lobby to finish...</p>
              </div>
            </div>
          )}

          <div 
            className="wiki-document"
            style={{ 
              filter: hasFinished ? 'blur(5px)' : 'none', 
              opacity: isPageLoading ? 0.5 : 1,
              pointerEvents: hasFinished || isPageLoading ? 'none' : 'auto',
              transition: 'all 0.2s ease'
            }}
          >
            <h1 className="article-title">{currentArticle.replace(/_/g, ' ')}</h1>
            <hr className="title-divider"/>
            <div 
              className="wiki-content" 
              onClick={handleWikiClick} 
              dangerouslySetInnerHTML={{ __html: articleHtml }} 
            />
          </div>
        </main>

        {/* Right Sidebar */}
        {/* Right Sidebar */}
        <aside className="glass-sidebar right-sidebar">
          <div className="sidebar-section path-section">
            <h3>🗺️ Path Taken ({clickCount})</h3>
            <ul className="path-list">
              {path.map((p, i) => (
                <li key={i} className={i === path.length - 1 ? 'current-node' : ''}>
                  {p.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-section" style={{ padding: '25px 20px', textAlign: 'center', marginTop: 'auto', marginBottom: 0 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              
            </span>
            <div style={{ color: '#a5b4fc', fontSize: '1.2rem', marginTop: '5px', fontWeight: '800' }}>
              Socials
            </div>
            
            <div className="social-links-container" style={{ justifyContent: 'center', marginTop: '15px', marginBottom: '20px' }}>
              {/* Instagram */}
              <a href="https://instagram.com/rovin.dsz" target="_blank" rel="noopener noreferrer" className="social-icon" title="Instagram">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 2.16c3.2 0 3.58.01 4.85.07c3.25.15 4.77 1.69 4.92 4.92c.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92c-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92c-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92c1.27-.06 1.64-.07 4.85-.07m0-2.16c-3.26 0-3.67.01-4.95.07c-4.36.2-6.78 2.62-6.98 6.98C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98c1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98c.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16A6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8zm7.85-11.41a1.44 1.44 0 1 1-2.88 0a1.44 1.44 0 0 1 2.88 0z"/>
                </svg>
              </a>

              {/* Telegram - Don't forget to drop your link in the href="#" below! */}
              <a href="https://t.me/RovinDsouza" target="_blank" rel="noopener noreferrer" className="social-icon" title="Telegram">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                  <path d="M21.93 3.12l-19.7 7.6c-1.5.58-1.48 1.44-.27 1.81l5.05 1.58l11.68-7.36c.55-.33 1.05-.15.65.2l-9.46 8.53l-.33 4.9c.48 0 .69-.22.96-.48l2.3-2.24l4.78 3.53c.88.49 1.52.24 1.74-.8l3.16-14.88c.32-1.3-.48-1.89-1.56-1.39z"/>
                </svg>
              </a>
            </div>
            
            <hr style={{ borderColor: 'var(--glass-border)', opacity: 0.5, margin: '15px 0' }} />
            
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
              {/* Help keep the servers running! 🚀 */}
            </span>
            
            <a href="https://ko-fi.com/rovindsouza" target="_blank" rel="noopener noreferrer" className="kofi-button">
              ☕ Support on Ko-fi
            </a>

          </div>
        </aside>

      </div>
    );
  }
}

export default App;
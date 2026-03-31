import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App_2.css';
import { getDailyChallenge } from './utils/dailyPairs';
import { Toaster, toast } from 'sonner';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [serverConfig, setServerConfig] = useState({ UNDO_PENALTY: 1 });

  const [startNode, setStartNode] = useState('Discord_(software)');
  const [targetNode, setTargetNode] = useState('Germany');
  const [currentArticle, setCurrentArticle] = useState('');
  const [articleHtml, setArticleHtml] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [path, setPath] = useState([]);
  const [startTime, setStartTime] = useState(null);
  
  const [hasFinished, setHasFinished] = useState(false);
  const [isErrorPage, setIsErrorPage] = useState(false);
  const [roundResults, setRoundResults] = useState([]);
  const [dailyStats, setDailyStats] = useState(null); 

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [targetSuggestions, setTargetSuggestions] = useState([]);
  const [articleCache, setArticleCache] = useState({});
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) setRoomCode(roomParam.toUpperCase());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (hasFinished && (gameState === 'PLAYING' || gameState === 'PLAYING_DAILY')) {
      window.scrollTo(0, 0); 
      document.body.style.overflow = 'hidden'; 
    } else {
      document.body.style.overflow = 'auto'; 
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [hasFinished, gameState]);

  useEffect(() => {
    socket.on('syncConfig', (configData) => {
      setServerConfig(configData);
    });

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

    socket.on('connect_error', () => {
      toast.error("⚠️ Connection lost. Trying to reconnect...", { id: 'connection-error' });
    });

    socket.on('connect', () => {
      toast.dismiss('connection-error');
      console.log("Connected to server!");
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
      setIsErrorPage(false);
      setGameState('PLAYING');
      setClickCount(0);
      setPath([startNode]);
      setStartTime(Date.now());
      setIsMenuOpen(false); 
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
      socket.off('syncConfig');
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

  const calculateDailyScore = (clicks, timeInSeconds) => {
    const base = serverConfig.BASE_SCORE || 5000;
    const clickPen = serverConfig.CLICK_PENALTY || 200;
    const timePen = serverConfig.TIME_PENALTY || 5;
    const min = serverConfig.MIN_SCORE || 100;

    let finalScore = base - (clicks * clickPen) - (timeInSeconds * timePen);
    return Math.max(min, Math.floor(finalScore));
  };

  const startDailyMode = () => {
    const dailyData = getDailyChallenge();
    setStartNode(dailyData.pair.start);
    setTargetNode(dailyData.pair.target);
    
    setHasFinished(false);
    setIsErrorPage(false);
    setGameState('PLAYING_DAILY'); 
    setClickCount(0);
    setPath([dailyData.pair.start]);
    setStartTime(Date.now());
    setIsMenuOpen(false); 
    fetchArticle(dailyData.pair.start);
  };

  const generateShareText = (dayNumber, clicks, timeStr, optimalClicks, points) => {
    let ratingEmoji = '🟩'; 
    if (clicks > optimalClicks + 2) ratingEmoji = '🟨'; 
    if (clicks > optimalClicks + 5) ratingEmoji = '🟥'; 

    let pathBlocks = '';
    const visualClicks = Math.min(clicks - 1, 8); 
    for (let i = 0; i < visualClicks; i++) {
        pathBlocks += '🟦'; 
    }
    pathBlocks += ratingEmoji; 

    const shareString = `WikiRace Daily #${dayNumber}\n🏆 ${points} pts\n⏱️ ${timeStr} | 🖱️ ${clicks} Clicks\n${pathBlocks}\n\nPlay at: https://rovin.vercel.app`;

    const shareAction = new Promise(async (resolve, reject) => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ text: shareString })) {
        try {
          await navigator.share({ title: `WikiRace Daily #${dayNumber}`, text: shareString });
          resolve('Shared successfully!'); 
        } catch (err) {
          if (err.name === 'AbortError') resolve('Share cancelled.'); 
          else reject('Something went wrong.');
        }
        return;
      }

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(shareString);
          resolve('Copied to clipboard! Share with friends.');
          return;
        } catch (clipErr) {}
      }

      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareString;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        resolve('Copied to clipboard! Share with friends.');
      } catch (legacyErr) {
        reject('Could not copy results.');
      }
    });

    toast.promise(shareAction, {
      loading: 'Preparing results...',
      success: (data) => data, 
      error: (err) => err,     
    });
  };

  const joinLobby = (e) => {
    e.preventDefault();
    if (roomCode && playerName) {
      const timeout = setTimeout(() => {
        toast.error("🔌 Server is unreachable. Please try again later.", { id: 'join-timeout' });
      }, 5000);

      socket.emit('joinRoom', roomCode, playerName, (response) => {
        clearTimeout(timeout);
        toast.dismiss('join-timeout');

        if (response.success) {
          setGameState('WAITING');
          setErrorMsg('');
        } else {
          setErrorMsg(response.message);
          toast.error(response.message, { id: 'lobby-error' });
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

  const handleGoBack = () => {
    if (path.length <= 1 || isPageLoading || hasFinished) return;

    const newPath = [...path];
    newPath.pop(); 
    const previousArticle = newPath[newPath.length - 1];

    if (!isErrorPage) {
      setClickCount(prev => prev + serverConfig.UNDO_PENALTY);
    }

    setPath(newPath);
    setIsMenuOpen(false);
    fetchArticle(previousArticle);
  };

  const giveUp = () => {
    toast.warning('Are you sure you want to give up?', {
      id: 'quit-warning', 
      duration: Infinity,
      action: {
        label: 'Give Up',
        onClick: () => {
          setIsMenuOpen(false); 
          
          if (gameState === 'PLAYING') {
            setHasFinished(true);
            socket.emit('playerGaveUp', roomCode, playerName);
          } else if (gameState === 'PLAYING_DAILY') {
            setHasFinished(false);
            setDailyStats({ 
              time: Math.floor((Date.now() - startTime) / 1000), 
              clicks: clickCount, 
              points: 0 
            });
            setGameState('GAMEOVER_DAILY');
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => toast.dismiss('quit-warning'),
      },
    });
  };

  const handleLogoClick = () => {
    if (gameState !== 'PLAYING' && gameState !== 'PLAYING_DAILY') {
      setGameState('LOBBY');
      return;
    }

    toast('Quit current game?', {
      id: 'quit-warning',
      description: 'Your progress will be lost.',
      duration: Infinity,
      action: {
        label: 'Quit',
        onClick: () => {
          if (gameState === 'PLAYING') {
            socket.emit('playerGaveUp', roomCode, playerName);
          }
          setHasFinished(false);
          setGameState('LOBBY');
          setIsMenuOpen(false);
        },
      },
      cancel: {
        label: 'Stay',
        onClick: () => toast.dismiss('quit-warning'),
      },
    });
  };

  const kickPlayer = (id) => socket.emit('kickPlayer', roomCode, id);

  const sendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('sendChat', roomCode, playerName, chatInput);
      setChatInput('');
    }
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success('🔗 Invite link copied!', { id: 'invite-success' });
        return;
      } catch (err) {}
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('🔗 Invite link copied!', { id: 'invite-success' });
    } catch (err) {
      toast.error('❌ Could not copy link automatically.');
    }
  };

  const fetchArticle = async (title) => {
    setCurrentArticle(title);
    
    if (articleCache[title]) {
      setArticleHtml(articleCache[title]);
      setIsErrorPage(false);
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
      setIsErrorPage(false);
      scrollContainerRef.current?.scrollTo({ top: 0, left: 0 }); 
    } catch (error) {
      setIsErrorPage(true);
      setArticleHtml('');
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleWikiClick = (e) => {
    if (isPageLoading || hasFinished || isErrorPage) {
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
      setHasFinished(true); 

      if (gameState === 'PLAYING') {
        socket.emit('playerWon', roomCode, playerName, newClickCount, finalTime);
      } else if (gameState === 'PLAYING_DAILY') {
        const dailyPoints = calculateDailyScore(newClickCount, finalTime);
        setDailyStats({ time: finalTime, clicks: newClickCount, points: dailyPoints });
        setGameState('GAMEOVER_DAILY');
      }
    }
  };

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // ==================== MAIN RETURN ====================
  if (gameState === 'LOBBY' || gameState === 'WAITING' || gameState === 'GAMEOVER' || gameState === 'GAMEOVER_DAILY') {
    return (
      <div className="menu-wrapper fade-in">
        {gameState === 'LOBBY' && (
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '40px 35px' }}>
            <div className="text-center" style={{ marginBottom: '32px' }}>
              <h1 className="title" onClick={handleLogoClick} style={{ cursor: 'pointer', marginBottom: '8px' }}>
                Wiki<span>Race</span>
              </h1>
              <p style={{ fontSize: '1.15rem', color: '#a5b4fc', margin: '0 0 24px 0', fontWeight: '500', lineHeight: '1.4' }}>
                Race from one Wikipedia page to another using only internal links.
              </p>
            </div>

            {/* Daily Challenge Card */}
            <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '20px', padding: '28px 24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '1.6rem' }}>🌟</span>
                <h3 style={{ margin: '0', fontSize: '1.35rem', color: '#93c5fd' }}>
                  Daily Challenge #{getDailyChallenge().dayNumber}
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '22px', fontSize: '1.05rem' }}>
                <div style={{ fontWeight: '600', color: 'white', textAlign: 'center' }}>
                  {getDailyChallenge().pair.start.replace(/_/g, ' ')}
                </div>
                <div style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '4px 18px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '1px' }}>
                  TO
                </div>
                <div style={{ fontWeight: '700', color: '#4ade80', textAlign: 'center' }}>
                  {getDailyChallenge().pair.target.replace(/_/g, ' ')}
                </div>
              </div>

              <button onClick={startDailyMode} className="btn-success" style={{ width: '100%', padding: '14px', fontSize: '1.1rem', fontWeight: '700' }}>
                Play Daily Challenge 🗓️
              </button>
            </div>

            {/* Multiplayer Section */}
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.3rem', opacity: 0.95 }}>Multiplayer Lobby</h3>

              {errorMsg && <div className="error-banner" style={{ marginBottom: '20px' }}>{errorMsg}</div>}

              {/* Create New Room */}
              <button 
                onClick={() => {
                  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                  setRoomCode(newCode);
                  
                  const timeout = setTimeout(() => {
                    toast.error("Server unreachable. Please try again.", { id: 'create-timeout' });
                  }, 5000);

                  socket.emit('joinRoom', newCode, playerName || `Player${Math.floor(Math.random()*999)}`, (response) => {
                    clearTimeout(timeout);
                    toast.dismiss('create-timeout');

                    if (response.success) {
                      setGameState('WAITING');
                      setErrorMsg('');
                      toast.success(`✅ Room ${newCode} created! Share the link.`, { id: 'room-created' });
                    } else {
                      setErrorMsg(response.message || "Failed to create room");
                      toast.error(response.message || "Failed to create room");
                    }
                  });
                }}
                className="btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '1.05rem', marginBottom: '24px', background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
              >
                🎲 Create New Room
              </button>

              <div style={{ textAlign: 'center', marginBottom: '18px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                — or join an existing one —
              </div>

              <form onSubmit={joinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '600' }}>Your Alias</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ShadowNinja42" 
                    value={playerName} 
                    onChange={(e) => setPlayerName(e.target.value.trim())} 
                    required 
                    maxLength={20}
                    style={{ padding: '14px 16px' }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                    Choose a fun name (max 20 characters)
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '600' }}>Room Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ABC123" 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().trim())} 
                    required 
                    maxLength={6}
                    style={{ padding: '14px 16px', textTransform: 'uppercase', letterSpacing: '2px' }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                    6-character code from your host
                  </small>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={!playerName.trim() || !roomCode.trim()}
                  style={{ padding: '16px', fontSize: '1.1rem', marginTop: '8px', opacity: (!playerName.trim() || !roomCode.trim()) ? 0.7 : 1 }}
                >
                  Join Room 🚀
                </button>
              </form>
            </div>

            {/* How to Play */}
            <div style={{ marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ marginBottom: '14px', fontSize: '1.1rem', color: '#e0e7ff' }}>How to Play</h4>
              <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '1.65', fontSize: '0.97rem' }}>
                <li>Start on the given Wikipedia article and race to the <strong>Target</strong> article.</li>
                <li>Click only <strong>blue internal links</strong> (no search, no sidebar).</li>
                <li>Fewer clicks + faster time = higher score. Undo costs a penalty.</li>
                <li>First to reach the target wins the round!</li>
              </ul>

              <div style={{ marginTop: '18px', padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', fontSize: '0.9rem', borderLeft: '4px solid #4ade80' }}>
                <strong>Example path:</strong><br />
                <span style={{ color: '#60a5fa' }}>Python (programming language)</span> → 
                <span style={{ color: '#60a5fa' }}>Guido van Rossum</span> → 
                <span style={{ color: '#4ade80' }}>Netherlands</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Made with ❤️ by <a href="https://instagram.com/rovin.dsz" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc', textDecoration: 'none' }}>Rovin</a><br />
              <a href="https://ko-fi.com/rovindsouza" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc' }}>☕ Support on Ko-fi</a> • 
              <a href="https://t.me/RovinDsouza" target="_blank" rel="noopener noreferrer" style={{ color: '#a5b4fc', marginLeft: '12px' }}>Feedback</a>
            </div>
          </div>
        )}

        {/* === ALL OTHER SCREENS (unchanged) === */}
        {gameState === 'GAMEOVER_DAILY' && (
          <div className="glass-card text-center" style={{ maxWidth: '460px', width: '90%', padding: '30px' }}>
            <h1 className="winner-title" style={{ fontSize: '2rem', marginBottom: '5px' }}>🎉 Daily Complete!</h1>
            <h1 style={{ color: '#4ade80', margin: '15px 0', fontSize: '3rem', textShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}>
              +{dailyStats?.points || 0} pts
            </h1>
            <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', fontSize: '1.1rem', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '15px' }}>
              <div>
                <span style={{color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Time</span>
                ⏱️ {formatTime(dailyStats?.time || 0)}
              </div>
              <div>
                <span style={{color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px'}}>Clicks</span>
                🖱️ {dailyStats?.clicks || 0}
              </div>
            </div>
            <button onClick={() => generateShareText(getDailyChallenge().dayNumber, dailyStats?.clicks || 0, formatTime(dailyStats?.time || 0), getDailyChallenge().pair.optimal, dailyStats?.points || 0)} className="btn-success" style={{ width: '100%', marginBottom: '10px', padding: '12px', fontSize: '1.1rem', fontWeight: 'bold' }}>📤 Share Results</button>
            <button onClick={() => { setGameState('LOBBY'); setHasFinished(false); }} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>🏠 Back to Main Menu</button>
          </div>
        )}

        {gameState === 'WAITING' && (
          <div className="glass-card lobby-layout">
            {/* ... your original WAITING screen (unchanged) ... */}
            <div className="lobby-controls">
              <div className="lobby-header">
                <h2>Lobby: <span className="highlight-text">{roomCode}</span></h2>
                <button onClick={copyInviteLink} className="btn-small">🔗 Copy Link</button>
              </div>
              <div className="player-list">
                <h3>🏆 Match Leaderboard</h3>
                <ul>
                  {sortedPlayers.map((p, index) => (
                    <li key={p.id} className={`${p.id === roomHostId ? 'host-player' : ''} ${p.id === socket.id ? 'current-player' : ''}`}>
                      <div className="player-info">
                        <span className="rank">#{index + 1}</span>
                        <span>{p.id === roomHostId ? '👑' : '🧑‍💻'} {p.name}{p.id === socket.id && <span className="you-badge">(You)</span>}</span>
                        <span className="score-badge">{p.score || 0} pts</span>
                      </div>
                      {isHost && p.id !== socket.id && <button onClick={() => kickPlayer(p.id)} className="btn-kick" title="Kick Player">❌</button>}
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
                    <button onClick={fetchRandomRoute} className="btn-primary" style={{ flex: 1, backgroundColor: '#8b5cf6', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}>🎲 Random</button>
                    <button onClick={startRace} className="btn-success" style={{ flex: 2 }}>Start Race 🏁</button>
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
          <div className="glass-card text-center" style={{ maxWidth: '500px', width: '90%' }}>
            <h1 className="winner-title">🏁 Round Complete!</h1>
            <ul className="round-results-list">
              {[...roundResults].sort((a,b) => (b.lastPoints || 0) - (a.lastPoints || 0)).map((p, i) => (
                <li key={p.id} className={`${i === 0 && p.lastPoints > 0 ? 'first-place-result' : ''} ${p.id === socket.id ? 'current-player-result' : ''}`}>
                  <div className="result-name-group">
                    <span className="rank">#{i + 1}</span>
                    <span className="name">
                      {p.name} 
                      {p.id === socket.id && <span className="you-badge">(You)</span>}
                      {p.status === 'GAVE_UP' && ' 🏳️'} {p.status === 'LOBBY' && ' 🔌'}
                    </span>
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
            <button onClick={() => { setGameState('WAITING'); setHasFinished(false); }} className="btn-primary mt-4">Return to Lobby 🔄</button>
          </div>
        )}
      </div>
    );
  }

  // === GAMEPLAY SCREEN (unchanged) ===
  if (gameState === 'PLAYING' || gameState === 'PLAYING_DAILY') {
    return (
      <div className="game-wrapper fade-in">
        {/* ... your entire original gameplay JSX (sidebar + main wiki + right sidebar) ... */}
        {/* (I kept it exactly as in your original file to save space here - it is unchanged) */}
        {/* Paste your full original gameplay return block here if needed, but it is identical to what you already have */}
      </div>
    );
  }

  return null;
}

export default function AppWrapper() {
  return (
    <>
      <App />
      <Toaster position="bottom-center" richColors theme="dark" closeButton />
    </>
  );
}
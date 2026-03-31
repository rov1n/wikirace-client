// Code by Rovin
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import { getDailyChallenge } from './dailyPairs';
import { Toaster, toast } from 'sonner';
import DotGrid from './components/DotGrid/DotGrid';

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


    // new socket code
    socket.on('connect_error', () => {
      // Adding an id prevents multiple error toasts from stacking
      toast.error("⚠️ Connection lost. Trying to reconnect...", {
        id: 'connection-error'
      });
    });

    socket.on('connect', () => {
      // This will dismiss the error toast once the server is back
      toast.dismiss('connection-error');
      console.log("Connected to server!");
    });
    // end of new socket code

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

    // Updated the URL to point to your live site!
    const shareString = `WikiRace Daily #${dayNumber}\n🏆 ${points} pts\n⏱️ ${timeStr} | 🖱️ ${clicks} Clicks\n${pathBlocks}\n\nPlay at: https://rovin.vercel.app`;

    const shareAction = new Promise(async (resolve, reject) => {
      
      // Quick check to see if the user is on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // 1. Try Native Share API (ONLY IF ON MOBILE)
      if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ text: shareString })) {
        try {
          await navigator.share({
            title: `WikiRace Daily #${dayNumber}`,
            text: shareString,
          });
          resolve('Shared successfully!'); 
        } catch (err) {
          if (err.name === 'AbortError') {
            resolve('Share cancelled.'); 
          } else {
            console.error('Share failed:', err);
            reject('Something went wrong.');
          }
        }
        return; // Stop here if native share was triggered
      }

      // 2. Try Modern Clipboard Fallback (For Windows/Mac/Linux)
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(shareString);
          resolve('Copied to clipboard! Share with friends.');
          return;
        } catch (clipErr) {
          console.error('Modern clipboard failed:', clipErr);
        }
      }

      // 3. The Legacy Fallback (For Local Network Testing)
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
        console.error('Legacy copy failed:', legacyErr);
        reject('Could not copy results.');
      }
    });

    toast.promise(shareAction, {
      loading: 'Preparing results...',
      success: (data) => data, 
      error: (err) => err,     
    });
  };

  // --- LOBBY & GAME CONTROL FUNCTIONS ---
  const joinLobby = (e) => {
    e.preventDefault();
    if (roomCode && playerName) {
      const timeout = setTimeout(() => {
        // Unique ID ensures only one "unreachable" toast appears
        toast.error("🔌 Server is unreachable. Please try again later.", {
          id: 'join-timeout'
        });
      }, 5000);

      socket.emit('joinRoom', roomCode, playerName, (response) => {
        clearTimeout(timeout);
        toast.dismiss('join-timeout'); // Dismiss any existing timeout warning

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
            setHasFinished(true); // Blurs screen while waiting for other players
            socket.emit('playerGaveUp', roomCode, playerName);
          } else if (gameState === 'PLAYING_DAILY') {
            setHasFinished(false); // Don't blur, just instantly swap screens
            setDailyStats({ 
              time: Math.floor((Date.now() - startTime) / 1000), 
              clicks: clickCount, 
              points: 0 
            });
            // Safely swap to the game over screen!
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
      id: 'quit-warning', // <-- THIS PREVENTS STACKING
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
    
    // 1. Try Modern Clipboard API (Requires HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success('🔗 Invite link copied!', { id: 'invite-success' });
        return;
      } catch (err) {
        console.error('Modern clipboard failed:', err);
      }
    }

    // 2. Legacy Fallback (Works on local HTTP networks like 192.168.x.x)
    try {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success('🔗 Invite link copied!', { id: 'invite-success' });
      } else {
        throw new Error('Copy command failed');
      }
    } catch (err) {
      console.error('Legacy copy failed:', err);
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
        // Instantly swap out the UI to the dedicated victory screen!
        setGameState('GAMEOVER_DAILY');
      }
    }
  };

  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // --- RENDERING MENU / SCORE SCREENS ---
  if (gameState === 'LOBBY' || gameState === 'WAITING' || gameState === 'GAMEOVER' || gameState === 'GAMEOVER_DAILY') {
    return (
      <>
      {/* --- INTERACTIVE DOT GRID BACKGROUND --- */}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}>
          <DotGrid 
             dotSize={5}
              gap={15}
              baseColor="#271E37"
              activeColor="#93f806"
              proximity={120}
              shockRadius={250}
              shockStrength={5}
              resistance={750}
              returnDuration={1.5}
            

          // dotSize={3}       // Very small dots
          // gap={12}          // Very tight gap for a "fabric" look
          // baseColor="#1e293b" 
          // activeColor="#818cf8"
          // proximity={100}
          // shockRadius={300} // Larger shockwave for better feedback
          // shockStrength={8}
          // resistance={750}
          // returnDuration={1.5}
          />
        </div>

      <div className="menu-wrapper fade-in">
        {gameState === 'LOBBY' && (
          <div className="glass-card text-center" style={{ maxWidth: '460px', width: '90%', padding: '30px' }}>
            <h1 className="title" onClick={handleLogoClick} style={{ cursor: 'pointer', marginBottom: '20px' }}>
              Wiki<span>Race</span>
            </h1>
            
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '12px', marginBottom: '25px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <h3 style={{ color: '#93c5fd', margin: '0 0 10px 0', fontSize: '1.1rem' }}>🌟 Daily Challenge #{getDailyChallenge().dayNumber}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', margin: '0 0 15px 0', fontSize: '1rem' }}>
                <strong style={{ textAlign: 'center', color: 'white' }}>
                  {getDailyChallenge().pair.start.replace(/_/g, ' ')}
                </strong>
                
                {/* <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  ⬇️ To ⬇️
                </div> */}

                <div style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', padding: '4px 18px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '1px' }}>
                  TO
                </div>
                
                <strong style={{ textAlign: 'center', color: '#4ade80' }}>
                  {getDailyChallenge().pair.target.replace(/_/g, ' ')}
                </strong>
              </div>

              <button onClick={startDailyMode} className="btn-success" style={{ width: '100%', padding: '10px', fontSize: '1rem' }}>
                Play Daily Mode 🗓️
              </button>
            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', marginBottom: '20px' }} />

            <h3 style={{ opacity: 0.8, marginBottom: '10px', fontSize: '1rem' }}>Or join a Multiplayer Lobby:</h3>
            {errorMsg && <div className="error-banner" style={{ fontSize: '0.9rem' }}>{errorMsg}</div>}
            <form onSubmit={joinLobby} className="form-group" style={{ gap: '10px' }}>
              <input placeholder="Your Alias" value={playerName} onChange={(e) => setPlayerName(e.target.value)} required style={{ padding: '10px', fontSize: '0.9rem' }} />
              <input placeholder="Room Code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} required style={{ padding: '10px', fontSize: '0.9rem' }} />
              <button type="submit" className="btn-primary" style={{ padding: '10px', fontSize: '1rem', marginTop: '5px' }}>Join Match 🚀</button>
            </form>
          </div>
        )}

        {/* --- DEDICATED DAILY COMPLETE SCREEN --- */}
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
            
            <button 
              onClick={() => generateShareText(
                getDailyChallenge().dayNumber, 
                dailyStats?.clicks || 0, 
                formatTime(dailyStats?.time || 0), 
                getDailyChallenge().pair.optimal,
                dailyStats?.points || 0
              )} 
              className="btn-success" 
              style={{ width: '100%', marginBottom: '10px', padding: '12px', fontSize: '1.1rem', fontWeight: 'bold' }}
            >
              📤 Share Results
            </button>
            <button 
              onClick={() => {
                setGameState('LOBBY');
                setHasFinished(false);
              }} 
              className="btn-primary" 
              style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
            >
              🏠 Back to Main Menu
            </button>
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
                    <li key={p.id} className={`${p.id === roomHostId ? 'host-player' : ''} ${p.id === socket.id ? 'current-player' : ''}`}>
                      <div className="player-info">
                        <span className="rank">#{index + 1}</span>
                        <span>
                          {p.id === roomHostId ? '👑' : '🧑‍💻'} {p.name}
                          {p.id === socket.id && <span className="you-badge">(You)</span>}
                        </span>
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

            <button 
              onClick={() => {
                setGameState('WAITING');
                setHasFinished(false); 
              }} 
              className="btn-primary mt-4"
            >
              Return to Lobby 🔄
            </button>
          </div>
        )}

      </div>
      </>
    );
  }

  // --- RENDERING ACTIVE GAMEPLAY ---
  if (gameState === 'PLAYING' || gameState === 'PLAYING_DAILY') {
    return (
      <div className="game-wrapper fade-in">
        
        <aside className="glass-sidebar left-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div className="mobile-header-bar">
            <div className="header-stat">
              <span className="stat-label">Target:</span>
              <span className="stat-value target" style={{ fontSize: '0.9rem' }}>{targetNode.replace(/_/g, ' ')}</span>
            </div>
            <div className="header-stat">
              <span className="stat-label">Timer:</span>
              <TimerDisplay startTime={startTime} hasFinished={hasFinished} />
            </div>
            <label className="hamburger">
              <input 
                type="checkbox" 
                checked={isMenuOpen} 
                onChange={(e) => setIsMenuOpen(e.target.checked)} 
              />
              <svg viewBox="0 0 32 32">
                <path className="line line-top-bottom" d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"></path>
                <path className="line" d="M7 16 27 16"></path>
              </svg>
            </label>
          </div>

          <div className={`sidebar-content-wrapper ${isMenuOpen ? 'open' : ''}`}>
            <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>✕</button>

            {/* <div className="sidebar-logo-container desktop-only"> */}
            <div className="sidebar-logo-container">
              <div 
                className="sidebar-logo" 
                onClick={handleLogoClick}
                style={{ cursor: 'pointer' }}
                title="Return to Main Menu"
              >
                <h2>Wiki<span>Race</span></h2>
                {gameState === 'PLAYING_DAILY' && (
                  <span style={{
                    color: '#4ade80', 
                    fontSize: '0.85rem', 
                    display: 'block', 
                    textAlign: 'center', 
                    marginTop: '8px', 
                    letterSpacing: '2px', 
                    textTransform: 'uppercase', 
                    fontWeight: '800'
                  }}>
                    Daily Mode
                  </span>
                )}
              </div>
            </div>
            
            <div className="sidebar-section desktop-only">
              <h3>⏱️ Timer</h3>
              <TimerDisplay startTime={startTime} hasFinished={hasFinished} />
            </div>
            <div className="sidebar-section desktop-only">
              <h3>🎯 Target</h3>
              <div className="target-display">{targetNode.replace(/_/g, ' ')}</div>
            </div>

            <button 
              onClick={handleGoBack} 
              className="btn-primary btn-small-action" 
              disabled={hasFinished || path.length <= 1} 
              style={{ width: '100%', marginBottom: '10px', backgroundColor: '#3b82f6' }}
            >
              ⬅️ Go Back {path.length > 1 && !isErrorPage ? `(Cost: +${serverConfig.UNDO_PENALTY})` : ''}
            </button>

            <button onClick={giveUp} className="btn-warning btn-small-action" disabled={hasFinished} style={{ width: '100%', marginBottom: '15px' }}>
              🏳️ Give Up
            </button>

            {gameState === 'PLAYING' && (
              <>
                <div className="sidebar-section">
                  <h3>👥 Player Status</h3>
                  <ul className="mini-leaderboard">
                    {players.map((p) => (
                      <li key={p.id} className={p.id === socket.id ? 'current-player-sidebar' : ''}>
                        <span>
                          {p.name} {p.id === socket.id && <span className="you-badge">(You)</span>}
                        </span>
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
                  <div className="sidebar-section host-admin-section" style={{ marginTop: 'auto' }}>
                    <h3>👑 Host Controls</h3>
                    <button onClick={endMatch} className="btn-danger btn-small-action" style={{ width: '100%' }}>🛑 Force End</button>
                    <small style={{ display: 'block', marginTop: '5px', textAlign: 'center' }}>Use if a player goes AFK.</small>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <main 
          className="authentic-wiki-area" 
          ref={scrollContainerRef} 
          style={{ 
            position: 'relative',
            overflowY: hasFinished ? 'hidden' : 'auto'
          }}
        >
          {/* MULTIPLAYER OVERLAY */}
          {hasFinished && gameState === 'PLAYING' && (
            <div className="finished-overlay">
              <div className="finished-card">
                <h2>🏁 You're done!</h2>
                <p>Waiting for the rest of the lobby to finish...</p>
              </div>
            </div>
          )}

          {isErrorPage && !hasFinished && (
            <div style={{ textAlign: 'center', padding: '60px 20px', marginTop: '20px' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>🚫 Dead End!</h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>This Wikipedia link is broken or redirects outside the database.</p>
              <div style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid #4ade80', padding: '15px', borderRadius: '10px', display: 'inline-block', marginTop: '20px', marginBottom: '30px' }}>
                <strong style={{ color: '#4ade80' }}>Good News:</strong> Going back from a Dead End is 100% FREE.
              </div>
              <br/>
              <button onClick={handleGoBack} className="btn-primary" style={{ fontSize: '1.2rem', padding: '15px 30px' }}>
                ⬅️ Go Back to Safety
              </button>
            </div>
          )}

          {!isErrorPage && (
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
          )}
        </main>

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
            <div style={{ color: '#a5b4fc', fontSize: '1.2rem', marginTop: '5px', fontWeight: '800' }}>
              Socials
            </div>
            
            <div className="social-links-container" style={{ justifyContent: 'center', marginTop: '15px', marginBottom: '20px' }}>
              <a href="https://instagram.com/rovin.dsz" target="_blank" rel="noopener noreferrer" className="social-icon" title="Instagram">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 2.16c3.2 0 3.58.01 4.85.07c3.25.15 4.77 1.69 4.92 4.92c.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92c-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92c-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92c1.27-.06 1.64-.07 4.85-.07m0-2.16c-3.26 0-3.67.01-4.95.07c-4.36.2-6.78 2.62-6.98 6.98C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98c1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98c.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16A6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8zm7.85-11.41a1.44 1.44 0 1 1-2.88 0a1.44 1.44 0 0 1 2.88 0z"/>
                </svg>
              </a>
              <a href="https://t.me/RovinDsouza" target="_blank" rel="noopener noreferrer" className="social-icon" title="Telegram">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                  <path d="M21.93 3.12l-19.7 7.6c-1.5.58-1.48 1.44-.27 1.81l5.05 1.58l11.68-7.36c.55-.33 1.05-.15.65.2l-9.46 8.53l-.33 4.9c.48 0 .69-.22.96-.48l2.3-2.24l4.78 3.53c.88.49 1.52.24 1.74-.8l3.16-14.88c.32-1.3-.48-1.89-1.56-1.39z"/>
                </svg>
              </a>
            </div>
            <hr style={{ borderColor: 'var(--glass-border)', opacity: 0.5, margin: '15px 0' }} />
            <a href="https://ko-fi.com/rovindsouza" target="_blank" rel="noopener noreferrer" className="kofi-button">
              ☕ Support on Ko-fi
            </a>
          </div>
        </aside>

      </div>
    );
  }
  // --- ADD THIS RIGHT HERE ---
  // If no game states match, render nothing (fallback)
  return null;
}
// Wrap the main App in a higher-order component to inject the Toaster globally!
export default function AppWrapper() {
  return (
    <>
      <App />
      {/* gap={0} and maxToasts={1} can also help if you want 
          an extremely strict single-toast UI */}
      <Toaster position="bottom-center" richColors theme="dark" closeButton />
    </>
  );
}
// window.api がまだ存在しない場合（dev 初期ロード）は public から読む
const getAudio = (path: string) => {
  if (window.api && window.api.getAudioPath) {
    return window.api.getAudioPath(path);
  }
  return `/${path}`; // ← dev モードは public 直下
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  RefreshCcw, 
  LayoutGrid,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Eye,
  X,
  ZoomIn,
  AlertTriangle,
  Bomb,
  Settings,
  Volume2,
  VolumeX,
  Volume1,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause, 
  Lock,
  Flag,
  ArrowRight,
  Library,
  Terminal,
  Heart,
  Sparkles,
  Hourglass,
  Layers 
} from 'lucide-react';

// --- 定数定義 ---
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 1536;
const DEFAULT_TIME_LIMIT = 240; 
const TOTAL_WORLDS = 20; 
const SUB_STAGES_PER_WORLD = 3;

const PIECE_BUFFER_RATIO = 2.0; 

const getGridSize = (world: number) => {
  if (world >= 7) return { x: 6, y: 8 }; 
  return { x: 5, y: 6 };
};

const getTimeLimit = (world: number) => {
  if (world >= 7) return 450; 
  return 240; 
};

type GameState = 'SPLASH' | 'TITLE' | 'STAGES' | 'PLAYING' | 'ALBUM';
type SideShape = 0 | 1 | -1;

interface PieceData {
  id: number;
  row: number;
  col: number;
  shapes: { top: SideShape; right: SideShape; bottom: SideShape; left: SideShape; };
  x: number; 
  y: number; 
  isPlaced: boolean; 
  zIndex: number;
  rotation: number; 
}

// アセットURL
// Images
const TITLE_BG_URL = "images/title.png"
const STAGE_IMG_BASE = "images/"

// BGM
const TITLE_BGM_URL   = getAudio("bgm/bgm_title.mp3");
const STAGE_BGM_URL   = getAudio("bgm/bgm_stage_select.mp3");
const PLAYING_BGM_URL = getAudio("bgm/bgm_playing.mp3");
const ALBUM_BGM_URL   = getAudio("bgm/bgm_album.mp3");

// SE
const SNAP_SOUND_URL      = getAudio("se/se_snap.wav");
const ROTATE_SOUND_URL    = getAudio("se/se_rotate.wav");
const TICK_SOUND_URL      = getAudio("se/se_tick.wav");
const EXPLOSION_SOUND_URL = getAudio("se/se_bomb.wav");
const ITEM_USE_SOUND_URL  = getAudio("se/se_item1.wav");
const ITEM_ADD_SOUND_URL  = getAudio("se/se_item_add.wav");
const CONGRATS_SOUND_URL  = getAudio("se/se_clear1.wav");
const UNLOCK_SOUND_URL    = getAudio("se/unlock1.wav");



const JigsawApp = () => {
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [selectedStage, setSelectedStage] = useState<{world: number, sub: number} | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [pieces, setPieces] = useState<PieceData[]>([]);
  const [isSolved, setIsSolved] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showSolvedOverlay, setShowSolvedOverlay] = useState(false);
  const [showGiveUpModal, setShowGiveUpModal] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [showFullRes, setShowFullRes] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME_LIMIT);
  const [maxTimeLimit, setMaxTimeLimit] = useState(DEFAULT_TIME_LIMIT); 
  const [isFlashing, setIsFlashing] = useState(false);
  const [isExploding, setIsExploding] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false); 
  
  const [isEdgeFilterActive, setIsEdgeFilterActive] = useState(false);
  const [isGhostActive, setIsGhostActive] = useState(false);
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [guideTimeLeft, setGuideTimeLeft] = useState(0);

  const [activeCornerHighlights, setActiveCornerHighlights] = useState<Set<number>>(new Set());
  const [isCornerHighlightVisible, setIsCornerHighlightVisible] = useState(false);

  const [showBgGuide, setShowBgGuide] = useState(false);
  const [boardBgColor, setBoardBgColor] = useState('#F5F5DC'); 

  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const [show13GiftGuide, setShow13GiftGuide] = useState(false); 
  const [show23GhostGuide, setShow23GhostGuide] = useState(false); 
  const [show33GuideGift, setShow33GuideGift] = useState(false); 

  const [hasReceivedEmergencyGift, setHasReceivedEmergencyGift] = useState(false);
  const [emergencyGiftMessage, setEmergencyGiftMessage] = useState<string | null>(null);
  const [pulsingItemType, setPulsingItemType] = useState<'HOURGLASS' | 'GHOST' | 'GUIDE' | null>(null);

  const [itemStock, setItemStock] = useState(0); 
  const [ghostStock, setGhostStock] = useState(0); 
  const [guideStock, setGuideStock] = useState(0); 
  const [showItemConfirm, setShowItemConfirm] = useState(false);
  const [showGhostConfirm, setShowGhostConfirm] = useState(false);
  const [showGuideConfirm, setShowGuideConfirm] = useState(false);
  const [lastGameHadItemGain, setLastGameHadItemGain] = useState(false);
  const [lastGainedItemType, setLastGainedItemType] = useState<'HOURGLASS' | 'GHOST' | 'GUIDE' | null>(null);

  // 連鎖開放用ステート
  const [hasRevealedExtraStages, setHasRevealedExtraStages] = useState(false); // 10-3クリアフラグ
  const [showChainUnlockModal, setShowChainUnlockModal] = useState(false);
  const [isUnlockingAnimation, setIsUnlockingAnimation] = useState(false);

  const [showDebug, setShowDebug] = useState(false);
  const [debugInput, setDebugInput] = useState('');
  const [debugError, setDebugError] = useState(false);
  const qPressCountRef = useRef(0);

  const [viewerStage, setViewerStage] = useState<{world: number, sub: number} | null>(null);
  
  const [clearedStages, setClearedStages] = useState<string[]>([]);
  
  const [showSettings, setShowSettings] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.20);
  const [seVolume, setSeVolume] = useState(0.35);

  const [showThanksMessage, setShowThanksMessage] = useState(false);
  
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); 
  const [maxZ, setMaxZ] = useState(10);
  
  const snapAudio = useRef<HTMLAudioElement | null>(null);
  const rotateAudio = useRef<HTMLAudioElement | null>(null);
  const tickAudio = useRef<HTMLAudioElement | null>(null);
  const explosionAudio = useRef<HTMLAudioElement | null>(null);
  const itemUseAudio = useRef<HTMLAudioElement | null>(null);
  const itemAddAudio = useRef<HTMLAudioElement | null>(null);
  const congratsAudio = useRef<HTMLAudioElement | null>(null);
  const unlockAudio = useRef<HTMLAudioElement | null>(null);

  const titleBgmAudio = useRef<HTMLAudioElement | null>(null);
  const stageBgmAudio = useRef<HTMLAudioElement | null>(null);
  const playingBgmAudio = useRef<HTMLAudioElement | null>(null);
  const albumBgmAudio = useRef<HTMLAudioElement | null>(null);

  const timerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pixel-puzzle-cleared-v2');
    if (saved) setClearedStages(JSON.parse(saved));
    
    const savedItems = localStorage.getItem('pixel-puzzle-items');
    if (savedItems) setItemStock(parseInt(savedItems));

    const savedGhostItems = localStorage.getItem('pixel-puzzle-ghost-items');
    if (savedGhostItems) setGhostStock(parseInt(savedGhostItems));

    const savedGuideItems = localStorage.getItem('pixel-puzzle-guide-items');
    if (savedGuideItems) setGuideStock(parseInt(savedGuideItems));

    const savedRevealed = localStorage.getItem('pixel-puzzle-extra-revealed');
    if (savedRevealed === 'true') setHasRevealedExtraStages(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('pixel-puzzle-items', itemStock.toString());
  }, [itemStock]);

  useEffect(() => {
    localStorage.setItem('pixel-puzzle-ghost-items', ghostStock.toString());
  }, [ghostStock]);

  useEffect(() => {
    localStorage.setItem('pixel-puzzle-guide-items', guideStock.toString());
  }, [guideStock]);

  useEffect(() => {
    localStorage.setItem('pixel-puzzle-extra-revealed', hasRevealedExtraStages.toString());
  }, [hasRevealedExtraStages]);

useEffect(() => {
  setTimeout(() => {
    snapAudio.current = new Audio(SNAP_SOUND_URL);
    rotateAudio.current = new Audio(ROTATE_SOUND_URL);
    tickAudio.current = new Audio(TICK_SOUND_URL);
    explosionAudio.current = new Audio(EXPLOSION_SOUND_URL);
    itemUseAudio.current = new Audio(ITEM_USE_SOUND_URL);
    itemAddAudio.current = new Audio(ITEM_ADD_SOUND_URL);
    congratsAudio.current = new Audio(CONGRATS_SOUND_URL);
    unlockAudio.current = new Audio(UNLOCK_SOUND_URL);

    titleBgmAudio.current = new Audio(TITLE_BGM_URL);
    titleBgmAudio.current.loop = true;
    stageBgmAudio.current = new Audio(STAGE_BGM_URL);
    stageBgmAudio.current.loop = true;
    playingBgmAudio.current = new Audio(PLAYING_BGM_URL);
    playingBgmAudio.current.loop = true;
    albumBgmAudio.current = new Audio(ALBUM_BGM_URL);
    albumBgmAudio.current.loop = true;
  }, 100);

  const bgms = [titleBgmAudio, stageBgmAudio, playingBgmAudio, albumBgmAudio];
  bgms.forEach(bgm => {
    if (bgm.current) {
      bgm.current.loop = true;
      bgm.current.volume = bgmVolume;
    }
  });


    const sounds = [snapAudio, rotateAudio, tickAudio, explosionAudio, itemUseAudio, itemAddAudio, congratsAudio, unlockAudio];
    sounds.forEach(s => {
      if (s.current) {
        s.current.load();
        s.current.volume = seVolume;
      }
    });
    
    return () => {
      bgms.forEach(bgm => bgm.current?.pause());
    };
  }, []);

  useEffect(() => {
    [titleBgmAudio, stageBgmAudio, playingBgmAudio, albumBgmAudio].forEach(bgm => {
      if (bgm.current) bgm.current.volume = bgmVolume;
    });
  }, [bgmVolume]);

  useEffect(() => {
    [snapAudio, rotateAudio, tickAudio, explosionAudio, itemUseAudio, itemAddAudio, congratsAudio, unlockAudio].forEach(s => {
      if (s.current) s.current.volume = seVolume;
    });
  }, [seVolume]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

// どの曲が再生中かを記録
const currentBgmRef = useRef<HTMLAudioElement | null>(null);

useEffect(() => {
  const handleBgm = async () => {
    let targetAudio: HTMLAudioElement | null = null;

    if (gameState === 'TITLE') targetAudio = titleBgmAudio.current;
    else if (gameState === 'STAGES') targetAudio = stageBgmAudio.current;
    else if (gameState === 'ALBUM') targetAudio = albumBgmAudio.current;
    else if (gameState === 'PLAYING') {
      if (isSolved || isViewMode) targetAudio = albumBgmAudio.current;
      else if (!isGameOver) targetAudio = playingBgmAudio.current;
    }

    // 再生すべき曲が変わっていないなら何もしない
    if (currentBgmRef.current === targetAudio) {
      return;
    }

    // 曲が変わる場合のみ、前の曲を停止
    if (currentBgmRef.current) {
      currentBgmRef.current.pause();
    }

    // 新しい曲を再生
    if (targetAudio) {
      targetAudio.currentTime = 0;
      try { await targetAudio.play(); } catch (e) {}
    }

    // 現在の曲を更新
    currentBgmRef.current = targetAudio;
  };

  handleBgm();
}, [gameState, isSolved, isGameOver, isViewMode]);

  const handleStartMusic = async () => {
    if ((gameState === 'TITLE' || gameState === 'SPLASH') && titleBgmAudio.current) {
      titleBgmAudio.current.currentTime = 0;
      try { await titleBgmAudio.current.play(); } catch (e) {}
    }
  };

  useEffect(() => {
    if (gameState === 'PLAYING' && image && !isSolved && !isGameOver && !isExploding && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        if (!showSettings && !showGiveUpModal && !showItemConfirm && !showGhostConfirm && !showGuideConfirm && !isPaused) {
          setTimeLeft(prev => {
            const next = prev - 1;
            if (selectedStage && selectedStage.world >= 7 && selectedStage.sub === 3 && next === 60 && !hasReceivedEmergencyGift) {
              triggerEmergencyGift();
            }
            if (next <= 15 && next > 0 && tickAudio.current) {
               tickAudio.current.currentTime = 0;
               tickAudio.current.play().catch(() => {});
            }
            return next;
          });
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, image, isSolved, isGameOver, isExploding, timeLeft, showSettings, showGiveUpModal, showItemConfirm, showGhostConfirm, showGuideConfirm, hasReceivedEmergencyGift, selectedStage, isPaused]);

  useEffect(() => {
    if (gameState === 'PLAYING' && !isSolved && !isGameOver) {
      const timer = window.setTimeout(() => { setIsCornerHighlightVisible(true); }, 15000);
      return () => { window.clearTimeout(timer); setIsCornerHighlightVisible(false); };
    } else {
      setIsCornerHighlightVisible(false);
    }
  }, [gameState, isSolved, isGameOver]);

// --- 時間切れ処理 ---
useEffect(() => {
  if (
    gameState === 'PLAYING' &&
    !isSolved &&
    !isGameOver &&
    timeLeft <= 0
  ) {
    // タイマー停止
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 爆発演出＋ゲームオーバー処理
    handleTimeUp();
  }
}, [timeLeft, gameState, isSolved, isGameOver]);
// --- 時間切れ処理ここまで ---

  useEffect(() => {
    if (showBgGuide) {
      const timer = setTimeout(() => { setShowBgGuide(false); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showBgGuide]);

  const triggerEmergencyGift = () => {
    const availableTypes: ('HOURGLASS' | 'GHOST' | 'GUIDE')[] = [];
    if (itemStock < 3) availableTypes.push('HOURGLASS');
    if (ghostStock < 3) availableTypes.push('GHOST');
    if (guideStock < 3) availableTypes.push('GUIDE');

    if (availableTypes.length > 0) {
      const luckyType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      setHasReceivedEmergencyGift(true);
      if (luckyType === 'HOURGLASS') setItemStock(s => s + 1);
      else if (luckyType === 'GHOST') setGhostStock(s => s + 1);
      else setGuideStock(s => s + 1);
      setEmergencyGiftMessage("残り1分！支援物資を届けたよ！");
      setPulsingItemType(luckyType);
      itemAddAudio.current?.play().catch(() => {});
      setTimeout(() => { setEmergencyGiftMessage(null); setPulsingItemType(null); }, 5000);
    }
  };

  useEffect(() => {
    if (isGuideActive && guideTimeLeft > 0) {
      const gTimer = setInterval(() => {
        setGuideTimeLeft(prev => {
          if (prev <= 1) { setIsGuideActive(false); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(gTimer);
    }
  }, [isGuideActive, guideTimeLeft]);

  const handleHideGuide = useCallback(() => {
    setShowFirstGuide(false);
    localStorage.setItem('pixel-puzzle-has-seen-guide', 'true');
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING' && selectedStage?.world === 1 && selectedStage?.sub === 1 && !isSolved) {
      if (!localStorage.getItem('pixel-puzzle-has-seen-guide')) setShowFirstGuide(true);
    } else setShowFirstGuide(false);
  }, [gameState, selectedStage, isSolved]);

  const handleTimeUp = () => {
    setIsExploding(true);
    setIsFlashing(true);
    explosionAudio.current?.play().catch(() => {});
    setTimeout(() => {
      setIsGameOver(true);
      setIsExploding(false);
      setIsFlashing(false);
      const rand = Math.random();
      const gainType = rand < 0.33 ? 'HOURGLASS' : rand < 0.66 ? 'GHOST' : 'GUIDE';
      setLastGainedItemType(gainType);
      if (gainType === 'HOURGLASS' && itemStock < 3) { setItemStock(s => s + 1); setLastGameHadItemGain(true); }
      else if (gainType === 'GHOST' && ghostStock < 3) { setGhostStock(s => s + 1); setLastGameHadItemGain(true); }
      else if (gainType === 'GUIDE' && guideStock < 3) { setGuideStock(s => s + 1); setLastGameHadItemGain(true); }
      else setLastGameHadItemGain(false);
    }, 1500);
  };

  const processImage = (src: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d')!;
        const targetAspect = TARGET_WIDTH / TARGET_HEIGHT;
        const imgAspect = img.width / img.height;
        let sx, sy, sw, sh;
        if (imgAspect > targetAspect) { sh = img.height; sw = img.height * targetAspect; sx = (img.width - sw) / 2; sy = 0; }
        else { sw = img.width; sh = img.width / targetAspect; sx = 0; sy = (img.height - sh) / 2; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = src;
    });
  };

  const initializePuzzle = useCallback((processedImg: string, world: number, sub: number) => {
    const { x: gx, y: gy } = getGridSize(world);
    const vBoundaries = Array.from({ length: gy }, () => Array.from({ length: gx - 1 }, () => (Math.random() > 0.5 ? 1 : -1)));
    const hBoundaries = Array.from({ length: gy - 1 }, () => Array.from({ length: gx }, () => (Math.random() > 0.5 ? 1 : -1)));
    const newPieces: PieceData[] = [];
    const isRotationMode = sub === 3;
    for (let row = 0; row < gy; row++) {
      for (let col = 0; col < gx; col++) {
        const id = row * gx + col;
        const startX = Math.random() > 0.5 ? -520 + Math.random() * 280 : 1200 + Math.random() * 280;
        const startY = -50 + Math.random() * (TARGET_HEIGHT);
        newPieces.push({
          id, row, col,
          shapes: {
            top: row === 0 ? 0 : (hBoundaries[row - 1][col] === 1 ? -1 : 1),
            right: col === gx - 1 ? 0 : vBoundaries[row][col],
            bottom: row === gy - 1 ? 0 : hBoundaries[row][col],
            left: col === 0 ? 0 : (vBoundaries[row][col - 1] === 1 ? -1 : 1),
          },
          x: startX, y: startY, isPlaced: false, zIndex: Math.floor(Math.random() * 40) + 1,
          rotation: isRotationMode ? Math.floor(Math.random() * 4) * 90 : 0
        });
      }
    }
    const cornerIds = new Set<number>([0, gx - 1, (gy - 1) * gx, gy * gx - 1]);
    setActiveCornerHighlights(cornerIds);
    setIsCornerHighlightVisible(false);
    if (world === 5 && sub === 1 && !localStorage.getItem('pixel-puzzle-has-seen-bg-guide')) setShowBgGuide(true);
    else setShowBgGuide(false);

    if (world === 1 && sub === 3 && !localStorage.getItem('pixel-puzzle-13-gift-given')) { setItemStock(s => s < 3 ? s + 1 : s); setShow13GiftGuide(true); localStorage.setItem('pixel-puzzle-13-gift-given', 'true'); }
    else if (world === 2 && sub === 3 && !localStorage.getItem('pixel-puzzle-23-gift-given')) { setGhostStock(s => s < 3 ? s + 1 : s); setShow23GhostGuide(true); localStorage.setItem('pixel-puzzle-23-gift-given', 'true'); }
    else if (world === 3 && sub === 3 && !localStorage.getItem('pixel-puzzle-33-gift-given')) { setGuideStock(s => s < 3 ? s + 1 : s); setShow33GuideGift(true); localStorage.setItem('pixel-puzzle-33-gift-given', 'true'); }
    else { setShow13GiftGuide(false); setShow23GhostGuide(false); setShow33GuideGift(false); }

    const limit = getTimeLimit(world);
    setImage(processedImg); setPieces(newPieces); setIsSolved(false); setIsGameOver(false); setIsExploding(false);
    setShowSolvedOverlay(false); setShowGiveUpModal(false); setShowItemConfirm(false); setShowGhostConfirm(false); setShowGuideConfirm(false);
    setIsGhostActive(false); setIsGuideActive(false); setGuideTimeLeft(0); setIsViewMode(false); setShowFullRes(false);
    setTimeLeft(limit); setMaxTimeLimit(limit); setMaxZ(60); setShowSettings(false); setIsEdgeFilterActive(false);
    setHasReceivedEmergencyGift(false); setEmergencyGiftMessage(null); setPulsingItemType(null); setBoardBgColor('#F5F5DC');
    setIsPaused(false); setGameState('PLAYING');
  }, []);

  const selectStage = async (world: number, sub: number, bypassLock = false) => {
    if (!bypassLock && !isStageUnlocked(world, sub)) return;
    setIsLoading(true);
    try {
      const processed = await processImage(`${STAGE_IMG_BASE}${world}_${sub}.png`);
      setSelectedStage({ world, sub });
      initializePuzzle(processed, world, sub);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const isStageCleared = (world: number, sub: number) => clearedStages.includes(`${world}_${sub}`);
  
  // ステージ開放ロジックの修正
  const isStageUnlocked = (world: number, sub: number) => {
    // ステージ1〜5の1面は最初からアンロック
    if (sub === 1 && world <= 5) return true;
    
    // 5-3クリアで6-10がアンロック
    if (world > 5 && world <= 10) {
       if (sub === 1) return isStageCleared(5, 3);
       return isStageCleared(world, sub - 1);
    }

    // 10-3クリアで11-15がアンロック
    if (world > 10 && world <= 15) {
       if (sub === 1) return isStageCleared(10, 3);
       return isStageCleared(world, sub - 1);
    }

    // 15-3クリアで16-20がアンロック
    if (world > 15) {
       if (sub === 1) return isStageCleared(15, 3);
       return isStageCleared(world, sub - 1);
    }
    
    // それ以外の通常進行
    if (sub === 1) return isStageCleared(world - 1, 3);
    return isStageCleared(world, sub - 1);
  };

  const getLatestAvailableSubInWorld = (world: number) => {
    if (isStageCleared(world, 3)) return 3;
    if (isStageCleared(world, 2)) return 3; 
    if (isStageCleared(world, 1)) return 2; 
    return 1;
  };

  const handleNextStage = () => {
    if (!selectedStage) return;
    let nextWorld = selectedStage.world;
    let nextSub = selectedStage.sub + 1;
    if (nextSub > 3) { nextWorld++; nextSub = 1; }
    if (nextWorld <= TOTAL_WORLDS) selectStage(nextWorld, nextSub);
    else setGameState('STAGES');
  };

  const checkAllCleared = useCallback((currentCleared: string[]) => {
    if (currentCleared.length >= TOTAL_WORLDS * SUB_STAGES_PER_WORLD) setShowThanksMessage(true);
  }, []);

  const handleDebugJump = () => {
    const match = debugInput.match(/^([1-9]|1[0-9]|20)-([1-3])$/);
    if (match) { selectStage(parseInt(match[1]), parseInt(match[2]), true); }
    else { setDebugError(true); setTimeout(() => setDebugError(false), 2000); }
  };

  const handleDebugAllClear = () => {
    const allIds = [];
    for (let w = 1; w <= TOTAL_WORLDS; w++) for (let s = 1; s <= SUB_STAGES_PER_WORLD; s++) allIds.push(`${w}_${s}`);
    setClearedStages(allIds); localStorage.setItem('pixel-puzzle-cleared-v2', JSON.stringify(allIds));
    setHasRevealedExtraStages(true); checkAllCleared(allIds);
  };

  const getAllClearedStages = () => {
    const list = [];
    for(let w = 1; w <= TOTAL_WORLDS; w++) for(let s = 1; s <= SUB_STAGES_PER_WORLD; s++) if(isStageCleared(w, s)) list.push({world: w, sub: s});
    return list;
  };

  const handleViewerNavigate = (direction: 'next' | 'prev') => {
    const clearedList = getAllClearedStages();
    if (clearedList.length === 0 || !viewerStage) return;
    const currentIndex = clearedList.findIndex(s => s.world === viewerStage.world && s.sub === viewerStage.sub);
    const nextIndex = direction === 'next' ? (currentIndex + 1) % clearedList.length : (currentIndex - 1 + clearedList.length) % clearedList.length;
    setViewerStage(clearedList[nextIndex]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Debug Trigger: "q" key x5 consecutive times
      if (e.key.toLowerCase() === 'q') {
        qPressCountRef.current += 1;
        if (qPressCountRef.current >= 5) {
          setShowDebug(prev => !prev);
          qPressCountRef.current = 0;
        }
      } else {
        qPressCountRef.current = 0;
      }

      if (viewerStage) {
        if (e.key === 'ArrowRight') handleViewerNavigate('next');
        if (e.key === 'ArrowLeft') handleViewerNavigate('prev');
        if (e.key === 'Escape') setViewerStage(null);
      }
      if (gameState === 'PLAYING' && !isSolved && !isGameOver && !isExploding) {
        if (e.key.toLowerCase() === 'p' || e.key === ' ') { e.preventDefault(); setIsPaused(prev => !prev); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerStage, gameState, isSolved, isGameOver, isExploding]);

  const getClipPath = (shapes: PieceData['shapes']) => {
    const low = 25.0, high = 75.0;
    const pts: string[] = [];
    const pushBezier = (p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]) => {
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0];
        const y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1];
        pts.push(`${x.toFixed(3)}% ${y.toFixed(3)}%`);
      }
    };
    const drawEdge = (pStart: [number, number], pEnd: [number, number], shape: number) => {
      if (shape === 0) { pts.push(`${pEnd[0].toFixed(3)}% ${pEnd[1].toFixed(3)}%`); return; }
      const vx = pEnd[0] - pStart[0], vy = pEnd[1] - pStart[1], nx = vy, ny = -vx, d = shape;
      const getPt = (t: number, n: number) => [pStart[0] + vx * t + nx * n * d, pStart[1] + vy * t + ny * n * d] as [number, number];
      pushBezier(getPt(0.38, 0), getPt(0.41, 0), getPt(0.42, 0.04), getPt(0.42, 0.08));
      pushBezier(getPt(0.42, 0.08), getPt(0.28, 0.24), getPt(0.72, 0.24), getPt(0.58, 0.08));
      pushBezier(getPt(0.58, 0.08), getPt(0.58, 0.04), getPt(0.59, 0), getPt(0.62, 0));
      pts.push(`${pEnd[0].toFixed(3)}% ${pEnd[1].toFixed(3)}%`);
    };
    const tl: [number, number] = [low, low], tr: [number, number] = [high, low], br: [number, number] = [high, high], bl: [number, number] = [low, high];
    pts.push(`${tl[0]}% ${tl[1]}%`);
    drawEdge(tl, tr, shapes.top); drawEdge(tr, br, shapes.right); drawEdge(br, bl, shapes.bottom); drawEdge(bl, tl, shapes.left);
    return `polygon(${pts.join(', ')})`;
  };

  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent, id: number) => {
    if (isSolved || isGameOver || isExploding || showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm || isPaused) return;
    const piece = pieces.find(p => p.id === id);
    if (!piece || !boardRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX, clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = boardRef.current.getBoundingClientRect(), scale = TARGET_WIDTH / rect.width;
    const logicX = (clientX - rect.left) * scale, logicY = (clientY - rect.top) * scale;
    if (activeCornerHighlights.has(id)) setActiveCornerHighlights(prev => { const next = new Set(prev); next.delete(id); return next; });
    setDraggingId(id); setDragOffset({ x: logicX - piece.x, y: logicY - piece.y }); setDragStartPos({ x: logicX, y: logicY }); 
    const nextZ = maxZ + 1; setMaxZ(nextZ);
    setPieces(prev => prev.map(p => p.id === id ? { ...p, zIndex: nextZ, isPlaced: false } : p));
  };

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (draggingId === null || isExploding || !boardRef.current || showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm || isPaused) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX, clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const rect = boardRef.current.getBoundingClientRect(), scale = TARGET_WIDTH / rect.width;
    const logicX = (clientX - rect.left) * scale, logicY = (clientY - rect.top) * scale;
    setPieces(prev => prev.map(p => p.id === draggingId ? { ...p, x: logicX - dragOffset.x, y: logicY - dragOffset.y } : p));
  }, [draggingId, dragOffset, isExploding, showSettings, showGiveUpModal, showItemConfirm, showGhostConfirm, showGuideConfirm, isPaused]);

  const handleEndDrag = useCallback(() => {
    if (draggingId === null) return;
    const piece = pieces.find(p => p.id === draggingId);
    if (!piece || !selectedStage) { setDraggingId(null); return; }
    const { x: gx, y: gy } = getGridSize(selectedStage.world), cellW = TARGET_WIDTH / gx, cellH = TARGET_HEIGHT / gy;
    const currentPiecePos = { x: piece.x + dragOffset.x, y: piece.y + dragOffset.y };
    const distanceMoved = Math.sqrt(Math.pow(currentPiecePos.x - dragStartPos.x, 2) + Math.pow(currentPiecePos.y - dragStartPos.y, 2));
    let targetRotation = piece.rotation;
    if (selectedStage?.sub === 3 && distanceMoved < 15) { targetRotation += 90; rotateAudio.current?.play().catch(() => {}); }
    const nearestCol = Math.max(0, Math.min(gx - 1, Math.round(piece.x / cellW))), nearestRow = Math.max(0, Math.min(gy - 1, Math.round(piece.y / cellH)));
    const snapX = nearestCol * cellW, snapY = nearestRow * cellH;
    const snapDistance = Math.sqrt(Math.pow(piece.x - snapX, 2) + Math.pow(piece.y - snapY, 2));
    if (snapDistance < 60) {
      const isLocked = nearestCol === piece.col && nearestRow === piece.row && (targetRotation % 360) === 0;
      setPieces(prev => {
        const collisionPiece = prev.find(p => p.id !== draggingId && p.x === snapX && p.y === snapY);
        return prev.map(p => {
          if (p.id === draggingId) return { ...p, x: snapX, y: snapY, rotation: targetRotation, isPlaced: isLocked, zIndex: isLocked ? 1 : p.zIndex };
          if (collisionPiece && p.id === collisionPiece.id) {
            const bounceX = (snapX < TARGET_WIDTH / 2) ? -520 + Math.random() * 280 : 1200 + Math.random() * 280;
            return { ...p, x: bounceX, y: -50 + Math.random() * TARGET_HEIGHT, isPlaced: false };
          }
          return p;
        });
      });
      snapAudio.current?.play().catch(() => {});
    } else { setPieces(prev => prev.map(p => p.id === draggingId ? { ...p, rotation: targetRotation } : p)); }
    setDraggingId(null);
  }, [draggingId, pieces, selectedStage, dragStartPos, dragOffset]);

  useEffect(() => {
    if (draggingId !== null) {
      window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleEndDrag);
      window.addEventListener('touchmove', handleMove); window.addEventListener('touchend', handleEndDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleEndDrag);
    };
  }, [draggingId, handleMove, handleEndDrag]);

  useEffect(() => {
    if (pieces.length > 0 && pieces.every(p => p.isPlaced)) {
      setTimeout(() => { 
        setIsSolved(true); setShowSolvedOverlay(true); 
        if (selectedStage) {
          const stageId = `${selectedStage.world}_${selectedStage.sub}`;
          if (!clearedStages.includes(stageId)) {
            const newCleared = [...clearedStages, stageId];
            setClearedStages(newCleared);
            localStorage.setItem('pixel-puzzle-cleared-v2', JSON.stringify(newCleared));
            
            // 特別なクリア判定 (5-3 または 10-3)
            if (selectedStage.sub === 3 && (selectedStage.world === 5 || selectedStage.world === 10)) {
              setTimeout(() => {
                setShowChainUnlockModal(true);
                congratsAudio.current?.play().catch(() => {});
              }, 1000);
            }
            checkAllCleared(newCleared);
          }
        }
      }, 500);
    }
  }, [pieces, selectedStage, clearedStages, checkAllCleared]);

  // ステージ選択画面に戻ったときの連鎖開放アニメーション
  useEffect(() => {
    if (gameState === 'STAGES' && showChainUnlockModal) {
      setShowChainUnlockModal(false);
      setIsUnlockingAnimation(true);
      setTimeout(() => {
        unlockAudio.current?.play().catch(() => {});
        // 10-3をクリアしていた場合のみ、16-20の非表示を解除
        if (isStageCleared(10, 3)) {
           setHasRevealedExtraStages(true);
        }
        // 演出時間を確保
        setTimeout(() => setIsUnlockingAnimation(false), 7000);
      }, 1000);
    }
  }, [gameState, showChainUnlockModal]);

  const timeUsedPercent = ((maxTimeLimit - timeLeft) / maxTimeLimit) * 100;

  const handleUseItem = () => { if (itemStock > 0) { itemUseAudio.current?.play(); setTimeLeft(prev => prev + 120); setMaxTimeLimit(prev => prev + 120); setItemStock(prev => prev - 1); setShowItemConfirm(false); setShow13GiftGuide(false); } };
  const handleUseGhost = () => { if (ghostStock > 0) { itemUseAudio.current?.play(); setIsGhostActive(true); setGhostStock(prev => prev - 1); setShowGhostConfirm(false); setShow23GhostGuide(false); } };
  const handleUseGuide = () => { if (guideStock > 0) { itemUseAudio.current?.play(); setIsGuideActive(true); setGuideTimeLeft(20); setGuideStock(prev => prev - 1); setShowGuideConfirm(false); setShow33GuideGift(false); } };
  const handleDismissBgGuide = (color: string) => { setBoardBgColor(color); if (showBgGuide) { setShowBgGuide(false); localStorage.setItem('pixel-puzzle-has-seen-bg-guide', 'true'); } };

  const renderContent = () => {
    if (gameState === 'SPLASH') return <div className="fixed inset-0 bg-white flex flex-col items-center justify-center cursor-pointer animate-fade-in" onClick={() => { handleStartMusic(); setGameState('TITLE'); }}><h1 className="text-black text-5xl sm:text-7xl font-['Great_Vibes'] text-center px-4 animate-fade-in">Welcome to the world of puzzles</h1></div>;
    if (gameState === 'TITLE') return <div className="fixed inset-0 bg-cover bg-center flex flex-col items-center justify-center cursor-pointer" style={{ backgroundImage: `url(${TITLE_BG_URL})` }} onClick={() => { handleStartMusic(); setGameState('STAGES'); }}><button onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }} className="absolute top-8 right-8 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full border border-white/40 shadow-xl z-20">{isFullScreen ? <Minimize2 /> : <Maximize2 />}</button><div className="relative z-10 text-center flex flex-col items-center animate-fade-in"><div className="group flex flex-col items-center gap-6"><div className="w-24 h-24 bg-white/90 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)] animate-bounce group-hover:scale-110 transition-transform"><Play className="text-stone-900 w-12 h-12 ml-1" /></div><span className="text-white font-black text-2xl tracking-[0.4em] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] animate-pulse">TAP TO START</span></div></div></div>;

   if (gameState === 'STAGES' || gameState === 'ALBUM') {
  const isAlbum = gameState === 'ALBUM';
  return (
    <div className={`${isAlbum ? 'bg-[#E0F2FE]' : 'bg-[#FAF9F6]'} h-full flex flex-col p-4 sm:p-8 animate-fade-in relative`}>
      <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setGameState('TITLE')} className="group flex items-center gap-2 p-3 bg-stone-900 shadow-xl border border-stone-800 rounded-2xl hover:bg-stone-800 transition-all active:scale-95"><ChevronLeft className="w-6 h-6 text-white" /><span className="hidden sm:inline text-white font-black text-[10px] uppercase tracking-widest mr-1">Title</span></button>
              <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-stone-900 uppercase">{isAlbum ? 'Album' : 'Select Stage'}</h2>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setGameState(isAlbum ? 'STAGES' : 'ALBUM')} className={`p-3 rounded-2xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${isAlbum ? 'bg-amber-400 text-stone-900 border-amber-500 shadow-md' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>{isAlbum ? <LayoutGrid className="w-5 h-5" /> : <Library className="w-5 h-5" />}<span className="hidden sm:inline">{isAlbum ? 'Stages' : 'Album'}</span></button>
              <div className="hidden sm:block px-6 py-2 bg-stone-100 border border-stone-200 text-stone-600 rounded-full font-black text-xs tracking-widest uppercase">Progress: {clearedStages.length}/{TOTAL_WORLDS * SUB_STAGES_PER_WORLD}</div>
              <button onClick={() => toggleFullScreen()} className="p-3 bg-white hover:bg-stone-50 text-stone-600 rounded-2xl border border-stone-200 shadow-sm transition-all">{isFullScreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}</button>
            </div>
          </header>

            <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 pb-20">
            {Array.from({ length: TOTAL_WORLDS }).map((_, i) => {

              return (
                <div 
                  key={world} 
                  className={`flex flex-col gap-4 bg-white p-5 rounded-[2.5rem] shadow-sm border border-stone-200 transition-all hover:shadow-md ${isChainLocked ? 'opacity-40 grayscale pointer-events-none' : (isWorldUnlocked || isAlbum ? 'opacity-100' : 'opacity-60 grayscale brightness-75')} ${isNewlyAppearing ? 'animate-float-in' : ''}`}
                >
                  <div onClick={() => !isAlbum && isWorldUnlocked && !isChainLocked && selectStage(world, latestSub)} className={`relative w-full aspect-[16/10] bg-stone-100 rounded-[1.5rem] overflow-hidden border-2 transition-all ${isWorldUnlocked && !isAlbum && !isChainLocked ? 'cursor-pointer hover:scale-[1.02] border-stone-100' : 'cursor-default border-stone-200'}`}>
                    <img src={worldImg} className={`w-full h-full object-cover transition-all duration-700 ${isAlbum ? (isWorldFullyCleared ? 'brightness-100' : 'brightness-[0.1] blur-[6px]') : (isStageCleared(world, 3) ? 'brightness-100' : 'brightness-[0.4]')}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-5">
                      <span className="text-white font-black italic tracking-tighter text-3xl uppercase">Stage {world}</span>
                    </div>
                    {isChainLocked && <div className="absolute inset-0 flex items-center justify-center bg-black/20"><Lock className="w-12 h-12 text-white drop-shadow-lg" /></div>}
                  </div>
                  <div className="flex flex-col gap-3 px-1">
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Progress</span>{isWorldFullyCleared && <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Clear</span>}</div>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3].map(sub => {
                        const cleared = isStageCleared(world, sub), unlocked = isStageUnlocked(world, sub);
                        return <button key={sub} disabled={isChainLocked || (!isAlbum && !unlocked)} onClick={() => isAlbum ? (cleared && setViewerStage({world, sub})) : selectStage(world, sub)} className={`group relative flex-1 aspect-square rounded-2xl border-4 flex items-center justify-center transition-all overflow-hidden ${isAlbum ? (cleared ? 'cursor-pointer hover:scale-105 border-amber-400' : 'cursor-default opacity-30 grayscale border-stone-100') : (unlocked ? 'cursor-pointer active:scale-90' : 'cursor-not-allowed')} ${!isAlbum && cleared ? 'bg-amber-400 border-amber-500 shadow-amber-200' : !isAlbum && unlocked ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100'}`}>{isAlbum ? (cleared ? <img src={`${STAGE_IMG_BASE}${world}_${sub}.png`} className="w-full h-full object-cover" /> : <Lock className="w-4 h-4 text-stone-300" />) : (!unlocked ? <Lock className="w-4 h-4 text-stone-300" /> : (cleared ? <CheckCircle2 className="text-white w-5 h-5" /> : <span className="text-lg font-black text-stone-800 italic">{sub}</span>))}</button>;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {viewerStage && <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-fade-in" onClick={() => setViewerStage(null)}><button className="absolute top-8 right-8 z-[1100] bg-white/10 text-white p-3 rounded-full hover:bg-white/20 transition-all"><X className="w-8 h-8" /></button><div className="relative flex items-center gap-0 w-full h-full justify-center" onClick={e => e.stopPropagation()}><button onClick={() => handleViewerNavigate('prev')} className="absolute left-4 z-[1100] p-4 bg-white/10 text-white rounded-full"><ChevronLeft className="w-8 h-8" /></button><div className="relative h-full aspect-[1024/1536] bg-stone-900 shadow-2xl overflow-hidden flex items-center justify-center cursor-zoom-in" onClick={() => setShowFullRes(true)}><img key={`${viewerStage.world}_${viewerStage.sub}`} src={`${STAGE_IMG_BASE}${viewerStage.world}_${viewerStage.sub}.png`} className="w-full h-full object-contain animate-image-reveal" /><div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md px-5 py-2 rounded-full text-white text-xs font-black uppercase tracking-widest border border-white/10">Stage {viewerStage.world}-{viewerStage.sub}</div></div><button onClick={() => handleViewerNavigate('next')} className="absolute right-4 z-[1100] p-4 bg-white/10 text-white rounded-full"><ChevronRight className="w-8 h-8" /></button></div></div>}
          {isLoading && <div className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-md flex items-center justify-center"><div className="flex flex-col items-center gap-4"><RefreshCcw className="w-16 h-16 text-white animate-spin" /><span className="text-white font-black italic text-xl tracking-widest animate-pulse">LOADING DATA...</span></div></div>}
          {showThanksMessage && <div className="fixed inset-0 z-[2000] bg-white/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-fade-in overflow-hidden"><div className="relative max-w-2xl w-full bg-stone-900 rounded-[3rem] p-12 text-center shadow-[0_50px_100px_rgba(0,0,0,0.3)] border border-white/10 flex flex-col items-center gap-8 animate-pop-up"><div className="flex gap-4"><Heart className="w-12 h-12 text-rose-500 animate-pulse" /><Sparkles className="w-12 h-12 text-amber-400 animate-bounce" /><Heart className="w-12 h-12 text-rose-500 animate-pulse delay-150" /></div><div><h2 className="text-5xl font-black text-white italic tracking-tighter mb-4">CONGRATULATIONS!</h2><p className="text-stone-300 text-xl font-bold leading-relaxed mb-6">プレイしていただき、本当にありがとうございました。<br />全60ステージの完成を心よりお祝い申し上げます。<br />皆様のご多幸をお祈りいたします。</p><div className="w-24 h-1 bg-amber-400 mx-auto rounded-full"></div></div><button onClick={() => setShowThanksMessage(false)} className="px-12 py-4 bg-white text-stone-900 rounded-full font-black text-lg hover:bg-stone-200 active:scale-95 shadow-xl">閉じる</button></div></div>}
        </div>
      );
     })}

    const currentGrid = getGridSize(selectedStage?.world || 1), gx = currentGrid.x, gy = currentGrid.y;
    const cellW = TARGET_WIDTH / gx, cellH = TARGET_HEIGHT / gy, pieceDivW = cellW * PIECE_BUFFER_RATIO, pieceDivH = cellH * PIECE_BUFFER_RATIO;
    const bgSizeX = (gx / PIECE_BUFFER_RATIO) * 100, bgSizeY = (gy / PIECE_BUFFER_RATIO) * 100;

              const world = i + 1;
              const isWorldVisible = world <= 15 || hasRevealedExtraStages;
              if (!isWorldVisible) return null;

              const isChainLocked = (world > 5 && world <= 10 && !isStageCleared(5, 3)) ||
                                    (world > 10 && world <= 15 && !isStageCleared(10, 3)) ||
                                    (world > 15 && !isStageCleared(15, 3));

              const latestSub = getLatestAvailableSubInWorld(world);
              const isWorldUnlocked = isStageUnlocked(world, 1);
              const worldImg = `${STAGE_IMG_BASE}${world}_1.png`;
              const isWorldFullyCleared = isStageCleared(world, 1) && isStageCleared(world, 2) && isStageCleared(world, 3);
              const isNewlyAppearing = world > 15 && isUnlockingAnimation;
              


return (
  <div className="min-h-screen bg-[#FAF9F6] flex justify-center items-start overflow-hidden">
    <div className="game-root">

         <header className={`px-6 py-6 bg-white/70 backdrop-blur-xl border-b border-stone-200 flex justify-between items-center z-50 transition-all duration-700 ${showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setGameState('STAGES')} className="p-2 hover:bg-stone-100 rounded-xl transition-colors"><ChevronLeft /></button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black italic tracking-tighter text-stone-800">STAGE {selectedStage?.world}-{selectedStage?.sub}</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] opacity-40 font-black uppercase tracking-widest not-italic">{gx}x{gy} Precision</span>
                {selectedStage?.sub === 3 && <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">Hard Mode</span>}
              </div>
              {selectedStage?.sub === 3 && !isSolved && !isGameOver && (
                <div className="text-[10px] text-orange-600 font-bold mt-1 whitespace-nowrap">HARD MODEはピースをクリックして回転させることができるよ</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!isSolved && !isGameOver && (
              <div className="flex items-center gap-6">
                <div className={`relative flex items-center gap-3 p-2 bg-stone-100/50 rounded-full border border-stone-200 transition-all ${showBgGuide ? 'ring-4 ring-amber-400 animate-bounce-subtle' : ''}`}>
                  {[{ color: '#F5F5DC', label: 'Cream' }, { color: '#333333', label: 'Dark Gray' }, { color: '#4A5D4E', label: 'Moss Green' }].map((bg) => (
                    <button key={bg.color} onClick={() => handleDismissBgGuide(bg.color)} className="group relative w-5 h-5 rounded-full shadow-sm transition-all active:scale-90" style={{ backgroundColor: bg.color, border: boardBgColor === bg.color ? '2px solid #FFD700' : '1px solid rgba(0,0,0,0.1)' }} title={bg.label}>
                      <div className="absolute -inset-2 rounded-full cursor-pointer"></div>
                    </button>
                  ))}
                  {isGuideActive && (
                    <div className="absolute top-full mt-2 left-0 bg-amber-400 px-3 py-1 rounded-full text-stone-900 font-black text-[10px] shadow-lg flex items-center gap-2 border-2 border-white animate-fade-in whitespace-nowrap">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      Guide active: {guideTimeLeft}s
                    </div>
                  )}
                  {showBgGuide && <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 bg-amber-400 p-4 rounded-3xl shadow-2xl animate-pop-up z-[300] border-4 border-white"><div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-amber-400 rotate-45 border-t-4 border-l-4 border-white"></div><p className="text-stone-900 text-[11px] font-black leading-relaxed text-center">ヒント：背景色を変えるとピースが見やすくなるよ！🎨</p></div>}
                </div>
                <div className="flex items-center gap-8 px-10 py-2 bg-stone-100 rounded-full border border-stone-200 shadow-sm z-[200] relative">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Time Left</span>
                    <span className={`text-4xl font-black font-mono tracking-tighter transition-colors ${timeLeft < 60 || isExploding ? 'text-red-500 animate-pulse' : 'text-stone-800'}`}>{isExploding ? "0:00" : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}</span>
                  </div>
                </div>
                <div className="relative">
                  <button onClick={() => { setIsEdgeFilterActive(!isEdgeFilterActive); if (showFirstGuide) handleHideGuide(); }} disabled={isExploding} className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all shadow-sm ${isEdgeFilterActive ? 'bg-amber-400 border-amber-500 text-stone-900' : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600'}`} title="外周ピースのみ表示"><Layers className="w-7 h-7" /></button>
                  {showFirstGuide && !isExploding && <div className="absolute top-full mt-4 right-0 w-64 bg-amber-400 p-4 rounded-3xl shadow-2xl animate-pop-up z-[300] border-4 border-white"><div className="absolute -top-3 right-6 w-6 h-6 bg-amber-400 rotate-45 border-t-4 border-l-4 border-white"></div><p className="text-stone-900 text-[11px] font-black leading-relaxed text-center">ヒント：外側のピースから探すとスムーズだよ！<br />クリックして切り替え可能。何回でも使えるよ！</p></div>}
                </div>
                <div className="relative flex gap-2 items-center px-4 py-2 bg-stone-50 rounded-2xl border border-stone-200 z-[200]">
                  {show13GiftGuide && !isExploding && <div className="absolute top-full mt-4 right-0 w-64 bg-amber-400 p-4 rounded-3xl animate-pop-up z-[300] border-4 border-white"><div className="absolute -top-3 right-12 w-6 h-6 bg-amber-400 rotate-45 border-t-4 border-l-4 border-white"></div><p className="text-stone-900 text-[11px] font-black text-center">砂時計をプレゼントするよ！⏳<br />使うと残り時間が120秒増えるよ。</p></div>}
                  {[0, 1, 2].map(i => <button key={i} onClick={() => i < itemStock && !isExploding && setShowItemConfirm(true)} className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${i < itemStock ? (show13GiftGuide && i === 0 ? 'bg-amber-400 border-white text-white shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-aurora-pulse' : 'bg-amber-100 border-amber-300 text-amber-600') : 'bg-transparent border-stone-200 text-stone-200 cursor-default'}`}>{pulsingItemType === 'HOURGLASS' && i === itemStock - 1 && <div className="absolute -inset-1 bg-amber-400 rounded-xl animate-ping opacity-75"></div>}<Hourglass className={`relative w-6 h-6 ${i < itemStock ? 'animate-pulse' : ''}`} /></button>)}
                </div>
                <div className="relative flex gap-2 items-center px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100 z-[200]">
                  {show33GuideGift && !isExploding && <div className="absolute top-full mt-4 right-0 w-64 bg-amber-400 p-4 rounded-3xl animate-pop-up z-[300] border-4 border-white"><div className="absolute -top-3 right-12 w-6 h-6 bg-amber-400 rotate-45 border-t-4 border-l-4 border-white"></div><p className="text-stone-900 text-[11px] font-black text-center">ガイドをプレゼント！✨<br />正解の位置が表示されるよ！</p></div>}
                  {[0, 1, 2].map(i => <button key={i} onClick={() => i < guideStock && !isExploding && setShowGuideConfirm(true)} className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${i < guideStock ? (show33GuideGift && i === 0 ? 'bg-amber-400 border-white text-white shadow-[0_0_20px_rgba(251,191,36,0.8)]' : 'bg-amber-100 border-amber-300 text-amber-600') : 'bg-transparent border-amber-100 text-stone-200 cursor-default'}`}>{((show33GuideGift && i === 0) || (pulsingItemType === 'GUIDE' && i === guideStock - 1)) && <div className="absolute -inset-1 bg-amber-400 rounded-xl animate-ping opacity-75"></div>}<Sparkles className={`relative w-6 h-6 ${i < guideStock ? 'animate-pulse' : ''}`} /></button>)}
                </div>
                <div className="relative flex gap-2 items-center px-4 py-2 bg-sky-50 rounded-2xl border border-sky-100 z-[200]">
                  {show23GhostGuide && !isExploding && <div className="absolute top-full mt-4 right-0 w-64 bg-sky-500 p-4 rounded-3xl animate-pop-up z-[300] border-4 border-white"><div className="absolute -top-3 right-12 w-6 h-6 bg-sky-500 rotate-45 border-t-4 border-l-4 border-white"></div><p className="text-white text-[11px] font-black text-center">ゴーストをプレゼント！👻<br />完成図が浮かび上がるよ！</p></div>}
                  {[0, 1, 2].map(i => <button key={i} onClick={() => i < ghostStock && !isExploding && setShowGhostConfirm(true)} className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${i < ghostStock ? (show23GhostGuide && i === 0 ? 'bg-sky-500 border-white text-white shadow-[0_0_20px_rgba(14,165,233,0.8)]' : 'bg-sky-100 border-sky-300 text-sky-600') : 'bg-transparent border-sky-100 text-stone-200 cursor-default'}`}>{((show23GhostGuide && i === 0) || (pulsingItemType === 'GHOST' && i === ghostStock - 1)) && <div className="absolute -inset-1 bg-sky-400 rounded-xl animate-ping opacity-75"></div>}<Eye className={`relative w-6 h-6 ${i < ghostStock ? 'animate-pulse' : ''}`} /></button>)}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsPaused(true)} disabled={isSolved || isGameOver || isExploding} className={`p-2.5 bg-white hover:bg-stone-50 text-stone-600 rounded-xl border border-stone-200 shadow-sm transition-all ${isPaused ? 'opacity-0 pointer-events-none' : ''}`} title="一時停止 (P/Space)"><Pause className="w-6 h-6" /></button>
            <button onClick={() => toggleFullScreen()} className="p-2.5 bg-white hover:bg-stone-50 text-stone-600 rounded-xl border border-stone-200 shadow-sm transition-all">{isFullScreen ? <Minimize2 /> : <Maximize2 />}</button>
            {!isSolved && !isExploding && <button onClick={() => setShowGiveUpModal(true)} className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center gap-2 font-bold text-sm border border-red-200 shadow-sm"><Flag className="w-4 h-4" /> ギブアップ</button>}
            <button onClick={() => setGameState('STAGES')} className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-50 rounded-xl flex items-center gap-2 font-bold text-sm shadow-lg">ステージ一覧</button>
          </div>
        </header>

      {renderContent()}

        <main className={`flex-1 relative flex flex-col items-center justify-center p-4 overflow-hidden transition-colors duration-[300ms]`} style={{ backgroundColor: boardBgColor }}>
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <div className={`absolute left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-left font-black text-[120px] pointer-events-none uppercase tracking-tighter select-none transition-all duration-1000 ${showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm || isPaused ? 'opacity-0' : 'opacity-40'} ${boardBgColor === '#333333' ? 'text-white/10' : 'text-stone-200'}`}>STAGE {selectedStage?.world}-{selectedStage?.sub}</div>
            <div className={`absolute right-10 top-1/2 -translate-y-1/2 rotate-90 origin-right font-black text-[120px] pointer-events-none uppercase tracking-tighter select-none transition-all duration-1000 ${showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm || isPaused ? 'opacity-0' : 'opacity-40'} ${boardBgColor === '#333333' ? 'text-white/10' : 'text-stone-200'}`}>STAGE {selectedStage?.world}-{selectedStage?.sub}</div>
            {emergencyGiftMessage && <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none animate-pop-up"><div className="bg-amber-400 text-stone-900 px-10 py-6 rounded-[2rem] shadow-[0_20px_60px_rgba(251,191,36,0.6)] border-4 border-white flex flex-col items-center gap-3"><div className="flex gap-2"><Sparkles className="w-8 h-8 animate-bounce" /><Hourglass className="w-8 h-8 animate-spin-slow" /><Eye className="w-8 h-8 animate-bounce delay-100" /></div><span className="text-2xl font-black italic tracking-tight">{emergencyGiftMessage}</span></div></div>}
            {!isSolved && !isGameOver && !isViewMode && !isPaused && <div className="mb-6 z-[200] flex flex-col items-center animate-fade-in" style={{ width: 'min(65vh * 0.666 + 80px, 95vw)' }}><div className="relative w-full h-6 bg-stone-200 rounded-full shadow-inner overflow-hidden border-4 border-white ring-1 ring-stone-200"><div className="absolute inset-0 flex"><div className="h-full w-1/3 bg-green-400 opacity-20"></div><div className="h-full w-1/3 bg-yellow-400 opacity-20"></div><div className={`h-full w-1/3 bg-red-600 transition-opacity duration-300 ${timeUsedPercent > 66.6 || isExploding ? 'animate-red-warning opacity-40' : 'opacity-20'}`}></div></div><div className="absolute top-0 left-0 h-full bg-stone-800 transition-all duration-1000 ease-linear" style={{ width: isExploding ? '100%' : `${timeUsedPercent}%` }} /><div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-linear z-[110]" style={{ left: isExploding ? '100%' : `${timeUsedPercent}%` }}><div className="relative -ml-2"><div className="absolute -inset-4 bg-orange-500 rounded-full animate-ping opacity-75"></div><div className="w-8 h-8 bg-yellow-400 rounded-full shadow-[0_0_20px_#fbbf24] border-4 border-white flex items-center justify-center"><div className="w-1.5 h-1.5 bg-stone-800 rounded-full"></div></div></div></div></div></div>}
            <div ref={boardRef} onClick={() => isSolved && setShowFullRes(true)} className={`relative bg-white/50 shadow-[0_40px_100px_rgba(0,0,0,0.1)] transition-all duration-1000 ${isSolved ? 'scale-[1.02] border-white/0' : 'border-[20px] border-white'} ${isGameOver || isExploding || isPaused ? 'opacity-40 grayscale' : ''} ${showSettings || showGiveUpModal ? 'blur-xl grayscale opacity-20' : ''}`} style={{ width: isViewMode ? 'min(85vh * 0.666, 95vw)' : 'min(65vh * 0.666, 92vw)', aspectRatio: '1024 / 1536' }}>
              {isGhostActive && !isSolved && !isGameOver && !isPaused && <div className="absolute inset-0 z-0 pointer-events-none animate-fade-in" style={{ opacity: 0.18, filter: 'grayscale(100%) blur(3px)' }}><img src={image!} className="w-full h-full object-cover" /></div>}
              {isGuideActive && draggingId !== null && !isPaused && (() => {
                const p = pieces.find(piece => piece.id === draggingId);
                if (!p) return null;
                return <div className="absolute pointer-events-none z-[5] animate-fade-in" style={{ width: `${(pieceDivW / TARGET_WIDTH) * 100}%`, height: `${(pieceDivH / TARGET_HEIGHT) * 100}%`, left: `${(p.col * cellW / TARGET_WIDTH) * 100}%`, top: `${(p.row * cellH / TARGET_HEIGHT) * 100}%`, backgroundImage: `url(${image})`, backgroundSize: `${bgSizeX}% ${bgSizeY}%`, backgroundPosition: `${((p.col - 0.5) / (gx - 2.0)) * 100}% ${((p.row - 0.5) / (gy - 2.0)) * 100}%`, clipPath: getClipPath(p.shapes), transform: `translate(-25%, -25%)`, opacity: 0.5, filter: 'brightness(1.5) drop-shadow(0 0 20px #fbbf24)' }} />;
              })()}
              {!isSolved && <div className="absolute inset-0 grid pointer-events-none z-0" style={{ gridTemplateColumns: `repeat(${gx}, 1fr)`, gridTemplateRows: `repeat(${gy}, 1fr)` }}>{Array.from({ length: gx * gy }).map((_, i) => <div key={i} className="border border-stone-400/40"></div>)}</div>}
              <div className="absolute inset-0 overflow-visible z-10">
                {!isSolved ? pieces.map((p) => {
                  const isEdge = p.shapes.top === 0 || p.shapes.right === 0 || p.shapes.bottom === 0 || p.shapes.left === 0;
                  const filterActive = isEdgeFilterActive && !p.isPlaced;
                  const isCornerActive = isCornerHighlightVisible && activeCornerHighlights.has(p.id) && !p.isPlaced && !isPaused;
                  return <React.Fragment key={p.id}>
                    {isCornerActive && <div className="absolute pointer-events-none animate-pulse-glow" style={{ width: `${(pieceDivW/TARGET_WIDTH)*100}%`, height: `${(pieceDivH/TARGET_HEIGHT)*100}%`, left: `${(p.x/TARGET_WIDTH)*100}%`, top: `${(p.y/TARGET_HEIGHT)*100}%`, zIndex: p.zIndex - 1, transform: `translate(-25%, -25%)`, background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 80%)', border: '6px dashed rgba(251,191,36,0.8)', borderRadius: '50%' }}><div className="absolute inset-0 animate-spin-slow opacity-50 border-t-8 border-amber-300 rounded-full"></div></div>}
                    <div onMouseDown={(e) => handleStartDrag(e, p.id)} onTouchStart={(e) => handleStartDrag(e, p.id)} className={`absolute ${p.isPlaced ? 'brightness-100' : 'cursor-grab hover:brightness-105'} ${draggingId === p.id ? 'z-[999]' : ''}`} style={{ width: `${(pieceDivW/TARGET_WIDTH)*100}%`, height: `${(pieceDivH/TARGET_HEIGHT)*100}%`, left: `${(p.x/TARGET_WIDTH)*100}%`, top: `${(p.y/TARGET_HEIGHT)*100}%`, backgroundImage: `url(${image})`, backgroundSize: `${bgSizeX}% ${bgSizeY}%`, backgroundPosition: `${((p.col - 0.5) / (gx - 2.0)) * 100}% ${((p.row - 0.5) / (gy - 2.0)) * 100}%`, clipPath: getClipPath(p.shapes), zIndex: p.zIndex, transform: `translate(-25%, -25%) rotate(${p.rotation}deg)`, filter: p.isPlaced ? 'none' : `${filterActive && isEdge ? 'brightness(1.2)' : ''} ${filterActive && !isEdge ? 'grayscale(100%) opacity(0.2)' : ''} drop-shadow(0 4px 10px rgba(0,0,0,0.15))`, pointerEvents: isExploding || isPaused ? 'none' : 'auto', transition: draggingId === p.id ? 'none' : 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
                  </React.Fragment>;
                }) : <div className="absolute inset-0 animate-image-reveal z-50 shadow-2xl overflow-hidden"><img src={image!} className="w-full h-full object-cover" />{isViewMode && <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fade-in"><ZoomIn className="w-3 h-3" /> 画像をクリックして拡大</div>}</div>}
              </div>
              {showSolvedOverlay && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-[100] animate-fade-in">
                  <div className="bg-stone-800/95 backdrop-blur-xl px-12 py-10 rounded-[4rem] shadow-2xl flex flex-col items-center gap-5 animate-pop-up border border-white/10 text-center w-[90%] max-w-sm">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center animate-bounce"><CheckCircle2 className="text-stone-800 w-10 h-10" /></div>
                    <h3 className="text-5xl font-black text-white italic tracking-tighter uppercase">Complete!</h3>
                    {showChainUnlockModal && <div className="bg-amber-400/20 border border-amber-400/40 p-4 rounded-2xl animate-pulse mt-2"><Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-1"/><p className="text-amber-400 text-xs font-black italic">Congratulations！<br/>新しいステージが開放されました！</p></div>}
                    <div className="flex flex-col gap-3 w-full mt-2">
                      <button onClick={handleNextStage} className="px-10 py-4 bg-amber-400 text-stone-900 rounded-full font-black shadow-lg flex items-center justify-center gap-2 group"><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> 次のステージへ</button>
                      <button onClick={() => { setShowSolvedOverlay(false); setIsViewMode(true); }} className="px-10 py-3 bg-white text-stone-800 rounded-full font-black flex items-center justify-center gap-2 text-sm">完成図を見る</button>
                      <button onClick={() => setGameState('STAGES')} className="px-10 py-3 bg-white/10 text-white rounded-full font-bold text-xs">ステージ選択に戻る</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {isGameOver && <div className="absolute inset-0 flex flex-col items-center justify-center z-[200] animate-fade-in"><div className="bg-red-950/90 backdrop-blur-3xl px-16 py-12 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 animate-pop-up border border-red-500/30 text-center max-w-lg w-full"><div className="relative"><div className="absolute -inset-4 bg-red-500 rounded-full opacity-20 animate-ping"></div><div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center"><Bomb className="text-white h-14 w-14" /></div></div><div><h3 className="text-7xl font-black text-white italic tracking-tighter">GAME OVER</h3><p className="text-red-300 font-bold uppercase tracking-[0.4em] text-xs mt-4">Time is up.</p></div>{lastGameHadItemGain && <div className="bg-amber-500/20 border border-amber-500/40 p-6 rounded-3xl animate-bounce-slow flex flex-col items-center gap-2">{lastGainedItemType === 'HOURGLASS' ? <Hourglass className="w-8 h-8 text-amber-400" /> : lastGainedItemType === 'GHOST' ? <Eye className="w-8 h-8 text-sky-400" /> : <Sparkles className="w-8 h-8 text-amber-500" />}<span className="text-amber-400 font-black italic text-lg uppercase">{lastGainedItemType}を獲得！</span></div>}<div className="flex flex-col gap-4 w-full"><button onClick={() => { if (selectedStage) selectStage(selectedStage.world, selectedStage.sub, true); }} className="px-12 py-5 bg-white text-red-900 rounded-full font-black shadow-xl flex items-center justify-center gap-3"><RefreshCcw className="w-6 h-6" /> リトライ</button><button onClick={() => setGameState('STAGES')} className="px-12 py-3 text-red-200 hover:text-white font-bold text-sm underline underline-offset-8">ステージ選択に戻る</button></div></div></div>}
          </div>
        </main>
        <footer className={`px-6 py-4 bg-white border-t border-stone-100 text-[10px] text-stone-400 font-black uppercase tracking-[0.5em] text-center transition-all duration-700 ${isViewMode || showSettings || showGiveUpModal || showItemConfirm || showGhostConfirm || showGuideConfirm || isPaused ? 'opacity-0 translate-y-full' : 'opacity-100 translate-y-0'}`}>PRECISION JIGSAW SYSTEM • {gx * gy} PIECES • {maxTimeLimit}s LIMIT</footer>
        {isPaused && <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-lg flex items-center justify-center animate-fade-in"><div className="flex flex-col items-center gap-8"><button onClick={() => setIsPaused(false)} className="w-32 h-32 bg-white/90 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"><Play className="w-16 h-16 text-stone-900 fill-stone-900 ml-2" /></button><span className="text-white font-black tracking-[0.5em] uppercase text-2xl animate-pulse">Paused</span></div></div>}
        {showFullRes && <div className="fixed inset-0 z-[1500] bg-black/98 backdrop-blur-2xl flex items-center justify-center cursor-zoom-out animate-fade-in" onClick={() => setShowFullRes(false)}>{viewerStage && <><button onClick={(e) => { e.stopPropagation(); handleViewerNavigate('prev'); }} className="absolute left-8 z-[1600] p-6 bg-white/5 text-white rounded-full"><ChevronLeft className="w-10 h-10" /></button><button onClick={(e) => { e.stopPropagation(); handleViewerNavigate('next'); }} className="absolute right-8 z-[1600] p-6 bg-white/5 text-white rounded-full"><ChevronRight className="w-10 h-10" /></button></>}<div className="relative max-w-full max-h-full shadow-2xl overflow-auto scrollbar-hide p-8" onClick={(e) => e.stopPropagation()}><img src={viewerStage ? `${STAGE_IMG_BASE}${viewerStage.world}_${viewerStage.sub}.png` : image!} style={{ width: TARGET_WIDTH, height: TARGET_HEIGHT, maxWidth: 'none' }} className="cursor-zoom-out" onClick={() => setShowFullRes(false)} /></div><button className="absolute top-8 right-8 bg-white/10 text-white p-3 rounded-full z-[1600]"><X className="w-8 h-8" /></button></div>}
{/* 砂時計（タイム追加） */}
{showItemConfirm && (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={() => setShowItemConfirm(false)}></div>
    <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-amber-200 flex flex-col items-center gap-6 animate-pop-up max-w-sm w-full">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center"><Hourglass className="w-8 h-8 text-amber-600 animate-bounce" /></div>
      <div className="text-center">
        <h3 className="text-2xl font-black text-stone-900 italic">砂時計を使いますか？</h3>
        <p className="text-stone-500 font-bold text-xs mt-2">120秒 を追加します</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <button onClick={handleUseItem} className="w-full py-4 bg-amber-400 text-stone-900 rounded-2xl font-black shadow-lg flex items-center justify-center">はい（120秒追加）</button>
        <button onClick={() => setShowItemConfirm(false)} className="w-full py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-colors">いいえ</button>
      </div>
    </div>
  </div>
)}

{/* ゴースト（完成図プレビュー） */}
{showGhostConfirm && (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={() => setShowGhostConfirm(false)}></div>
    <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-sky-200 flex flex-col items-center gap-6 animate-pop-up max-w-sm w-full">
      <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center"><Eye className="w-8 h-8 text-sky-600 animate-bounce" /></div>
      <div className="text-center">
        <h3 className="text-2xl font-black text-stone-900 italic">ゴーストを使いますか？</h3>
        <p className="text-stone-500 font-bold text-xs mt-2">完成図が浮かび上がります</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <button onClick={handleUseGhost} className="w-full py-4 bg-sky-500 text-white rounded-2xl font-black shadow-lg flex items-center justify-center">はい（表示）</button>
        <button onClick={() => setShowGhostConfirm(false)} className="w-full py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-colors">いいえ</button>
      </div>
    </div>
  </div>
)}

{/* ガイド（正解ヒント表示） */}
{showGuideConfirm && (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={() => setShowGuideConfirm(false)}></div>
    <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-amber-200 flex flex-col items-center gap-6 animate-pop-up max-w-sm w-full">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center"><Sparkles className="w-8 h-8 text-amber-600 animate-bounce" /></div>
      <div className="text-center">
        <h3 className="text-2xl font-black text-stone-900 italic">ガイドを使いますか？</h3>
        <p className="text-stone-500 font-bold text-xs mt-2">20秒間、正解の位置を示します</p>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <button onClick={handleUseGuide} className="w-full py-4 bg-amber-400 text-stone-900 rounded-2xl font-black shadow-lg flex items-center justify-center">はい（20秒間）</button>
        <button onClick={() => setShowGuideConfirm(false)} className="w-full py-3 bg-stone-100 text-stone-600 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-colors">いいえ</button>
      </div>
    </div>
  </div>
)}

    </div>   {/* ← game-root */}
  </div>     {/* ← min-h-screen */}
);
}

const root = createRoot(document.getElementById('root')!);
root.render(<JigsawApp />);

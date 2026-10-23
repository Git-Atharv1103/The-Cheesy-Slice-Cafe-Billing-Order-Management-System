import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

export interface RealtimeOrder {
  id: string;
  daily_order_number: string;
  customer_name: string;
  order_status: string;
  payment_status: string;
  total: number;
  items?: { name: string; quantity: number }[];
  special_instructions?: string;
  created_at: string;
  _eventId?: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  audioEnabled: boolean;
  setAudioEnabled: (val: boolean) => void;
  isAudioUnlocked: boolean;
  audioBlocked: boolean;
  unlockAudio: () => Promise<boolean>;
  testChime: () => void;
  playChime: (type?: 'new' | 'ready' | 'test') => void;
  readyOrderNotification: RealtimeOrder | null;
  dismissReadyNotification: () => void;
  lastEventTime: number;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Shared singleton AudioContext to adhere strictly to browser autoplay policies
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

// Synthesizer producing rich, professional Web Audio alerts with zero external asset dependencies
export async function playSynthesizedChime(type: 'new' | 'ready' | 'test' = 'new'): Promise<boolean> {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (ctx.state !== 'running') {
      return false; // Still blocked by browser
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === 'ready') {
      // Celebratory pleasant chime: F5 (698.46Hz) -> A5 (880Hz) -> C6 (1046.5Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(698.46, now);
      osc1.frequency.setValueAtTime(880.00, now + 0.12);
      osc1.frequency.setValueAtTime(1046.50, now + 0.24);

      osc2.frequency.setValueAtTime(349.23, now);
      osc2.frequency.setValueAtTime(440.00, now + 0.12);
      osc2.frequency.setValueAtTime(523.25, now + 0.24);

      osc1.connect(gain);
      osc2.connect(gain);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.85);
      osc2.stop(now + 0.85);
    } else if (type === 'test') {
      // Warm confirmation ping
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.connect(gain);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Upbeat 2-tone alert for new incoming order: C5 (523.25Hz) -> G5 (783.99Hz)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.15);
      osc.connect(gain);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc.start(now);
      osc.stop(now + 0.65);
    }

    return true;
  } catch (err) {
    console.warn('Audio playback error:', err);
    return false;
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('cheesy_audio_enabled');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [readyOrderNotification, setReadyOrderNotification] = useState<RealtimeOrder | null>(null);
  const [lastEventTime, setLastEventTime] = useState(Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());

  const setAudioEnabled = useCallback((val: boolean) => {
    setAudioEnabledState(val);
    try {
      localStorage.setItem('cheesy_audio_enabled', String(val));
    } catch (_) {}
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const unlocked = ctx.state === 'running';
      setIsAudioUnlocked(unlocked);
      if (unlocked) {
        setAudioBlocked(false);
      }
      return unlocked;
    } catch {
      return false;
    }
  }, []);

  const playChime = useCallback(async (type: 'new' | 'ready' | 'test' = 'new') => {
    if (!audioEnabled) return;
    const success = await playSynthesizedChime(type);
    if (!success) {
      setAudioBlocked(true);
    } else {
      setIsAudioUnlocked(true);
      setAudioBlocked(false);
    }
  }, [audioEnabled]);

  const testChime = useCallback(() => {
    unlockAudio().then(() => {
      playChime('test');
      toast.success('Audio notification working perfectly!', { id: 'audio-test' });
    });
  }, [unlockAudio, playChime]);

  const dismissReadyNotification = useCallback(() => {
    setReadyOrderNotification(null);
  }, []);

  // Unlock AudioContext automatically on the user's first gesture anywhere on the document
  useEffect(() => {
    const handleFirstGesture = () => {
      unlockAudio().then((unlocked) => {
        if (unlocked) {
          window.removeEventListener('pointerdown', handleFirstGesture);
          window.removeEventListener('keydown', handleFirstGesture);
          window.removeEventListener('touchstart', handleFirstGesture);
        }
      });
    };

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [unlockAudio]);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connectSSE() {
      try {
        const es = new EventSource('/api/events');
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.addEventListener('connected', () => {
          setIsConnected(true);
        });

        // Event: New order placed by cashier
        es.addEventListener('order:created', (e) => {
          try {
            const order: RealtimeOrder = JSON.parse(e.data);
            if (order._eventId && seenEventsRef.current.has(order._eventId)) {
              return; // Deduplicate
            }
            if (order._eventId) seenEventsRef.current.add(order._eventId);

            setLastEventTime(Date.now());
            playChime('new');
            toast.custom(
              (t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-[#1e1e1e] border-2 border-yellow-400 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white max-w-sm`}>
                  <div className="w-10 h-10 rounded-full bg-yellow-400 text-black font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    #{order.daily_order_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-yellow-400 text-sm">New Order Placed!</p>
                    <p className="text-white text-xs truncate">{order.customer_name}</p>
                    <p className="text-gray-400 text-[11px]">{order.items?.length || 0} items</p>
                  </div>
                </div>
              ),
              { duration: 5000 }
            );
          } catch (err) {
            console.error('Error parsing order:created', err);
          }
        });

        // Event: Order marked ready by kitchen (ALL items ready)
        es.addEventListener('order:ready', (e) => {
          try {
            const order: RealtimeOrder = JSON.parse(e.data);
            if (order._eventId && seenEventsRef.current.has(order._eventId)) {
              return;
            }
            if (order._eventId) seenEventsRef.current.add(order._eventId);

            setLastEventTime(Date.now());
            setReadyOrderNotification(order);
            playChime('ready');
          } catch (err) {
            console.error('Error parsing order:ready', err);
          }
        });

        // Event: Individual item ready (order still in progress)
        es.addEventListener('order:item_ready', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data._eventId && seenEventsRef.current.has(data._eventId)) {
              return;
            }
            if (data._eventId) seenEventsRef.current.add(data._eventId);

            setLastEventTime(Date.now());
            playChime('ready');
            toast.custom(
              (t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-[#1a1a1a] border border-green-500/50 p-3 rounded-xl shadow-xl flex items-center gap-3 text-white max-w-sm`}>
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    #{data.daily_order_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-400 text-xs leading-tight">{data.item_name} is Ready!</p>
                    <p className="text-gray-400 text-[11px] mt-0.5">{data.progress}</p>
                  </div>
                </div>
              ),
              { duration: 4000 }
            );
          } catch (err) {
            console.error('Error parsing order:item_ready', err);
          }
        });

        // Event: Item added to existing order
        es.addEventListener('order:item_added', (e) => {
          try {
            const data = JSON.parse(e.data);
            setLastEventTime(Date.now());
            toast(`Order #${data.daily_order_number}: New item added!`, {
              icon: '➕',
              style: { background: '#1e1e1e', color: '#fff', border: '1px solid #f59e0b' }
            });
          } catch (_) {}
        });

        // Event: Item status updated
        es.addEventListener('order:item_status_updated', () => {
          setLastEventTime(Date.now());
        });

        // Event: Fresh start
        es.addEventListener('orders:refreshed', () => {
          setLastEventTime(Date.now());
          toast('System orders refreshed. Starting from #001.', { icon: '🔄' });
        });

        // Event: General order status update
        es.addEventListener('order:status_updated', () => {
          setLastEventTime(Date.now());
        });

        es.addEventListener('order:updated', () => {
          setLastEventTime(Date.now());
        });

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          // Safe reconnect after 4 seconds
          reconnectTimeout = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 4000);
      }
    }

    connectSSE();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [playChime]);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        audioEnabled,
        setAudioEnabled,
        isAudioUnlocked,
        audioBlocked,
        unlockAudio,
        testChime,
        playChime,
        readyOrderNotification,
        dismissReadyNotification,
        lastEventTime,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}


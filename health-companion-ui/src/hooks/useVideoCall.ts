import { useCallback, useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'medicare_token';

interface UseVideoCallProps {
  appointmentId: string;
  userId: string;
  role: 'patient' | 'doctor';
  onCallEnd?: () => void;
}

export function useVideoCall({ appointmentId, userId, role, onCallEnd }: UseVideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);

  // Helper: create a SimplePeer and wire up all its events
  const createPeer = useCallback(
    (socketId: string, stream: MediaStream, initiator: boolean) => {
      const existing = peersRef.current.get(socketId);
      if (existing) {
        existing.destroy();
        peersRef.current.delete(socketId);
      }

      const PeerConstructor = (SimplePeer as any).default || SimplePeer;
      const peer = new PeerConstructor({ initiator, trickle: false, stream });

      peer.on('signal', (signal) => {
        socketRef.current?.emit('signal', {
          to: socketId,
          signal,
        });
      });

      peer.on('stream', (remote) => {
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
        setIsConnected(true);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
      });

      peer.on('close', () => {
        peersRef.current.delete(socketId);
        if (peersRef.current.size === 0) {
          setIsConnected(false);
          setRemoteStream(null);
        }
      });

      peersRef.current.set(socketId, peer);
      return peer;
    },
    []
  );

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;
    hasJoinedRef.current = false;

    socket.on('connect', () => {
      console.log('[VideoCall] Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('[VideoCall] Socket connection error:', err);
    });

    // --- Error messages from server (including time slot enforcement) ---
    socket.on('error-message', ({ message, code }: { message: string; code?: string }) => {
      console.error('[VideoCall] Server error:', message, code);
      if (code === 'TOO_EARLY') {
        setError(message);
      } else if (code === 'SLOT_EXPIRED') {
        setIsExpired(true);
        setError(message);
      } else {
        setError(message);
      }
    });

    // --- Real-time join notification ---
    socket.on('participant-joined-notification', ({ userName, role: joinedRole, message }: { userName: string; role: string; message: string }) => {
      console.log('[VideoCall] Participant joined:', message);
      toast.success(message, {
        description: joinedRole === 'doctor' ? 'The doctor is now in the call' : 'The patient is now in the call',
        duration: 5000,
      });
    });

    // --- Call expired by server timer ---
    socket.on('call-expired', ({ message }: { message: string }) => {
      console.log('[VideoCall] Call expired:', message);
      setIsExpired(true);
      toast.error('Meeting Time Expired', {
        description: message,
        duration: 10000,
      });
      // Cleanup after a short delay
      setTimeout(() => {
        cleanupPeers();
        setIsCallActive(false);
        setIsConnected(false);
        onCallEnd?.();
      }, 3000);
    });

    // Room joined successfully
    socket.on('room-joined', ({ appointmentId: roomId, role: myRole, userName, participants }) => {
      console.log('[VideoCall] Room joined:', roomId, 'as', myRole);
      // Create peers for existing participants
      participants?.forEach(({ socketId }: { socketId: string }) => {
        const stream = localStreamRef.current;
        if (stream && !peersRef.current.has(socketId)) {
          createPeer(socketId, stream, false);
        }
      });
    });

    // Someone else joined the room after us
    socket.on('peer-joined', ({ socketId: newSocketId }: { socketId: string }) => {
      console.log('[VideoCall] peer-joined:', newSocketId);
      const stream = localStreamRef.current;
      if (!stream) {
        console.warn('[VideoCall] peer-joined but no local stream yet');
        return;
      }
      if (!peersRef.current.has(newSocketId)) {
        createPeer(newSocketId, stream, true);
      }
    });

    // Incoming WebRTC signal
    socket.on('signal', ({ signal, from: signalingSocketId }: { signal: SimplePeer.SignalData; from: string }) => {
      console.log('[VideoCall] signal from:', signalingSocketId);
      let peer = peersRef.current.get(signalingSocketId);
      if (!peer) {
        const stream = localStreamRef.current;
        if (!stream) {
          console.warn('[VideoCall] received signal but no local stream yet');
          return;
        }
        peer = createPeer(signalingSocketId, stream, false);
      }
      peer.signal(signal);
    });

    socket.on('peer-left', ({ socketId }: { socketId: string }) => {
      console.log('[VideoCall] peer-left:', socketId);
      const peer = peersRef.current.get(socketId);
      if (peer) {
        peer.destroy();
        peersRef.current.delete(socketId);
      }
      if (peersRef.current.size === 0) {
        setIsConnected(false);
        setRemoteStream(null);
      }
    });

    // Call ended by other party
    socket.on('call-ended', () => {
      console.log('[VideoCall] Call ended by other party');
      toast.info('Call Ended', { description: 'The other participant ended the call.' });
      cleanupPeers();
      setIsCallActive(false);
      setIsConnected(false);
      onCallEnd?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      cleanupPeers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, createPeer]);

  const startCall = async () => {
    if (localStreamRef.current) {
      console.log('[VideoCall] startCall: stream already acquired');
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join room with authentication token
      if (!hasJoinedRef.current) {
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
        socketRef.current?.emit('join-room', { appointmentId, token });
        hasJoinedRef.current = true;
      }

      setIsCallActive(true);
      return stream;
    } catch (err: any) {
      console.error('[VideoCall] getUserMedia error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('Camera/microphone permission denied. Please allow access in your browser settings and try again.');
      } else if (err?.name === 'NotFoundError') {
        setError('No camera or microphone found. Please connect a device and try again.');
      } else {
        setError('Unable to access camera and microphone. Please check your device settings.');
      }
      return null;
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    socketRef.current?.emit('end-call', { appointmentId });
    cleanupPeers();
    setIsCallActive(false);
    setIsConnected(false);
    onCallEnd?.();
  };

  const cleanupPeers = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((peer) => peer.destroy());
    peersRef.current.clear();
    hasJoinedRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  };

  return {
    localVideoRef,
    remoteVideoRef,
    localStream,
    remoteStream,
    isConnected,
    isCallActive,
    error,
    isMuted,
    isCameraOff,
    isExpired,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
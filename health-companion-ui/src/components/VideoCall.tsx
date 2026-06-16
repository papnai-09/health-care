import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, AlertCircle, Loader2, TimerOff, MessageSquare, Send, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoCall } from '@/hooks/useVideoCall';

interface VideoCallProps {
  appointmentId: string;
  userId: string;
  role: 'patient' | 'doctor';
  patientName?: string;
  doctorName?: string;
  onCallEnd: () => void;
}

export function VideoCall({ appointmentId, userId, role, patientName, doctorName, onCallEnd }: VideoCallProps) {
  const {
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
    messages,
    startCall,
    leaveCall,
    completeCall,
    sendMessage,
    toggleMute,
    toggleCamera,
  } = useVideoCall({ appointmentId, userId, role, onCallEnd });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const otherPartyName = role === 'doctor' ? patientName : doctorName;

  // Auto-start camera/mic and join the room
  useEffect(() => {
    startCall();
  // startCall is stable (defined with useCallback / doesn't change) — safe to ignore dep warning
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind the local stream to the video element whenever it changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);

  // Bind the remote stream to the video element whenever it changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef]);

  // Scroll to bottom of chat when messages update or chat opens
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only increment if the message was sent by the other party
      if (lastMessage.senderId !== userId) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  }, [messages, isChatOpen, userId]);

  // Clear unread count when chat is opened
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput('');
    }
  };

  if (isExpired) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto px-6">
          <TimerOff className="mx-auto h-16 w-16 text-yellow-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Meeting Time Expired</h2>
          <p className="text-gray-300 mb-6 text-sm leading-relaxed">
            {error || 'The scheduled time slot for this meeting has ended. The call has been disconnected.'}
          </p>
          <Button onClick={onCallEnd} variant="secondary">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="mx-auto h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Cannot Start Video Call</h2>
          <p className="text-gray-300 mb-6 text-sm leading-relaxed">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => startCall()} variant="secondary">
              Try Again
            </Button>
            <Button onClick={onCallEnd} variant="destructive">
              Leave
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white overflow-hidden">
      {/* Upper Area: Video & Sidebar Chat Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Side: Video Area (full width unless chat is open) */}
        <div className="relative flex-1 bg-black overflow-hidden">
          {/* Remote Video */}
          <div className="absolute inset-0">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-white">
                  <div className="mb-6 h-24 w-24 rounded-full bg-white/10 flex items-center justify-center mx-auto border-2 border-white/20">
                    <span className="text-5xl">{otherPartyName?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    {isCallActive ? 'Waiting for other person to join...' : 'Starting call...'}
                  </h3>
                  <p className="text-white/60 text-sm mb-6">{otherPartyName || 'Connecting...'}</p>
                  {!isCallActive ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white/60 mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                      <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                      Waiting...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Local Video — Picture-in-Picture */}
          {localStream && (
            <div className="absolute bottom-6 right-6 h-40 w-56 overflow-hidden rounded-2xl border-2 border-white/20 bg-gray-800 shadow-2xl transition-all duration-300 z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {isCameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <VideoOff className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                You {isMuted && '(muted)'}
              </div>
            </div>
          )}

          {/* Connection status badge */}
          <div className="absolute top-4 left-4 z-10">
            <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white backdrop-blur-md ${
              isConnected ? 'bg-green-500/80' : isCallActive ? 'bg-yellow-500/80' : 'bg-gray-500/80'
            }`}>
              <div className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-white' : 'bg-white/60 animate-pulse'
              }`} />
              {isConnected ? 'Connected' : isCallActive ? 'Waiting for other person...' : 'Starting...'}
            </div>
          </div>

          {/* Other person's name */}
          {otherPartyName && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="rounded-full bg-black/50 px-4 py-1.5 text-sm text-white backdrop-blur-md">
                {otherPartyName}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Chat Panel Sidebar */}
        {isChatOpen && (
          <div className="w-96 border-l border-white/10 bg-gray-900 flex flex-col h-full z-20">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Consultation Chat</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(false)}
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-center text-gray-400 p-4">
                  <MessageSquare className="h-12 w-12 text-gray-600 mb-2" />
                  <p className="text-xs">No messages yet. Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.senderId === userId;
                  return (
                    <div
                      key={index}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-[10px] font-semibold text-gray-400">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                        <span className={`text-[8px] px-1 rounded uppercase ${
                          msg.senderRole === 'doctor' 
                            ? 'bg-primary/20 text-primary border border-primary/20' 
                            : 'bg-accent/20 text-accent border border-accent/20'
                        }`}>
                          {msg.senderRole}
                        </span>
                      </div>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        isMe 
                          ? 'bg-primary text-primary-foreground rounded-tr-none' 
                          : 'bg-gray-800 text-gray-100 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-0.5 px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-gray-800/30 flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 min-w-0 rounded-lg bg-gray-800 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
              <Button type="submit" size="icon" className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800/95 px-6 py-5 backdrop-blur border-t border-white/5 relative z-30">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          {/* Left Controls (Mute, Camera) */}
          <div className="flex gap-3">
            <Button
              size="lg"
              variant={isMuted ? 'destructive' : 'secondary'}
              onClick={toggleMute}
              className="h-12 w-12 rounded-full p-0"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              size="lg"
              variant={isCameraOff ? 'destructive' : 'secondary'}
              onClick={toggleCamera}
              className="h-12 w-12 rounded-full p-0"
              title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
          </div>

          {/* Center Control (Leave Call - Red button) */}
          <div>
            <Button
              size="lg"
              variant="destructive"
              onClick={leaveCall}
              className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 p-0"
              title="Leave call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>

          {/* Right Controls (Chat Toggle, Doctor Complete Consultation) */}
          <div className="flex gap-3 items-center">
            {/* Chat Toggle Button */}
            <Button
              size="lg"
              variant={isChatOpen ? 'default' : 'secondary'}
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`h-12 w-12 rounded-full p-0 relative ${
                isChatOpen ? 'bg-primary text-primary-foreground hover:bg-primary/95' : ''
              }`}
              title="Toggle Chat"
            >
              <MessageSquare className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-bounce">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* Doctor Complete Consultation Button */}
            {role === 'doctor' && (
              <Button
                size="lg"
                onClick={completeCall}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5 px-4 rounded-full font-semibold text-xs h-12 shadow-md"
                title="Complete Consultation"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Complete Visit</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
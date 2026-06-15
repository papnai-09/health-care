import { useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, AlertCircle, Loader2, TimerOff } from 'lucide-react';
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
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useVideoCall({ appointmentId, userId, role, onCallEnd });

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
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Main Video Area */}
      <div className="relative flex-1 overflow-hidden">

        {/* Remote Video — full screen */}
        <div className="absolute inset-0 bg-black">
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
          <div className="absolute bottom-24 right-4 h-44 w-60 overflow-hidden rounded-2xl border-2 border-white/30 bg-black shadow-2xl">
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
            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              You {isMuted && '(muted)'}
            </div>
          </div>
        )}

        {/* Connection status badge */}
        <div className="absolute top-4 left-4">
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white backdrop-blur ${
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="rounded-full bg-black/50 px-4 py-1.5 text-sm text-white backdrop-blur">
              {otherPartyName}
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800/95 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-center gap-4">
          <Button
            size="lg"
            variant={isMuted ? 'destructive' : 'secondary'}
            onClick={toggleMute}
            className="h-14 w-14 rounded-full"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            size="lg"
            variant={isCameraOff ? 'destructive' : 'secondary'}
            onClick={toggleCamera}
            className="h-14 w-14 rounded-full"
            title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={endCall}
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700"
            title="End call"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  );
}
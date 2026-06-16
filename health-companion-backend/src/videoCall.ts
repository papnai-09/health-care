import { Server as SocketIOServer, Socket } from 'socket.io';
import { appointmentsDb, usersDb, doctorsDb } from './database';

interface RoomParticipant {
  socketId: string;
  userId: string;
  userName: string;
  role: 'patient' | 'doctor';
}

const SLOT_DURATION_MINUTES = 30;

// appointmentId -> list of participants in the room
const rooms = new Map<string, RoomParticipant[]>();

// appointmentId -> auto-expire timer
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

const authenticateSocket = async (token: string) => {
  if (!token) return null;
  return usersDb.getByToken(token);
};

/**
 * Calculate the time window for an appointment slot.
 * Returns { start, end } as Date objects, or null if parsing fails.
 */
const getSlotWindow = (date: string, time: string) => {
  // Parse in Indian Standard Time (IST, UTC+05:30)
  const start = new Date(`${date}T${time}:00+05:30`);
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
  return { start, end };
};

/**
 * Format a Date to a human-readable time string like "09:00 AM"
 */
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const setupVideoCallSocket = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[VideoCall] Socket connected: ${socket.id}`);

    let currentRoom: string | null = null;
    let currentUserId: string | null = null;

    socket.on('join-room', async (data: { appointmentId: string; token: string }) => {
      try {
        const { appointmentId, token } = data;

        // Authenticate
        const user = await authenticateSocket(token);
        if (!user) {
          socket.emit('error-message', { message: 'Authentication failed' });
          return;
        }

        // Validate appointment access
        const appointment = await appointmentsDb.getById(appointmentId);
        if (!appointment) {
          socket.emit('error-message', { message: 'Appointment not found' });
          return;
        }

        const isPatient = appointment.userId === user.id;
        const isDoctor = user.role === 'doctor' && appointment.doctorId === user.doctorId;

        if (!isPatient && !isDoctor) {
          socket.emit('error-message', { message: 'You are not part of this appointment' });
          return;
        }

        // --- Strict Time Slot Enforcement ---
        const slotWindow = getSlotWindow(appointment.date, appointment.time);
        if (slotWindow) {
          const now = new Date();

          if (now < slotWindow.start) {
            socket.emit('error-message', {
              message: `Meeting hasn't started yet. Please join at ${formatTime(slotWindow.start)}.`,
              code: 'TOO_EARLY',
              startsAt: slotWindow.start.toISOString(),
            });
            return;
          }

          if (now >= slotWindow.end) {
            // Auto-cancel expired appointment if still scheduled
            if (appointment.status === 'scheduled') {
              try {
                await appointmentsDb.update(appointmentId, { status: 'cancelled' });
                console.log(`[VideoCall] Auto-cancelled expired appointment ${appointmentId}`);
              } catch (err) {
                console.error('[VideoCall] Failed to auto-cancel expired appointment:', err);
              }
            }

            socket.emit('error-message', {
              message: 'This meeting slot has expired. The appointment time has passed.',
              code: 'SLOT_EXPIRED',
            });
            return;
          }
        }

        // Check appointment status
        if (appointment.status === 'cancelled') {
          socket.emit('error-message', { message: 'This appointment has been cancelled.' });
          return;
        }

        if (appointment.status === 'completed') {
          socket.emit('error-message', { message: 'This appointment has already been completed.' });
          return;
        }

        // Leave any previous room
        if (currentRoom) {
          socket.leave(currentRoom);
          removeFromRoom(currentRoom, socket.id);
        }

        currentRoom = appointmentId;
        currentUserId = user.id;
        const role: 'patient' | 'doctor' = isDoctor ? 'doctor' : 'patient';

        // Join the Socket.IO room
        socket.join(appointmentId);

        // Track participant
        const participants = rooms.get(appointmentId) ?? [];
        // Remove stale entry for the same user (reconnection case)
        const filtered = participants.filter((p) => p.userId !== user.id);
        filtered.push({ socketId: socket.id, userId: user.id, userName: user.name, role });
        rooms.set(appointmentId, filtered);

        console.log(`[VideoCall] ${role} ${user.name} joined room ${appointmentId} (${filtered.length} in room)`);

        // Tell the joining user who's already in the room
        const otherParticipants = filtered.filter((p) => p.socketId !== socket.id);
        socket.emit('room-joined', {
          appointmentId,
          role,
          userName: user.name,
          participants: otherParticipants.map((p) => ({ socketId: p.socketId, role: p.role })),
        });

        // Tell others that someone new joined (for WebRTC signaling)
        socket.to(appointmentId).emit('peer-joined', {
          socketId: socket.id,
          role,
          userName: user.name,
        });

        // --- Real-time Join Notification ---
        // Send a notification to all OTHER participants that this person has joined
        const roleName = role === 'doctor' ? `Dr. ${user.name}` : user.name;
        socket.to(appointmentId).emit('participant-joined-notification', {
          userName: user.name,
          role,
          message: `${roleName} has joined the meeting`,
        });

        // --- Setup Auto-Expire Timer ---
        // Only set if there isn't one already for this room
        if (slotWindow && !expiryTimers.has(appointmentId)) {
          const msUntilExpiry = slotWindow.end.getTime() - Date.now();
          if (msUntilExpiry > 0) {
            const timer = setTimeout(async () => {
              console.log(`[VideoCall] Slot expired for room ${appointmentId}`);

              // Notify all participants in the room
              io.to(appointmentId).emit('call-expired', {
                message: 'Meeting time slot has ended. The call will be disconnected.',
                appointmentId,
              });

              // Mark appointment as cancelled if still scheduled
              try {
                const currentAppointment = await appointmentsDb.getById(appointmentId);
                if (currentAppointment && currentAppointment.status === 'scheduled') {
                  await appointmentsDb.update(appointmentId, { status: 'cancelled' });
                  console.log(`[VideoCall] Auto-cancelled appointment ${appointmentId} after slot expiry`);
                }
              } catch (err) {
                console.error('[VideoCall] Failed to update appointment on expiry:', err);
              }

              // Clean up room
              rooms.delete(appointmentId);
              expiryTimers.delete(appointmentId);
            }, msUntilExpiry);

            expiryTimers.set(appointmentId, timer);
            console.log(`[VideoCall] Auto-expire timer set for room ${appointmentId} in ${Math.round(msUntilExpiry / 1000)}s`);
          }
        }
      } catch (error) {
        console.error('[VideoCall] join-room error:', error);
        socket.emit('error-message', { message: 'Failed to join room' });
      }
    });

    // Forward WebRTC signaling data (offer/answer/ICE candidates)
    socket.on('signal', (data: { to: string; signal: unknown }) => {
      io.to(data.to).emit('signal', {
        from: socket.id,
        signal: data.signal,
      });
    });

    // End the call
    socket.on('end-call', async (data: { appointmentId: string }) => {
      const { appointmentId } = data;
      if (!appointmentId) return;

      console.log(`[VideoCall] Call ended in room ${appointmentId} by ${socket.id}`);

      // Notify all other participants
      socket.to(appointmentId).emit('call-ended', { by: socket.id });

      // Mark appointment as completed
      try {
        await appointmentsDb.update(appointmentId, { status: 'completed' });
      } catch (error) {
        console.error('[VideoCall] Failed to update appointment status:', error);
      }

      // Clear expiry timer since call ended properly
      const timer = expiryTimers.get(appointmentId);
      if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(appointmentId);
      }

      // Clean up room
      rooms.delete(appointmentId);
    });

    socket.on('disconnect', () => {
      console.log(`[VideoCall] Socket disconnected: ${socket.id}`);
      if (currentRoom) {
        socket.to(currentRoom).emit('peer-left', { socketId: socket.id });
        removeFromRoom(currentRoom, socket.id);
        currentRoom = null;
        currentUserId = null;
      }
    });
  });
};

const removeFromRoom = (appointmentId: string, socketId: string) => {
  const participants = rooms.get(appointmentId);
  if (!participants) return;

  const filtered = participants.filter((p) => p.socketId !== socketId);
  if (filtered.length === 0) {
    rooms.delete(appointmentId);
    // Clear expiry timer if room is empty
    const timer = expiryTimers.get(appointmentId);
    if (timer) {
      clearTimeout(timer);
      expiryTimers.delete(appointmentId);
    }
  } else {
    rooms.set(appointmentId, filtered);
  }
};

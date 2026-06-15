import { Server as SocketIOServer, Socket } from 'socket.io';
import { appointmentsDb, usersDb } from './database';

interface RoomParticipant {
  socketId: string;
  userId: string;
  role: 'patient' | 'doctor';
}

// appointmentId -> list of participants in the room
const rooms = new Map<string, RoomParticipant[]>();

const authenticateSocket = async (token: string) => {
  if (!token) return null;
  return usersDb.getByToken(token);
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
        filtered.push({ socketId: socket.id, userId: user.id, role });
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

        // Tell others that someone new joined
        socket.to(appointmentId).emit('peer-joined', {
          socketId: socket.id,
          role,
          userName: user.name,
        });
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
  } else {
    rooms.set(appointmentId, filtered);
  }
};

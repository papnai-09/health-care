import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { VideoCall } from '@/components/VideoCall';

function VideoCallPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [doctorName, setDoctorName] = useState<string>('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const { id, patient, doctor } = router.query;
    
    if (typeof id === 'string') {
      setAppointmentId(id);
    }
    if (typeof patient === 'string') {
      setPatientName(patient);
    }
    if (typeof doctor === 'string') {
      setDoctorName(doctor);
    }

    // Validate required parameters
    if (id && user) {
      setIsValid(true);
    }
  }, [router.query, user]);

  const handleCallEnd = () => {
    router.back();
  };

  if (!isValid) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p>Loading video call...</p>
        </div>
      </div>
    );
  }

  const role = user?.role === 'doctor' ? 'doctor' : 'patient';

  return (
    <ProtectedRoute allowedRoles={['patient', 'doctor']}>
      <VideoCall
        appointmentId={appointmentId}
        userId={user?.id || ''}
        role={role}
        patientName={patientName}
        doctorName={doctorName}
        onCallEnd={handleCallEnd}
      />
    </ProtectedRoute>
  );
}

export default VideoCallPage;

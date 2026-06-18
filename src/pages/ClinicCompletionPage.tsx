import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ClinicCompletionFlow } from '../components/clinics/ClinicCompletionFlow';
import { useCanManageMedical } from '../lib/useAnimalPermissions';

// Full-page "Complete Clinic" flow. Rendered inside the AppShell (so the
// sidebar + app background are preserved), reached at /clinics/:id/complete.
export function ClinicCompletionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canManageMedical = useCanManageMedical();
  // Completing a clinic is a medical-management action — guard the direct URL,
  // not just the button on the clinic page.
  if (!canManageMedical) {
    return <Navigate to={`/clinics/${id}`} replace />;
  }
  return (
    <ClinicCompletionFlow
      clinicEventId={id ?? null}
      onClose={() => navigate(`/clinics/${id}`)} />);

}

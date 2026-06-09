import { useParams, useNavigate } from 'react-router-dom';
import { ClinicCompletionFlow } from '../components/clinics/ClinicCompletionFlow';

// Full-page "Complete Clinic" flow. Rendered inside the AppShell (so the
// sidebar + app background are preserved), reached at /clinics/:id/complete.
export function ClinicCompletionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <ClinicCompletionFlow
      clinicEventId={id ?? null}
      onClose={() => navigate(`/clinics/${id}`)} />);

}

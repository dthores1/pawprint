import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { StethoscopeIcon, PlusIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { ClinicsView } from '../components/clinics/ClinicsView';
import { MedicalRecordsView } from '../components/medical/MedicalRecordsView';
import { AddMedicalRecordModal } from '../components/medical/AddMedicalRecordModal';
import { NewClinicEventModal } from '../components/clinics/NewClinicEventModal';

type MedicalTab = 'clinics' | 'records';
const TABS: { key: MedicalTab; label: string }[] = [
{ key: 'clinics', label: 'Clinics' },
{ key: 'records', label: 'Records' }];

export function Medical() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: MedicalTab =
  searchParams.get('tab') === 'records' ? 'records' : 'clinics';
  const setTab = (next: MedicalTab) => {
    setSearchParams(next === 'clinics' ? {} : { tab: next }, { replace: true });
  };
  const [isNewClinicOpen, setIsNewClinicOpen] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <StethoscopeIcon className="w-8 h-8 text-primary" />
            Medical
          </h1>
          <p className="text-text-secondary mt-1">
            Track medical records and plan spay/neuter and vaccine clinics.
          </p>
        </div>
        {tab === 'clinics' ?
        <Button onClick={() => setIsNewClinicOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            New Clinic
          </Button> :

        <Button onClick={() => setIsAddRecordOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Add Medical Record
          </Button>
        }
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) =>
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors',
            tab === t.key ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

            {t.label}
          </button>
        )}
      </div>

      {tab === 'clinics' ? <ClinicsView /> : <MedicalRecordsView />}

      <NewClinicEventModal
        isOpen={isNewClinicOpen}
        onClose={() => setIsNewClinicOpen(false)} />

      <AddMedicalRecordModal
        isOpen={isAddRecordOpen}
        onClose={() => setIsAddRecordOpen(false)} />

    </div>);

}

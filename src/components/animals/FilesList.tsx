import { useState } from 'react';
import {
  FileTextIcon,
  ImageIcon,
  TableIcon,
  FileIcon,
  ExternalLinkIcon,
  DownloadIcon,
  Trash2Icon,
  PawPrintIcon } from
'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalFile } from '../../types';
import { FILE_CATEGORY_LABELS } from '../../lib/filesApi';
import { formatDate } from '../../lib/utils';
import { AddFileModal } from './AddFileModal';

interface FilesListProps {
  animalId: string;
  /** Whether the viewer may upload/delete files. View/Download stay available. */
  canManage?: boolean;
  /** Add-file modal state, lifted so the trigger can live in the tab row. */
  isAddOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

async function openFile(
getUrl: (f: AnimalFile, o?: { download?: boolean }) => Promise<string | null>,
file: AnimalFile,
download: boolean)
{
  const url = await getUrl(file, { download });
  if (!url) return;
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function iconFor(file: AnimalFile) {
  const t = file.file_type ?? '';
  const name = file.file_name.toLowerCase();
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/.test(name))
  return ImageIcon;
  if (t === 'application/pdf' || name.endsWith('.pdf')) return FileTextIcon;
  if (/sheet|excel|csv/.test(t) || /\.(xlsx?|csv)$/.test(name)) return TableIcon;
  if (/word|document/.test(t) || /\.(docx?|txt|rtf)$/.test(name)) return FileTextIcon;
  return FileIcon;
}

export function FilesList({
  animalId,
  canManage = true,
  isAddOpen,
  onAddOpenChange
}: FilesListProps) {
  const { animalFiles, getAnimalFileUrl, deleteAnimalFile, peopleIndex } = useWhisker();
  const [confirm, setConfirm] = useState<AnimalFile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const files = animalFiles.filter((f) => f.animal_id === animalId);

  const open = async (file: AnimalFile, download: boolean) => {
    setBusyId(file.id);
    await openFile(getAnimalFileUrl, file, download);
    setBusyId(null);
  };

  const uploaderName = (userId?: string) => {
    if (!userId) return null;
    const p = peopleIndex.find((x) => x.user_id === userId);
    return p ? `${p.first_name} ${p.last_name}`.trim() : null;
  };

  return (
    <Card className="p-0 overflow-hidden">
      {files.length === 0 ?
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-full bg-background mb-3">
            <PawPrintIcon className="w-6 h-6 text-text-secondary" />
          </span>
          <p className="text-sm text-text-secondary max-w-sm">
            Upload PDFs, forms, records, and other documents related to this animal.
          </p>
        </div> :

      <ul className="divide-y divide-border">
          {files.map((file) => {
          const Icon = iconFor(file);
          const who = uploaderName(file.uploaded_by_user_id);
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-background shrink-0">
                  <Icon className="w-4 h-4 text-text-secondary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {FILE_CATEGORY_LABELS[file.category] ?? file.category}
                    {' · '}Uploaded {formatDate(file.created_at)}
                    {who ? ` by ${who}` : ''}
                  </p>
                  {file.notes &&
                <p className="text-xs text-text-secondary mt-0.5 truncate">{file.notes}</p>
                }
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                  type="button"
                  title="View"
                  disabled={busyId === file.id}
                  onClick={() => open(file, false)}
                  className="p-2 rounded-lg text-text-secondary hover:bg-background hover:text-text-primary transition-colors disabled:opacity-50">
                    <ExternalLinkIcon className="w-4 h-4" />
                  </button>
                  <button
                  type="button"
                  title="Download"
                  disabled={busyId === file.id}
                  onClick={() => open(file, true)}
                  className="p-2 rounded-lg text-text-secondary hover:bg-background hover:text-text-primary transition-colors disabled:opacity-50">
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  {canManage &&
                <button
                  type="button"
                  title="Delete"
                  onClick={() => setConfirm(file)}
                  className="p-2 rounded-lg text-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                }
                </div>
              </li>);

        })}
        </ul>
      }

      <AddFileModal
        isOpen={isAddOpen}
        onClose={() => onAddOpenChange(false)}
        animalId={animalId} />

      <Modal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Delete file?"
        footer={
        <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (confirm) deleteAnimalFile(confirm.id);
              setConfirm(null);
            }}>
              Delete
            </Button>
          </div>
        }>

        <p className="text-sm text-text-secondary">
          Delete <span className="font-semibold text-text-primary">{confirm?.file_name}</span>?
          This permanently removes the file and can't be undone.
        </p>
      </Modal>
    </Card>);

}

// Compact, read-only list of files — used to surface medical-categorized files
// inside the Medical Records tab. The master list (with add/delete) lives in
// the Files tab.
export function AttachedFilesCard({
  files,
  title = 'Attached files'



}: {files: AnimalFile[];title?: string;}) {
  const { getAnimalFileUrl } = useWhisker();
  if (files.length === 0) return null;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-background/60">
        <span className="text-sm font-semibold text-text-secondary">{title}</span>
      </div>
      <ul className="divide-y divide-border">
        {files.map((file) => {
          const Icon = iconFor(file);
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-background shrink-0">
                <Icon className="w-4 h-4 text-text-secondary" />
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium text-text-primary truncate">
                {file.file_name}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="View"
                  onClick={() => openFile(getAnimalFileUrl, file, false)}
                  className="p-2 rounded-lg text-text-secondary hover:bg-background hover:text-text-primary transition-colors">
                  <ExternalLinkIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Download"
                  onClick={() => openFile(getAnimalFileUrl, file, true)}
                  className="p-2 rounded-lg text-text-secondary hover:bg-background hover:text-text-primary transition-colors">
                  <DownloadIcon className="w-4 h-4" />
                </button>
              </div>
            </li>);

        })}
      </ul>
    </Card>);

}

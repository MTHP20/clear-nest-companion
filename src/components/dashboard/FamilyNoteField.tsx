import { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';

interface FamilyNoteFieldProps {
  itemId: string;
}

export default function FamilyNoteField({ itemId }: FamilyNoteFieldProps) {
  const { userNotes, setUserNote } = useSession();
  const existing = userNotes[itemId] ?? '';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(existing);

  const handleSave = () => {
    setUserNote(itemId, draft.trim());
    setOpen(false);
  };

  const handleEdit = () => {
    setDraft(existing);
    setOpen(true);
  };

  if (!open && existing) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="font-body text-xs text-muted-foreground mb-1">Your note</p>
        <p className="font-body text-sm text-foreground">{existing}</p>
        <button
          onClick={handleEdit}
          className="font-body text-xs text-primary hover:underline mt-1"
        >
          Edit note
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="font-body text-xs text-muted-foreground mb-1.5">Your note</p>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="e.g. Called Barclays on 28 Feb — confirmed account number ends 4421"
          rows={2}
          className="w-full font-body text-sm border border-border rounded-lg px-3 py-2 text-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="font-body text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            Save
          </button>
          <button
            onClick={() => setOpen(false)}
            className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-2">
      <button
        onClick={() => { setDraft(''); setOpen(true); }}
        className="font-body text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        + Add a note
      </button>
    </div>
  );
}

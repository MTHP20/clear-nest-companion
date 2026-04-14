import { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';

interface FamilyNoteFieldProps {
  itemId: string;
}

const FF = 'Figtree, system-ui, sans-serif';

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
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ov-card-border)' }}>
        <p style={{ fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)', marginBottom: 4 }}>Your note</p>
        <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--ov-text)' }}>{existing}</p>
        <button
          onClick={handleEdit}
          style={{ fontFamily: FF, fontSize: 11, color: 'var(--ov-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none'; }}
        >
          Edit note
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ov-card-border)' }}>
        <p style={{ fontFamily: FF, fontSize: 11, color: 'var(--ov-muted)', marginBottom: 6 }}>Your note</p>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="e.g. Called Barclays on 28 Feb — confirmed account number ends 4421"
          rows={2}
          style={{
            width: '100%', fontFamily: FF, fontSize: 13,
            border: '1px solid var(--ov-card-border)', borderRadius: 10,
            padding: '10px 12px', color: 'var(--ov-text)',
            background: 'var(--ov-inner)',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleSave}
            style={{
              fontFamily: FF, fontSize: 12, fontWeight: 600,
              background: 'var(--ov-accent)', color: 'white',
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={() => setOpen(false)}
            style={{
              fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 4 }}>
      <button
        onClick={() => { setDraft(''); setOpen(true); }}
        style={{
          fontFamily: FF, fontSize: 12, color: 'var(--ov-muted)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          transition: 'color 0.18s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ov-muted)'; }}
      >
        + Add a note
      </button>
    </div>
  );
}

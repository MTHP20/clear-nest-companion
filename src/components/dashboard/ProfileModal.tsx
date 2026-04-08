import { useState } from 'react';
import { X, User, Users, Check } from 'lucide-react';
import { useSession, ProfileUpdate } from '@/contexts/SessionContext';

interface ProfileModalProps {
  onClose: () => void;
  colors: {
    bgCard: string;
    headerText: string;
    headerMuted: string;
    glassBorder: string;
    primary: string;
    border: string;
    teal: string;
  };
}

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export default function ProfileModal({ onClose, colors: C }: ProfileModalProps) {
  const { parentName, childName, familyId, updateProfile } = useSession();

  // Load full profile from localStorage for age/gender
  const stored = (() => {
    try {
      const raw = localStorage.getItem('cn-user-profile');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  })();

  const [elderlyName, setElderlyName] = useState(stored.elderlyName ?? parentName);
  const [age, setAge] = useState(stored.age ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'prefer-not-to-say'>(
    stored.gender ?? 'prefer-not-to-say'
  );
  const [trustedContactName, setTrustedContactName] = useState(
    stored.trustedContactName ?? childName
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!elderlyName.trim()) return;
    setSaving(true);
    const update: ProfileUpdate = {
      elderlyName: elderlyName.trim(),
      age: age.trim(),
      gender,
      trustedContactName: trustedContactName.trim(),
    };
    await updateProfile(update);
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: 'rgba(255,255,255,0.06)',
    color: C.headerText,
    fontSize: 14,
    fontFamily: 'Figtree, system-ui, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: C.headerMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginBottom: 6,
    display: 'block',
    fontFamily: 'Figtree, system-ui, sans-serif',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.bgCard,
        borderRadius: 20,
        padding: '28px 28px 24px',
        width: '100%', maxWidth: 440,
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        border: `1px solid ${C.glassBorder}`,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5A623, #FF8A60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User style={{ width: 18, height: 18, color: 'white' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.headerText, fontFamily: 'Figtree, system-ui, sans-serif' }}>
                Profile
              </div>
              <div style={{ fontSize: 11, color: C.headerMuted, fontFamily: 'Figtree, system-ui, sans-serif' }}>
                Edit details for your loved one
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.headerMuted, padding: 4, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Elderly person section */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${C.glassBorder}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5A623, #FF8A60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User style={{ width: 14, height: 14, color: 'white' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.headerText, fontFamily: 'Figtree, system-ui, sans-serif' }}>
              Loved one
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Full name *</label>
              <input
                value={elderlyName}
                onChange={e => setElderlyName(e.target.value)}
                placeholder="e.g. Margaret Davies"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Age</label>
                <input
                  type="number"
                  min="0"
                  max="130"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="e.g. 78"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Gender</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as typeof gender)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {GENDERS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Trusted contact section */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${C.glassBorder}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F0C050, #E8955A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Users style={{ width: 14, height: 14, color: 'white' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.headerText, fontFamily: 'Figtree, system-ui, sans-serif' }}>
              Family contact
            </span>
          </div>

          <div>
            <label style={labelStyle}>Your name</label>
            <input
              value={trustedContactName}
              onChange={e => setTrustedContactName(e.target.value)}
              placeholder="e.g. Michael"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Family ID (read-only) */}
        <div style={{
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 10, padding: '10px 14px',
          border: `1px solid ${C.glassBorder}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.headerMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4, fontFamily: 'Figtree, system-ui, sans-serif' }}>
            Family ID (read-only)
          </div>
          <div style={{ fontSize: 12, color: C.headerMuted, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {familyId}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !elderlyName.trim()}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 12, border: 'none',
            background: saved
              ? 'linear-gradient(135deg, #5DD87A, #3ab55a)'
              : `linear-gradient(135deg, ${C.primary}, ${C.teal})`,
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: saving || !elderlyName.trim() ? 'not-allowed' : 'pointer',
            opacity: saving || !elderlyName.trim() ? 0.65 : 1,
            fontFamily: 'Figtree, system-ui, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.3s, opacity 0.2s',
          }}
        >
          {saved ? (
            <><Check style={{ width: 16, height: 16 }} /> Saved</>
          ) : saving ? (
            'Saving…'
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </div>
  );
}

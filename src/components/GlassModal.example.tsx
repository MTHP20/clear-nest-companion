/**
 * GlassModal — example component kept for future use.
 *
 * This pattern was originally used for the inline Privacy / Terms / Safeguarding
 * policy modals on the Landing page before those moved to dedicated routes.
 *
 * Usage:
 *   <GlassModal title="My Modal" onClose={() => setOpen(false)}>
 *     <p>Content here</p>
 *   </GlassModal>
 */

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface GlassModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function GlassModal({ title, onClose, children }: GlassModalProps) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(20,10,50,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(200,180,240,0.55)',
          borderRadius: 28,
          boxShadow: '0 24px 72px rgba(40,20,100,0.32), inset 0 1.5px 0 rgba(255,255,255,0.60)',
          maxWidth: 600, width: '100%',
          maxHeight: '80dvh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 28px 16px',
          borderBottom: '1px solid rgba(200,180,240,0.25)',
        }}>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700,
            color: '#1a0a4a', fontFamily: 'Figtree, system-ui, sans-serif',
          }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.07)', border: 'none',
              borderRadius: '50%', width: 32, height: 32,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={16} color="#1a0a4a" />
          </button>
        </div>

        {/* Body — scrollable, no scrollbar */}
        <div style={{
          padding: '20px 28px 28px',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore webkit non-standard
          className="[&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

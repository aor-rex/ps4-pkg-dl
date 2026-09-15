import type { CSSProperties, ReactNode } from 'react';

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '40px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: checked ? 'var(--accent)' : 'var(--border)',
        position: 'relative',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        cursor: 'pointer',
        border: 'none',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: checked ? '#ffffff' : 'var(--text-muted)',
          transition: 'left 0.2s ease, background-color 0.2s ease',
        }}
      />
    </button>
  );
}

export function SettingRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}

export const inputStyle = {
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  padding: '8px 12px',
  borderRadius: '4px',
  width: '100%',
  outline: 'none',
} as const;

export const btnStyle = (primary: boolean): CSSProperties => ({
  backgroundColor: primary ? 'var(--accent)' : 'transparent',
  border: primary ? 'none' : '1px solid var(--accent)',
  color: primary ? 'var(--text-on-accent)' : 'var(--accent)',
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

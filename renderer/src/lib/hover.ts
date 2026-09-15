import type { MouseEvent } from 'react';

type Hoverable = { style: CSSStyleDeclaration };

interface HoverProps {
  onMouseEnter: (e: MouseEvent<Hoverable>) => void;
  onMouseLeave: (e: MouseEvent<Hoverable>) => void;
}

function pair(
  enterValue: string,
  leaveValue: string,
  prop: 'backgroundColor' | 'borderColor' | 'color'
): HoverProps {
  return {
    onMouseEnter: (e) => {
      e.currentTarget.style[prop] = enterValue;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style[prop] = leaveValue;
    },
  };
}

/** Tertiary fill → border wash. Base must be `backgroundColor: 'var(--bg-tertiary)'`. */
export const hoverFill = pair('var(--border)', 'var(--bg-tertiary)', 'backgroundColor');

/** Border → accent outline. Base must be `border: '1px solid var(--border)'`. */
export const hoverOutline = pair('var(--accent)', 'var(--border)', 'borderColor');

/** Accent fill → darker hover. Base must be `backgroundColor: 'var(--accent)'`. */
export const hoverAccentFill = pair('var(--accent-hover)', 'var(--accent)', 'backgroundColor');

/** Muted text → accent text. Base must be `color: 'var(--text-muted)'`. */
export const hoverAccentText = pair('var(--accent)', 'var(--text-muted)', 'color');

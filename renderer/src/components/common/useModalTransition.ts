import { useEffect, useRef, useState } from 'react';

const EXIT_MS = 150;

/**
 * Two-phase modal transition: keeps the modal mounted with an exit
 * animation, then unmounts. Mirrors the Toast dismiss pattern.
 */
export function useModalTransition(open: boolean): { shouldRender: boolean; exiting: boolean } {
  const [render, setRender] = useState(open);
  const [exiting, setExiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      setRender(true);
      setExiting(false);
    } else if (render) {
      setExiting(true);
      timer.current = setTimeout(() => {
        setRender(false);
        setExiting(false);
      }, EXIT_MS);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [open, render]);

  return { shouldRender: render, exiting };
}

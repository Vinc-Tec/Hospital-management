import { useEffect, useRef } from 'react';

// Subtle cursor-tracking effect: a small dot follows the mouse exactly,
// and a larger ring trails behind it with easing for a smooth feel. Pure
// visual polish -- no interaction, no effect on layout or accessibility.
// Automatically disabled on touch devices (checked via a pointer-coarse
// media query) since there's no mouse to track and it would otherwise
// leave a stray dot stuck on screen after the last tap.
export function CursorEffect() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = -100, mouseY = -100;
    let ringX = -100, ringY = -100;
    let visible = false;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX; mouseY = e.clientY;
      if (!visible) { visible = true; dot.style.opacity = '1'; ring.style.opacity = '1'; }
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    };
    const onLeave = () => { visible = false; dot.style.opacity = '0'; ring.style.opacity = '0'; };

    const animate = () => {
      // Ease the ring toward the real cursor position for a smooth trail.
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (window.matchMedia('(pointer: coarse)').matches) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-2 h-2 rounded-full bg-blue-500 pointer-events-none z-[9999] opacity-0 transition-opacity duration-200"
        style={{ transform: 'translate(-100px, -100px)', marginLeft: -4, marginTop: -4, boxShadow: '0 0 8px 2px rgba(59,130,246,0.6)' }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-blue-400/50 pointer-events-none z-[9998] opacity-0 transition-opacity duration-300"
        style={{ transform: 'translate(-100px, -100px)', marginLeft: -16, marginTop: -16, boxShadow: '0 0 16px 4px rgba(59,130,246,0.25)' }}
      />
    </>
  );
}

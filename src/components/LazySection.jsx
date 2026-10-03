import React, { useEffect, useRef, useState } from 'react';

// Renders children only once the section is within ~600px of the viewport.
export default function LazySection({ id, minHeight = 400, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    if (window.location.hash === `#${id}`) { setVisible(true); return undefined; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); },
      { rootMargin: '600px 0px' }
    );
    if (ref.current) io.observe(ref.current);
    const onForce = (e) => { if (e.detail === id) setVisible(true); };
    window.addEventListener('force-load-section', onForce);
    return () => { io.disconnect(); window.removeEventListener('force-load-section', onForce); };
  }, [id, visible]);

  return (
    <div ref={ref} id={id} className="section-anchor" style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}

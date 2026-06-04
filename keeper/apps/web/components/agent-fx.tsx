"use client";

// Self-contained atmosphere for the agent view: an animated grid, drifting
// particles, and the handful of keyframes the agent components reference
// (blink caret, swarm ping). Injected as a plain <style> so WS5 never has to
// touch WS7's globals.css or tailwind config — everything here is namespaced.

const CSS = `
@keyframes ag-blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
.animate-blink { animation: ag-blink 1s step-end infinite; }

@keyframes swarm-ping {
  0%   { box-shadow: 0 0 0 0 currentColor; opacity: .6 }
  70%  { box-shadow: 0 0 0 10px transparent; opacity: 0 }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 0 }
}

@keyframes ag-grid-pan { from { background-position: 0 0 } to { background-position: 44px 44px } }
@keyframes ag-drift {
  0%   { transform: translateY(0) translateX(0); opacity: 0 }
  10%  { opacity: .5 }
  90%  { opacity: .5 }
  100% { transform: translateY(-120px) translateX(14px); opacity: 0 }
}
@keyframes ag-sheen { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }

.ag-backdrop {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  background:
    radial-gradient(900px 500px at 70% -10%, rgba(52,211,153,0.10), transparent 60%),
    radial-gradient(700px 600px at 10% 110%, rgba(56,189,248,0.08), transparent 60%);
}
.ag-grid {
  position: absolute; inset: -2px;
  background-image:
    linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 40%, transparent 100%);
  animation: ag-grid-pan 12s linear infinite;
}
.ag-particle {
  position: absolute; bottom: -10px; width: 3px; height: 3px; border-radius: 9999px;
  background: rgba(52,211,153,0.7); box-shadow: 0 0 8px rgba(52,211,153,0.8);
  animation: ag-drift linear infinite;
}
.ag-sheen {
  background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: ag-sheen 2.6s linear infinite;
}
`;

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: (i % 6) * 1.1,
  dur: 7 + (i % 5) * 1.6,
}));

export function AgentBackdrop() {
  return (
    <div className="ag-backdrop">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ag-grid" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ag-particle"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  );
}

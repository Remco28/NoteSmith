import { FRAMES, SPRITE_H, SPRITE_W, frameRects } from "./smith-sprite";

const raised = frameRects(FRAMES.raised);
const strike = frameRects(FRAMES.strike);

/** Sparks fly from where the hammer meets the hot metal (sprite pixel 17,14). */
const SPARKS = [
  { dx: "-7px", dy: "-9px", delay: "0s", color: "#ffd36b" },
  { dx: "6px", dy: "-11px", delay: "0.03s", color: "#f08a3c" },
  { dx: "10px", dy: "-4px", delay: "0.05s", color: "#ffd36b" },
  { dx: "-10px", dy: "-3px", delay: "0.02s", color: "#ff9d55" },
  { dx: "2px", dy: "-13px", delay: "0.06s", color: "#fff1c9" },
];

/**
 * The pixel smith. While `working`, he hammers and sparks fly; otherwise he
 * stands with the hammer raised. `scale` is the size of one sprite pixel.
 */
export function Smith({ working, scale = 3, label }: { working: boolean; scale?: number; label?: string }) {
  const w = SPRITE_W * scale;
  const h = SPRITE_H * scale;
  return (
    <div
      className={`relative shrink-0 ${working ? "smith-working" : ""}`}
      style={{ width: w, height: h }}
      role="img"
      aria-label={label ?? (working ? "The smith is forging" : "The smith is waiting")}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
        shapeRendering="crispEdges"
        className="absolute inset-0"
      >
        <g className="frame-raised" style={{ opacity: working ? undefined : 1 }}>
          {raised.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
        <g className="frame-strike" style={{ opacity: working ? undefined : 0 }}>
          {strike.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
      </svg>
      {working &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            className="spark absolute"
            style={
              {
                left: 17 * scale,
                top: 13 * scale,
                width: Math.max(2, Math.round(scale * 0.7)),
                height: Math.max(2, Math.round(scale * 0.7)),
                background: s.color,
                animationDelay: s.delay,
                "--dx": s.dx,
                "--dy": s.dy,
                opacity: 0,
              } as React.CSSProperties
            }
          />
        ))}
    </div>
  );
}

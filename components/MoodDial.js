"use client";

import { MOODS } from "@/lib/config";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 138;

function posFor(angle) {
  const rad = (angle * Math.PI) / 180;
  return {
    left: `${((CENTER + RADIUS * Math.sin(rad)) / SIZE) * 100}%`,
    top: `${((CENTER - RADIUS * Math.cos(rad)) / SIZE) * 100}%`,
  };
}

export default function MoodDial({ selected, onSelect }) {
  const active = MOODS.find((m) => m.id === selected) || MOODS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div className="mood-dial" role="group" aria-label="Choose a mood">
        <div
          className="clay-pressed"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
          }}
        />

        {MOODS.map((mood) => {
          const { left, top } = posFor(mood.angle);
          const isActive = mood.id === selected;
          return (
            <button
              key={mood.id}
              onClick={() => onSelect(mood.id)}
              className="clay-pebble"
              aria-pressed={isActive}
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, -50%)",
                width: "clamp(68px, 22vw, 84px)",
                height: "clamp(68px, 22vw, 84px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                lineHeight: 1.15,
                padding: 6,
                color: isActive ? "#fff" : "var(--ink)",
                background: isActive ? mood.color : "var(--clay-surface)",
                boxShadow: isActive
                  ? `6px 6px 14px var(--shadow-dark), -6px -6px 14px var(--shadow-light), inset 0 0 0 3px rgba(255,255,255,0.35)`
                  : undefined,
                zIndex: 2,
              }}
            >
              {mood.label}
            </button>
          );
        })}

        <div
          className="clay-raised"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "55%",
            height: "55%",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotate(${active.angle}deg)`,
              transition: "transform 0.4s cubic-bezier(.34,1.4,.64,1)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 18,
                width: 10,
                height: 34,
                borderRadius: 6,
                background: active.color,
                transform: "translateX(-50%)",
              }}
            />
          </div>
          <div
            className="clay-pressed"
            style={{
              width: "55%",
              height: "55%",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            mood
          </div>
        </div>
      </div>

      <p style={{ color: "var(--ink-soft)", margin: 0, fontSize: 14 }}>{active.blurb}</p>
    </div>
  );
}

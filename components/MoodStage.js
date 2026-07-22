"use client";

import { useState } from "react";
import MoodDial from "./MoodDial";
import { MOODS } from "@/lib/config";

export default function MoodStage({ onConfirm }) {
  const [mood, setMood] = useState("feelgood");
  const activeColor = MOODS.find((m) => m.id === mood)?.color || "var(--mood-feelgood)";

  return (
    <div className="stage">
      <div style={{ textAlign: "center" }}>
        <div className="eyebrow">step 2 of 2</div>
        <h1 className="headline" style={{ fontSize: 32, margin: "8px 0 30px" }}>
          Turn the dial to set the mood
        </h1>

        <MoodDial selected={mood} onSelect={setMood} />

        <div
          className="uiv-select-list"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "center",
            marginTop: 26,
          }}
        >
          {MOODS.map((m) => (
            <label key={m.id} className="uiv-select-pill" style={{ "--pill-color": m.color }}>
              <input
                type="checkbox"
                className="uiv-select-checkbox"
                checked={mood === m.id}
                onChange={() => setMood(m.id)}
              />
              {m.label}
            </label>
          ))}
        </div>

        <button
          onClick={() => onConfirm(mood)}
          className="uiv-btn"
          style={{
            marginTop: 34,
            padding: "16px 44px",
            fontSize: 15,
            fontWeight: 700,
            "--uiv-btn-fill": activeColor,
          }}
        >
          Start the radio
        </button>
      </div>
    </div>
  );
}

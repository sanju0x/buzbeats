"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/config";

export default function LanguageStage({ onSelect }) {
  const [checked, setChecked] = useState(null);

  const choose = (id) => {
    setChecked(id);
    onSelect(id);
  };

  return (
    <div className="stage">
      <div style={{ width: "min(560px, 100%)", textAlign: "center" }}>
        <div className="eyebrow">step 1 of 2</div>
        <h1 className="headline" style={{ fontSize: 32, margin: "8px 0 34px" }}>
          What language should the room hear?
        </h1>

        <div
          role="radiogroup"
          aria-label="Radio language"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
          }}
        >
          {LANGUAGES.map((lang) => (
            <label
              key={lang.id}
              className="clay-raised uiv-select-card"
              style={{
                border: "none",
                padding: "22px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="language"
                className="uiv-select-checkbox"
                checked={checked === lang.id}
                onChange={() => choose(lang.id)}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>
                  {lang.native}
                </span>
                <span className="eyebrow" style={{ fontSize: 11 }}>{lang.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

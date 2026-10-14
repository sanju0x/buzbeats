"use client";

import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!localStorage.getItem("buzbeats-cookie-choice"));
  }, []);

  const choose = (choice) => {
    localStorage.setItem("buzbeats-cookie-choice", choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-pop clay-raised" role="dialog" aria-live="polite" aria-label="Cookie notice">
      <div className="cookie-check" aria-hidden="true">✓</div>
      <div>
        <strong>Cookie choices</strong>
        <p>Choose whether to save preferences on this device. You can clear site data to reset this choice.</p>
      </div>
      <div className="cookie-actions">
        <button type="button" onClick={() => choose("declined")} className="cookie-decline">
          Decline
        </button>
        <button type="button" onClick={() => choose("accepted")} className="cookie-accept">
          Accept
        </button>
      </div>
    </div>
  );
}

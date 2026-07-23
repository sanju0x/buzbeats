"use client";

import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="cookie-pop clay-raised" role="dialog" aria-live="polite" aria-label="Cookie notice">
      <div className="cookie-check" aria-hidden="true">✓</div>
      <div>
        <strong>Cookie choices</strong>
        <p>Accept cookies for saved preferences, or decline and we will ask again next time.</p>
      </div>
      <div className="cookie-actions">
        <button type="button" onClick={() => setVisible(false)} className="cookie-decline">
          Decline
        </button>
        <button type="button" onClick={() => setVisible(false)} className="cookie-accept">
          Accept
        </button>
      </div>
    </div>
  );
}

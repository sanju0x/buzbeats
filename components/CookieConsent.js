"use client";

import { useEffect, useState } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem("nook-cookie-ok") !== "yes");
  }, []);

  const accept = () => {
    localStorage.setItem("nook-cookie-ok", "yes");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-pop clay-raised" role="dialog" aria-live="polite" aria-label="Cookie notice">
      <div className="cookie-check" aria-hidden="true">✓</div>
      <div>
        <strong>Cookies make the demo smoother.</strong>
        <p>We use cookies to remember your choices and keep the player experience consistent.</p>
      </div>
      <button type="button" onClick={accept} className="cookie-accept">
        Accept cookies
      </button>
    </div>
  );
}

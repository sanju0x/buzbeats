"use client";

import CookieConsent from "./CookieConsent";
import MiniPlayerPopup from "./MiniPlayerPopup";

export default function AppChrome() {
  return (
    <>
      <MiniPlayerPopup />
      <CookieConsent />
    </>
  );
}

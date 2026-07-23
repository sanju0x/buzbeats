"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import LoginStage from "@/components/LoginStage";
import LanguageStage from "@/components/LanguageStage";
import MoodStage from "@/components/MoodStage";
import PlayerStage from "@/components/PlayerStage";
import CookieConsent from "@/components/CookieConsent";

export default function Home() {
  const { data: session } = useSession();
  const [demo, setDemo] = useState(false);
  const [language, setLanguage] = useState(null);
  const [mood, setMood] = useState(null);
  const [page, setPage] = useState("landing");
  const [demoEndsAt, setDemoEndsAt] = useState(null);
  const [demoSeconds, setDemoSeconds] = useState(60);
  const [miniPlayer, setMiniPlayer] = useState(null);

  const signedIn = !!session || demo;

  useEffect(() => {
    if (session && page === "landing") setPage("language");
  }, [session, page]);

  useEffect(() => {
    if (!demoEndsAt) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((demoEndsAt - Date.now()) / 1000));
      setDemoSeconds(next);
      if (next === 0) {
        setDemo(false);
        setLanguage(null);
        setMood(null);
        setPage("landing");
        setMiniPlayer(null);
        setDemoEndsAt(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [demoEndsAt]);

  const demoBadge = useMemo(() => {
    if (!demo) return null;
    return <div className="demo-timer">Demo ends in {demoSeconds}s</div>;
  }, [demo, demoSeconds]);

  const startDemo = () => {
    setDemo(true);
    setDemoEndsAt(Date.now() + 60000);
    setDemoSeconds(60);
    setPage("language");
  };

  let content;

  if (!signedIn || page === "landing") {
    content = <LoginStage onDemoContinue={startDemo} />;
  } else if (page === "language") {
    content = <LanguageStage onSelect={(id) => { setLanguage(id); setPage("mood"); }} />;
  } else if (page === "mood") {
    content = <MoodStage onConfirm={(id) => { setMood(id); setPage("player"); }} />;
  } else {
    content = (
      <PlayerStage
        language={language}
        mood={mood}
        onBack={(snapshot) => {
          setMiniPlayer(snapshot);
          setPage("mood");
        }}
      />
    );
  }

  return (
    <>
      {content}
      {demoBadge}
      {miniPlayer && page !== "player" && (
        <button className="mini-player-pop" type="button" onClick={() => setPage("player")}>
          <span
            className="mini-art"
            style={{ backgroundImage: miniPlayer.artworkUrl ? `url(${miniPlayer.artworkUrl})` : undefined }}
          />
          <span>
            <strong>{miniPlayer.title || "Radio paused"}</strong>
            <small>{miniPlayer.artist || "Tap to reopen player"}</small>
          </span>
          <span className="mini-pill">Open</span>
        </button>
      )}
      <CookieConsent />
    </>
  );
}

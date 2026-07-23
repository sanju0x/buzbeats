"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [miniPosition, setMiniPosition] = useState({ x: 18, y: 18 });
  const dragRef = useRef(null);

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

  const startMiniDrag = (event) => {
    if (!miniPlayer) return;
    const point = event.touches?.[0] || event;
    dragRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      originX: miniPosition.x,
      originY: miniPosition.y,
      moved: false,
    };
  };

  const moveMiniDrag = (event) => {
    if (!dragRef.current) return;
    const point = event.touches?.[0] || event;
    const nextX = Math.max(8, dragRef.current.originX - (point.clientX - dragRef.current.startX));
    const nextY = Math.max(8, dragRef.current.originY - (point.clientY - dragRef.current.startY));
    if (Math.abs(point.clientX - dragRef.current.startX) > 4 || Math.abs(point.clientY - dragRef.current.startY) > 4) {
      dragRef.current.moved = true;
    }
    setMiniPosition({ x: nextX, y: nextY });
  };

  const endMiniDrag = () => {
    dragRef.current = null;
  };

  const toggleMiniPlayback = () => {
    if (dragRef.current?.moved) return;
    setMiniPlayer((player) => player ? { ...player, isPlaying: !player.isPlaying } : player);
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
          setMiniPlayer({ ...snapshot, isPlaying: false });
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
        <div
          className="mini-player-pop"
          style={{ right: miniPosition.x, bottom: miniPosition.y }}
          onMouseDown={startMiniDrag}
          onMouseMove={moveMiniDrag}
          onMouseUp={endMiniDrag}
          onMouseLeave={endMiniDrag}
          onTouchStart={startMiniDrag}
          onTouchMove={moveMiniDrag}
          onTouchEnd={endMiniDrag}
        >
          <button
            className={`mini-art${miniPlayer.isPlaying ? " is-playing" : ""}`}
            type="button"
            aria-label={miniPlayer.isPlaying ? "Pause preview" : "Play preview"}
            onClick={toggleMiniPlayback}
            style={{ backgroundImage: miniPlayer.artworkUrl ? `url(${miniPlayer.artworkUrl})` : undefined }}
          >
            <span>{miniPlayer.isPlaying ? "Ⅱ" : "▶"}</span>
          </button>
          <button className="mini-open" type="button" onClick={() => setPage("player")}>Open</button>
        </div>
      )}
      <CookieConsent />
    </>
  );
}

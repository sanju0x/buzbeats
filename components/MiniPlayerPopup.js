"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function MiniPlayerPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const audioRef = useRef(null);
  const dragRef = useRef(null);
  const [track, setTrack] = useState(null);
  const [position, setPosition] = useState({ x: 18, y: 18 });
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem("buzbeats-mini-player");
      setTrack(raw ? JSON.parse(raw) : null);
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("buzbeats-mini-player", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("buzbeats-mini-player", load);
    };
  }, [pathname]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.streamUrl) return;
    audio.src = track.streamUrl;
    audio.currentTime = track.currentTime || 0;
    if (track.wasPlaying !== false) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [track]);

  if (!track || pathname === "/player") return null;

  const startDrag = (event) => {
    const point = event.touches?.[0] || event;
    dragRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    const point = event.touches?.[0] || event;
    const deltaX = point.clientX - dragRef.current.startX;
    const deltaY = point.clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) dragRef.current.moved = true;
    setPosition({
      x: Math.max(8, dragRef.current.originX - deltaX),
      y: Math.max(8, dragRef.current.originY - deltaY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const togglePlayback = () => {
    if (dragRef.current?.moved) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className="mini-player-pop"
      style={{ right: position.x, bottom: position.y }}
      onMouseDown={startDrag}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={startDrag}
      onTouchMove={moveDrag}
      onTouchEnd={endDrag}
    >
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        className={`mini-art${isPlaying ? " is-playing" : ""}`}
        type="button"
        aria-label={isPlaying ? "Pause mini player" : "Play mini player"}
        onClick={togglePlayback}
        style={{ backgroundImage: track.artworkUrl ? `url(${track.artworkUrl})` : undefined }}
      >
        <span>{isPlaying ? "Ⅱ" : "▶"}</span>
      </button>
      <button className="mini-open" type="button" onClick={() => router.push("/player")}>Open</button>
    </div>
  );
}

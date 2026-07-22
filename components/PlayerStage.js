"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MOODS, LANGUAGES } from "@/lib/config";
import LoadingStage from "./LoadingStage";

export default function PlayerStage({ language, mood, onBack }) {
  const moodInfo = MOODS.find((m) => m.id === mood) || MOODS[0];
  const languageInfo = LANGUAGES.find((l) => l.id === language) || LANGUAGES[3];

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorDetail, setErrorDetail] = useState(null);
  const [volume, setVolume] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const audioRef = useRef(null);
  const indexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(false);
  const failedTracksRef = useRef(new Set());

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setQueue([]);
    setIndex(0);
    indexRef.current = 0;
    failedTracksRef.current.clear();

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, mood }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        const { tracks, error } = data;

        if (error === "lavalink_not_configured") {
          setQueue(tracks || []);
          setStatus("no-lavalink");
          return;
        }

        if (!tracks?.length) {
          setStatus("error");
          setErrorDetail("No tracks returned from the server.");
          return;
        }

        const playable = tracks.filter((t) => t.streamUrl);
        if (playable.length === 0) {
          setQueue(tracks);
          setStatus("no-lavalink");
          setErrorDetail(error || null);
          return;
        }

        setQueue(playable);
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("error");
          setErrorDetail(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language, mood]);

  const pickNext = useCallback((len, current) => {
    if (shuffleRef.current && len > 1) {
      let next = current;
      while (next === current) next = Math.floor(Math.random() * len);
      return next;
    }
    return (current + 1) % len;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (repeatRef.current) {
        loadTrack(indexRef.current, { autoplay: true });
        return;
      }
      const next = pickNext(queue.length, indexRef.current);
      loadTrack(next, { autoplay: true });
    };
    const onError = () => {
      const failedIndex = indexRef.current;
      failedTracksRef.current.add(failedIndex);
      const message = audio.error?.message || "Failed to load because no supported source was found.";

      if (failedTracksRef.current.size < queue.length) {
        setErrorDetail(`Skipping ${queue[failedIndex]?.title || "track"}: ${message}`);
        loadTrack(pickNext(queue.length, failedIndex), { autoplay: isPlaying });
        return;
      }

      setStatus("error");
      setErrorDetail(`Could not start playback: ${message}`);
    };
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("error", onError);
    };
  }, [queue, pickNext, isPlaying]);

  useEffect(() => {
    if (status === "ready" && queue.length > 0) {
      loadTrack(0, { autoplay: false });
    }
  }, [status]);

  const loadTrack = useCallback(
    (i, { autoplay = true } = {}) => {
      const audio = audioRef.current;
      if (!audio || !queue[i]?.streamUrl) return;
      indexRef.current = i;
      setIndex(i);
      setProgress(0);
      audio.src = queue[i].streamUrl;
      audio.volume = volume;
      audio.load();

      if (autoplay) {
        audio.play().catch((err) => {
          setIsPlaying(false);
          setErrorDetail(`Could not start playback: ${err.message}`);
        });
      }
    },
    [queue, volume]
  );

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      return;
    }

    audio.play().catch((err) => {
      setIsPlaying(false);
      setErrorDetail(`Could not start playback: ${err.message}`);
    });
  };

  const skip = () => {
    const next = pickNext(queue.length, index);
    loadTrack(next, { autoplay: true });
  };

  const prev = () => {
    const p = (index - 1 + queue.length) % queue.length;
    loadTrack(p, { autoplay: true });
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setProgress(0);
    setIsPlaying(false);
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const setVol = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.volume = ratio;
    setVolume(ratio);
  };

  const fmt = (secs) => {
    if (!secs || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const current = queue[index];

  if (status === "loading") {
    return (
      <LoadingStage
        label={`Curating ${moodInfo.label.toLowerCase()} ${languageInfo.label} songs with Grok AI…`}
      />
    );
  }

  if (status === "no-lavalink") {
    return (
      <div className="stage">
        <div className="clay-raised" style={{ width: "min(480px, 100%)", padding: "36px 30px" }}>
          <button onClick={onBack} className="eyebrow" style={{ background: "none", border: "none", padding: "0 0 18px" }}>
            ← back
          </button>
          <p className="eyebrow" style={{ color: "var(--mood-sad)" }}>Lavalink not connected</p>
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 6 }}>
            Set <code>LAVALINK_HOST</code>, <code>LAVALINK_PORT</code>, and{" "}
            <code>LAVALINK_PASSWORD</code> in <code>.env.local</code> and restart the
            dev server. Grok AI still picked these songs for the room:
          </p>
          <ul style={{ color: "var(--ink)", paddingLeft: 18, lineHeight: 2 }}>
            {queue.map((t, i) => (
              <li key={i}>
                <strong>{t.title}</strong> — {t.artist}
              </li>
            ))}
          </ul>
          {errorDetail && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)" }}>
              {errorDetail}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="stage">
        <div className="clay-raised" style={{ width: "min(420px, 100%)", padding: "36px 30px", textAlign: "center" }}>
          <p style={{ color: "var(--ink-soft)" }}>Something went wrong loading the queue.</p>
          {errorDetail && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{errorDetail}</p>
          )}
          <button onClick={onBack} className="clay-pebble" style={{ marginTop: 20, padding: "12px 28px" }}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div
      className="stage"
      style={{
        background: `radial-gradient(circle at 50% 0%, ${moodInfo.color}22, var(--clay-bg) 60%)`,
      }}
    >
      <audio ref={audioRef} preload="auto" />

      <div style={{ width: "min(420px, 100%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <button
            onClick={onBack}
            className="eyebrow"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            ← change
          </button>
          <span className="eyebrow">
            {languageInfo.label} · {moodInfo.label}
          </span>
        </div>

        {/* Uiverse.io Spotify-style mini player card, by Angek-Dev */}
        <div className="uiv-card">
          <div className="uiv-top">
            <div className="uiv-pfp" style={{
              backgroundImage: current?.artworkUrl ? `url(${current.artworkUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}>
              <div className={`uiv-playing${isPlaying ? " is-active" : ""}`}>
                <div className="uiv-greenline uiv-line-1" />
                <div className="uiv-greenline uiv-line-2" />
                <div className="uiv-greenline uiv-line-3" />
                <div className="uiv-greenline uiv-line-4" />
                <div className="uiv-greenline uiv-line-5" />
              </div>
            </div>
            <div className="uiv-texts">
              <p className="uiv-title-1">{current?.title || "—"}</p>
              <p className="uiv-title-2">{current?.artist || ""}</p>
            </div>
          </div>

          <div className="uiv-controls">
            <div className="uiv-volume-wrap">
              <svg className="uiv-volume-button" width="22" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.26 3.691A1.2 1.2 0 0 1 12 4.8v14.4a1.199 1.199 0 0 1-2.048.848L5.503 15.6H2.4a1.2 1.2 0 0 1-1.2-1.2V9.6a1.2 1.2 0 0 1 1.2-1.2h3.103l4.449-4.448a1.2 1.2 0 0 1 1.308-.26Zm6.328-.176a1.2 1.2 0 0 1 1.697 0A11.967 11.967 0 0 1 22.8 12a11.966 11.966 0 0 1-3.515 8.485 1.2 1.2 0 0 1-1.697-1.697A9.563 9.563 0 0 0 20.4 12a9.565 9.565 0 0 0-2.812-6.788 1.2 1.2 0 0 1 0-1.697Zm-3.394 3.393a1.2 1.2 0 0 1 1.698 0A7.178 7.178 0 0 1 18 12a7.18 7.18 0 0 1-2.108 5.092 1.2 1.2 0 1 1-1.698-1.698A4.782 4.782 0 0 0 15.6 12a4.78 4.78 0 0 0-1.406-3.394 1.2 1.2 0 0 1 0-1.698Z" />
              </svg>
              <div className="uiv-volume" onClick={setVol}>
                <div className="uiv-slider">
                  <div className="uiv-green" style={{ width: `${volume * 100}%` }} />
                </div>
                <div className="uiv-circle" style={{ left: `calc(${volume * 100}% - 3px)` }} />
              </div>
            </div>

            <button onClick={prev} className="uiv-icon-btn" title="Previous" style={{ background: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.1094 4.20444C4.78029 3.31836 3 4.27115 3 5.86854V18.1315C3 19.7289 4.78029 20.6817 6.1094 19.7956L15.3066 13.6641C16.4941 12.8725 16.4941 11.1276 15.3066 10.3359L6.1094 4.20444ZM5 5.86854L14.1972 12L5 18.1315V5.86854Z" />
                <path d="M21 5C21 4.44772 20.5523 4 20 4C19.4477 4 19 4.44772 19 5V19C19 19.5523 19.4477 20 20 20C20.5523 20 21 19.5523 21 19V5Z" />
              </svg>
            </button>

            <button onClick={togglePlay} className="uiv-icon-btn uiv-play" title={isPlaying ? "Pause" : "Play"} style={{ background: "none" }}>
              {isPlaying ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg width="30" height="30" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M21.6 12a9.6 9.6 0 1 1-19.2 0 9.6 9.6 0 0 1 19.2 0ZM8.4 9.6a1.2 1.2 0 1 1 2.4 0v4.8a1.2 1.2 0 1 1-2.4 0V9.6Zm6-1.2a1.2 1.2 0 0 0-1.2 1.2v4.8a1.2 1.2 0 1 0 2.4 0V9.6a1.2 1.2 0 0 0-1.2-1.2Z" />
                </svg>
              )}
            </button>

            <button onClick={skip} className="uiv-icon-btn" title="Skip" style={{ background: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M17.8906 4.20444C19.2197 3.31836 21 4.27115 21 5.86854V18.1315C21 19.7289 19.2197 20.6817 17.8906 19.7956L8.69337 13.6641C7.50591 12.8725 7.50591 11.1276 8.69337 10.3359L17.8906 4.20444ZM19 5.86854L9.80277 12L19 18.1315V5.86854Z" />
                <path d="M5 5C5 4.44772 4.55228 4 4 4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20C4.55228 20 5 19.5523 5 19V5Z" />
              </svg>
            </button>

            <button onClick={stop} className="uiv-icon-btn" title="Stop" style={{ background: "none" }}>
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          </div>

          <div className="uiv-time" onClick={seek}>
            <div className="uiv-elapsed" style={{ width: `${pct}%` }} />
          </div>
          <p className="uiv-timetext uiv-time_now">{fmt(progress)}</p>
          <p className="uiv-timetext uiv-time_full">{fmt(duration)}</p>
        </div>

        {/* Uiverse.io checkbox styling by cbolson, wired to real shuffle/repeat */}
        {errorDetail && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", textAlign: "center", margin: 0 }}>
            {errorDetail}
          </p>
        )}

        <div className="uiv-checkbox-group">
          <label>
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            Shuffle
          </label>
          <label>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Repeat
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {queue.map((t, i) => (
            <button
              key={i}
              onClick={() => loadTrack(i)}
              style={{
                border: "none",
                borderRadius: 99,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: i === index ? 700 : 400,
                background: i === index ? moodInfo.color : "var(--clay-surface-2)",
                color: i === index ? "#fff" : "var(--ink-soft)",
                cursor: "pointer",
                boxShadow: i === index
                  ? `3px 3px 8px var(--shadow-dark), -3px -3px 8px var(--shadow-light)`
                  : "none",
                transition: "all 0.15s ease",
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .uiv-card {
          position: relative;
          width: 280px;
          height: 140px;
          background: #151515;
          border-radius: 10px;
          padding: 10px;
          box-shadow: 8px 8px 18px var(--shadow-dark);
        }
        .uiv-top {
          position: relative;
          width: 100%;
          display: flex;
          gap: 10px;
        }
        .uiv-pfp {
          position: relative;
          top: 5px;
          left: 5px;
          height: 40px;
          width: 40px;
          background-color: #ffffff;
          border-radius: 5px;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
        }
        .uiv-title-1 {
          color: white;
          font-size: 18px;
          font-weight: normal;
          margin: 0 0 0 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .uiv-title-2 {
          color: lightgrey;
          font-size: 12px;
          font-weight: lighter;
          margin: 2px 0 0 5px;
        }
        .uiv-time {
          width: 90%;
          background-color: #5e5e5e;
          height: 6px;
          border-radius: 3px;
          position: absolute;
          left: 5%;
          bottom: 24px;
          cursor: pointer;
        }
        .uiv-elapsed {
          background-color: #1db954;
          height: 100%;
          border-radius: 3px;
        }
        .uiv-controls {
          gap: 6px;
          align-items: center;
          color: #ffffff;
          display: flex;
          position: absolute;
          bottom: 35px;
          left: 0;
          width: 100%;
          justify-content: center;
        }
        .uiv-icon-btn {
          border: none;
          padding: 0;
          color: inherit;
          display: flex;
          cursor: pointer;
          transition: 0.1s;
        }
        .uiv-icon-btn:hover {
          color: #23da63;
        }
        .uiv-volume-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .uiv-volume {
          height: 100%;
          width: 42px;
          margin-left: 6px;
          position: relative;
          cursor: pointer;
        }
        .uiv-volume .uiv-slider {
          height: 4px;
          background-color: #5e5e5e;
          width: 100%;
          border-radius: 2px;
        }
        .uiv-volume .uiv-green {
          background-color: #1db954;
          height: 100%;
          border-radius: 3px;
        }
        .uiv-volume .uiv-circle {
          background-color: white;
          height: 6px;
          width: 6px;
          border-radius: 3px;
          position: absolute;
          top: -1px;
        }
        .uiv-timetext {
          color: white;
          font-size: 8px;
          position: absolute;
          margin: 0;
        }
        .uiv-time_now {
          bottom: 10px;
          left: 15px;
        }
        .uiv-time_full {
          bottom: 10px;
          right: 15px;
        }
        .uiv-playing {
          display: flex;
          position: relative;
          justify-content: center;
          gap: 1px;
          width: 30px;
          height: 20px;
        }
        .uiv-greenline {
          background-color: #1db954;
          height: 20px;
          width: 2px;
          position: relative;
          transform-origin: bottom;
          transform: scaleY(0.1);
        }
        .uiv-playing.is-active .uiv-line-1 { animation: uiv_playing_kf 1s infinite ease-in-out; animation-delay: 0.2s; }
        .uiv-playing.is-active .uiv-line-2 { animation: uiv_playing_kf 1s infinite ease-in-out; animation-delay: 0.5s; }
        .uiv-playing.is-active .uiv-line-3 { animation: uiv_playing_kf 1s infinite ease-in-out; animation-delay: 0.6s; }
        .uiv-playing.is-active .uiv-line-4 { animation: uiv_playing_kf 1s infinite ease-in-out; animation-delay: 0s; }
        .uiv-playing.is-active .uiv-line-5 { animation: uiv_playing_kf 1s infinite ease-in-out; animation-delay: 0.4s; }
        @keyframes uiv_playing_kf {
          0% { transform: scaleY(0.1); }
          33% { transform: scaleY(0.6); }
          66% { transform: scaleY(0.9); }
          100% { transform: scaleY(0.1); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MOODS, LANGUAGES } from "@/lib/config";
import LoadingStage from "./LoadingStage";
import { YT_MUSIC_PLAYLISTS } from "@/lib/ytMusicPlaylists";

export default function PlayerStage({ language, mood, onBack }) {
  const moodInfo = MOODS.find((m) => m.id === mood) || MOODS[0];
  const languageInfo = LANGUAGES.find((l) => l.id === language) || LANGUAGES[3];

  const [mixId, setMixId] = useState("auto");
  const [collection, setCollection] = useState(null);
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
  const [isRefilling, setIsRefilling] = useState(false);

  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const indexRef = useRef(0);
  const cursorRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(false);
  const volumeRef = useRef(1);
  const failedTracksRef = useRef(new Set());
  const refillPromiseRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const fetchBatch = useCallback(async ({ cursor, seed, exclude, signal }) => {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, mood, playlistId: mixId, cursor, seed, exclude }),
      signal,
    });
    const data = await response.json();
    if (!response.ok || !data.tracks?.length) {
      throw new Error(data.message || data.error || "YouTube Music returned no songs.");
    }
    return data;
  }, [language, mood, mixId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    audioRef.current?.pause();
    failedTracksRef.current.clear();
    setErrorDetail(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setStatus("loading");
    setQueue([]);
    queueRef.current = [];
    setIndex(0);
    indexRef.current = 0;
    cursorRef.current = 0;

    fetchBatch({ cursor: 0, exclude: [], signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        const playable = data.tracks.filter((track) => track.streamUrl);
        queueRef.current = playable;
        setQueue(playable);
        setCollection(data.collection || null);
        cursorRef.current = data.nextCursor || 1;
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
      controller.abort();
      audioRef.current?.pause();
    };
  }, [fetchBatch]);

  const refillQueue = useCallback((seed) => {
    if (refillPromiseRef.current) return refillPromiseRef.current;
    setIsRefilling(true);
    const existing = queueRef.current;
    const exclude = existing.map((track) => track.id || `${track.title}::${track.artist || ""}`);
    const promise = fetchBatch({ cursor: cursorRef.current, seed, exclude })
      .then((data) => {
        const known = new Set(queueRef.current.map((track) => track.id));
        const additions = data.tracks.filter((track) => track.streamUrl && !known.has(track.id));
        if (additions.length) {
          queueRef.current = [...queueRef.current, ...additions];
          if (mountedRef.current) setQueue(queueRef.current);
        }
        cursorRef.current = data.nextCursor || cursorRef.current + 1;
        return additions;
      })
      .catch((error) => {
        if (mountedRef.current) setErrorDetail(`Could not extend the queue: ${error.message}`);
        return [];
      })
      .finally(() => {
        refillPromiseRef.current = null;
        if (mountedRef.current) setIsRefilling(false);
      });
    refillPromiseRef.current = promise;
    return promise;
  }, [fetchBatch]);

  const loadTrack = useCallback(
    (i) => {
      const audio = audioRef.current;
      const track = queueRef.current[i];
      if (!audio || !track?.streamUrl) return;
      indexRef.current = i;
      setIndex(i);
      setProgress(0);
      audio.src = track.streamUrl;
      audio.volume = volumeRef.current;
      audio.load();
      audio.play().catch((err) => {
        const message = err?.name === "NotAllowedError"
          ? "Your browser blocked autoplay. Press play once to start the mix."
          : `Could not start playback: ${err.message}`;
        setErrorDetail(message);
      });
    },
    []
  );

  const advance = useCallback(async () => {
    if (repeatRef.current) {
      loadTrack(indexRef.current);
      return;
    }

    const currentIndex = indexRef.current;
    if (shuffleRef.current && queueRef.current.length > 1) {
      let next = currentIndex;
      while (next === currentIndex) next = Math.floor(Math.random() * queueRef.current.length);
      loadTrack(next);
      return;
    }

    let next = currentIndex + 1;
    if (next >= queueRef.current.length) {
      await refillQueue(queueRef.current[currentIndex]?.id);
    }
    if (next < queueRef.current.length) loadTrack(next);
    else {
      audioRef.current?.pause();
      setErrorDetail("No new YouTube Music recommendations are available yet. Press next to retry.");
    }
  }, [loadTrack, refillQueue]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPlaying = () => {
      failedTracksRef.current.clear();
      setErrorDetail(null);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => void advance();
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onError = () => {
      const code = audio.error?.code;
      setErrorDetail(
        `Playback failed for "${queueRef.current[indexRef.current]?.title || "track"}" (media error ${code || "unknown"})`
      );
      failedTracksRef.current.add(indexRef.current);
      const next = queueRef.current.findIndex((_, i) => i > indexRef.current && !failedTracksRef.current.has(i));
      if (next !== -1) loadTrack(next);
      else void advance();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("error", onError);
    };
  }, [advance, loadTrack]);

  useEffect(() => {
    if (status === "ready" && queue.length > 0) {
      loadTrack(0);
    }
  }, [status, loadTrack]);

  useEffect(() => {
    if (status === "ready" && queue.length - index <= 6) {
      void refillQueue(queue[index]?.id);
    }
  }, [index, queue, status, refillQueue]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => setErrorDetail("Press play to allow audio in your browser."));
  };

  const skip = () => {
    void advance();
  };

  const prev = () => {
    const p = Math.max(0, index - 1);
    loadTrack(p);
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
    audio.currentTime = Number(e.target.value);
  };

  const setVol = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const ratio = Number(e.target.value);
    audio.volume = ratio;
    volumeRef.current = ratio;
    setVolume(ratio);
  };

  const fmt = (secs) => {
    if (!secs || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const current = queue[index];
  const nextQueue = queue.slice(index + 1);
  const handleBack = () => {
    const audio = audioRef.current;
    const wasPlaying = !!audio && !audio.paused;
    const currentTime = audio?.currentTime || 0;
    audio?.pause();
    onBack?.({
      title: current?.title,
      artist: current?.artist,
      artworkUrl: current?.artworkUrl,
      streamUrl: current?.streamUrl,
      currentTime,
      wasPlaying,
      language,
      mood,
    });
  };

  const selector = (
    <label style={{ display: "grid", gap: 8, width: "100%", marginBottom: 16 }}>
      <span className="eyebrow">YouTube Music playlist</span>
      <select
        aria-label="YouTube Music playlist"
        value={mixId}
        onChange={(event) => setMixId(event.target.value)}
        className="clay-pebble"
        style={{ padding: 12, width: "100%", color: "var(--ink)", background: "var(--clay-surface-2)" }}
      >
        {YT_MUSIC_PLAYLISTS.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
        ))}
      </select>
    </label>
  );

  if (status === "loading") {
    return (
      <LoadingStage
        label="Building your YouTube Music mix…"
      />
    );
  }

  if (status === "unplayable") {
    return (
      <div className="stage">
        <div className="clay-raised" style={{ width: "min(480px, 100%)", padding: "36px 30px" }}>
          <button onClick={handleBack} className="eyebrow" style={{ background: "none", border: "none", padding: "0 0 18px" }}>
            ← back
          </button>
          <p className="eyebrow" style={{ color: "var(--mood-sad)" }}>No playable streams</p>
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 6 }}>
            NodeLink did not return playable tracks:
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
          {selector}
          <p style={{ color: "var(--ink-soft)" }}>Could not build this YouTube Music mix.</p>
          {errorDetail && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{errorDetail}</p>
          )}
          <button onClick={handleBack} className="clay-pebble" style={{ marginTop: 20, padding: "12px 28px" }}>
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

      <main className="player-shell">
        <div className="player-header">
          <button
            onClick={handleBack}
            className="eyebrow player-back"
          >
            <span aria-hidden="true">←</span> Change mood
          </button>
          <span className="eyebrow player-station-name">
            {collection?.name || `${languageInfo.label} · YouTube Music`}
          </span>
        </div>

        {selector}
        <section className="uiv-card" aria-label="Now playing">
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
              <span className="live-label"><i />{isPlaying ? "On air" : "Paused"}</span>
              <p className="uiv-title-1">{current?.title || "—"}</p>
              <p className="uiv-title-2">{current?.artist || ""}</p>
            </div>
          </div>

          <div className="uiv-controls">
            <button onClick={prev} className="uiv-icon-btn" aria-label="Previous track">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.1094 4.20444C4.78029 3.31836 3 4.27115 3 5.86854V18.1315C3 19.7289 4.78029 20.6817 6.1094 19.7956L15.3066 13.6641C16.4941 12.8725 16.4941 11.1276 15.3066 10.3359L6.1094 4.20444ZM5 5.86854L14.1972 12L5 18.1315V5.86854Z" />
                <path d="M21 5C21 4.44772 20.5523 4 20 4C19.4477 4 19 4.44772 19 5V19C19 19.5523 19.4477 20 20 20C20.5523 20 21 19.5523 21 19V5Z" />
              </svg>
            </button>

            <button onClick={togglePlay} className="uiv-icon-btn uiv-play" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg width="30" height="30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5.6v12.8c0 .8.9 1.3 1.6.8l9-6.4a1 1 0 0 0 0-1.6l-9-6.4A1 1 0 0 0 8 5.6Z" />
                </svg>
              )}
            </button>

            <button onClick={skip} className="uiv-icon-btn" aria-label="Next track">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M17.8906 4.20444C19.2197 3.31836 21 4.27115 21 5.86854V18.1315C21 19.7289 19.2197 20.6817 17.8906 19.7956L8.69337 13.6641C7.50591 12.8725 7.50591 11.1276 8.69337 10.3359L17.8906 4.20444ZM19 5.86854L9.80277 12L19 18.1315V5.86854Z" />
                <path d="M5 5C5 4.44772 4.55228 4 4 4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20C4.55228 20 5 19.5523 5 19V5Z" />
              </svg>
            </button>

            <button onClick={stop} className="uiv-icon-btn" aria-label="Stop playback">
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          </div>

          <div className="player-progress-row">
            <span>{fmt(progress)}</span>
            <input className="player-range" type="range" min="0" max={duration || 0} step="1" value={Math.min(progress, duration || 0)} onChange={seek} aria-label="Track position" style={{ "--range-progress": `${pct}%` }} />
            <span>{fmt(duration)}</span>
          </div>
          <label className="volume-row">
            <span>Volume</span>
            <input className="player-range" type="range" min="0" max="1" step="0.01" value={volume} onChange={setVol} aria-label="Volume" style={{ "--range-progress": `${volume * 100}%` }} />
            <output>{Math.round(volume * 100)}%</output>
          </label>
        </section>

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

        {errorDetail && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--mood-sad)", textAlign: "center" }}>
            {errorDetail}
          </p>
        )}

        <section className="queue-panel clay-raised" aria-label="Upcoming queue">
          <div className="queue-heading">
            <span className="eyebrow">Up next</span>
            <span>{isRefilling ? "Finding more…" : `${nextQueue.length} songs queued`}</span>
          </div>
          <div className="queue-list">
            {nextQueue.slice(0, 6).map((t, offset) => {
              const realIndex = index + offset + 1;
              return (
                <button key={`${t.id || t.title}-${offset}`} className="queue-row" type="button" onClick={() => loadTrack(realIndex)}>
                  <span
                    className="queue-thumb"
                    style={{ backgroundImage: t.artworkUrl ? `url(${t.artworkUrl})` : undefined }}
                  />
                  <span className="queue-copy">
                    <strong>{t.title}</strong>
                    <small>{t.artist}</small>
                  </span>
                  <span className="queue-number">#{offset + 1}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <style jsx>{`
        .player-shell {
          width: min(560px, 100%);
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 20px;
        }
        .player-header {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .player-back {
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.28);
        }
        .player-back:focus-visible {
          outline: 3px solid ${moodInfo.color};
          outline-offset: 3px;
        }
        .player-station-name {
          max-width: 55%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
        }
        .uiv-card {
          position: relative;
          width: 100%;
          min-height: 340px;
          overflow: hidden;
          background: linear-gradient(145deg, #20201f, #101010);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 30px;
          padding: 26px;
          box-shadow: 14px 18px 38px rgba(45, 35, 32, 0.34), inset 0 1px rgba(255,255,255,.08);
        }
        .uiv-top {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .uiv-pfp {
          position: relative;
          height: 112px;
          width: 112px;
          background: linear-gradient(135deg, ${moodInfo.color}, #353535);
          border-radius: 24px;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
          box-shadow: 0 16px 32px rgba(0,0,0,.36);
        }
        .uiv-texts {
          min-width: 0;
        }
        .live-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 10px 5px;
          color: #b8b8b8;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .live-label i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${isPlaying ? "#4fe083" : "#8a8a8a"};
          box-shadow: ${isPlaying ? "0 0 0 4px rgba(79,224,131,.14)" : "none"};
        }
        .uiv-title-1 {
          color: white;
          font-family: var(--font-display);
          font-size: clamp(22px, 5vw, 30px);
          font-weight: 600;
          margin: 0 0 0 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .uiv-title-2 {
          color: #b8b8b8;
          font-size: 14px;
          margin: 6px 0 0 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
          gap: 12px;
          align-items: center;
          color: #ffffff;
          display: flex;
          margin: 28px 0 22px;
          width: 100%;
          justify-content: center;
        }
        .uiv-icon-btn {
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 50%;
          padding: 0;
          background: rgba(255,255,255,.06);
          color: inherit;
          display: flex;
          cursor: pointer;
          transition: color 180ms ease, background 180ms ease, transform 180ms ease;
        }
        .uiv-icon-btn:hover {
          color: ${moodInfo.color};
          background: rgba(255,255,255,.12);
        }
        .uiv-icon-btn:active { transform: scale(.94); }
        .uiv-icon-btn:focus-visible { outline: 3px solid ${moodInfo.color}; outline-offset: 3px; }
        .uiv-play {
          width: 62px;
          height: 62px;
          color: #151515;
          background: ${moodInfo.color};
          border: 0;
        }
        .uiv-play:hover {
          color: #151515;
          background: ${moodInfo.color};
          filter: brightness(1.08);
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
        .queue-panel {
          width: 100%;
          padding: 18px;
        }
        .queue-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--ink-soft);
          font-size: 12px;
          margin-bottom: 12px;
        }
        .queue-list {
          display: grid;
          gap: 10px;
          max-height: 270px;
          overflow: auto;
          padding-right: 4px;
        }
        .queue-row {
          border: 0;
          border-radius: 18px;
          background: var(--clay-surface-2);
          display: grid;
          grid-template-columns: 48px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 10px;
          text-align: left;
          color: var(--ink);
          min-height: 68px;
          transition: background 180ms ease, transform 180ms ease;
        }
        .queue-row:hover { background: var(--clay-surface); }
        .queue-row:active { transform: scale(.985); }
        .queue-row:focus-visible { outline: 3px solid ${moodInfo.color}; outline-offset: 2px; }
        }
        .queue-thumb {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, ${moodInfo.color}, #151515);
          background-size: cover;
          background-position: center;
        }
        .queue-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .queue-copy strong,
        .queue-copy small {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .queue-copy small,
        .queue-number {
          color: var(--ink-soft);
          font-size: 12px;
        }
        @keyframes uiv_playing_kf {
          0% { transform: scaleY(0.1); }
          33% { transform: scaleY(0.6); }
          66% { transform: scaleY(0.9); }
          100% { transform: scaleY(0.1); }
        }
        .player-progress-row,
        .volume-row {
          display: grid;
          grid-template-columns: 40px 1fr 40px;
          align-items: center;
          gap: 10px;
          color: #a9a9a9;
          font-family: var(--font-mono);
          font-size: 10px;
          font-variant-numeric: tabular-nums;
        }
        .player-progress-row span:last-child,
        .volume-row output { text-align: right; }
        .volume-row { margin-top: 18px; }
        .volume-row > span { text-transform: uppercase; letter-spacing: .08em; }
        .player-range {
          width: 100%;
          height: 28px;
          margin: 0;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .player-range::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(to right, ${moodInfo.color} var(--range-progress), #505050 var(--range-progress));
        }
        .player-range::-webkit-slider-thumb {
          width: 16px;
          height: 16px;
          margin-top: -5.5px;
          appearance: none;
          border: 3px solid #fff;
          border-radius: 50%;
          background: ${moodInfo.color};
          box-shadow: 0 2px 8px rgba(0,0,0,.4);
        }
        .player-range:focus-visible { outline: 2px solid ${moodInfo.color}; outline-offset: 3px; border-radius: 8px; }
        @media (max-width: 520px) {
          .uiv-card { padding: 20px; min-height: 325px; border-radius: 24px; }
          .uiv-pfp { width: 86px; height: 86px; border-radius: 20px; }
          .uiv-controls { gap: 7px; }
          .uiv-icon-btn { width: 44px; height: 44px; }
          .uiv-play { width: 58px; height: 58px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .uiv-greenline { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

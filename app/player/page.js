"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DemoTimer from "@/components/DemoTimer";
import PlayerStage from "@/components/PlayerStage";

export default function PlayerPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState({ language: "english", mood: "feelgood" });

  useEffect(() => {
    setPrefs({
      language: localStorage.getItem("buzbeats-language") || "english",
      mood: localStorage.getItem("buzbeats-mood") || "feelgood",
    });
  }, []);

  return (
    <>
      <PlayerStage
        language={prefs.language}
        mood={prefs.mood}
        onBack={(snapshot) => {
          localStorage.setItem("buzbeats-mini-player", JSON.stringify(snapshot));
          window.dispatchEvent(new Event("buzbeats-mini-player"));
          router.push("/mood");
        }}
      />
      <DemoTimer />
    </>
  );
}

"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import LoginStage from "@/components/LoginStage";
import LanguageStage from "@/components/LanguageStage";
import MoodStage from "@/components/MoodStage";
import PlayerStage from "@/components/PlayerStage";

export default function Home() {
  const { data: session } = useSession();
  const [demo, setDemo] = useState(false);
  const [language, setLanguage] = useState(null);
  const [mood, setMood] = useState(null);

  const signedIn = !!session || demo;

  if (!signedIn) {
    return <LoginStage onDemoContinue={() => setDemo(true)} />;
  }

  if (!language) {
    return <LanguageStage onSelect={setLanguage} />;
  }

  if (!mood) {
    return <MoodStage onConfirm={setMood} />;
  }

  return (
    <PlayerStage
      language={language}
      mood={mood}
      onBack={() => {
        setLanguage(null);
        setMood(null);
      }}
    />
  );
}

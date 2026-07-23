"use client";

import { useRouter } from "next/navigation";
import DemoTimer from "@/components/DemoTimer";
import MoodStage from "@/components/MoodStage";

export default function MoodPage() {
  const router = useRouter();

  return (
    <>
      <MoodStage
        onConfirm={(mood) => {
          localStorage.setItem("buzbeats-mood", mood);
          router.push("/player");
        }}
      />
      <DemoTimer />
    </>
  );
}

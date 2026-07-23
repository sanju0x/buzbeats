"use client";

import { useRouter } from "next/navigation";
import DemoTimer from "@/components/DemoTimer";
import LanguageStage from "@/components/LanguageStage";

export default function LanguagePage() {
  const router = useRouter();

  return (
    <>
      <LanguageStage
        onSelect={(language) => {
          localStorage.setItem("buzbeats-language", language);
          router.push("/mood");
        }}
      />
      <DemoTimer />
    </>
  );
}

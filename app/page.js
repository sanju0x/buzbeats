"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import LoginStage from "@/components/LoginStage";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session) router.replace("/language");
  }, [router, session]);

  const startDemo = () => {
    localStorage.setItem("buzbeats-demo-ends-at", String(Date.now() + 60000));
    router.push("/language");
  };

  return <LoginStage onDemoContinue={startDemo} />;
}

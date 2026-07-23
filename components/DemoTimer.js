"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DemoTimer() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    const tick = () => {
      const endsAt = Number(localStorage.getItem("buzbeats-demo-ends-at") || 0);
      if (!endsAt) {
        setSeconds(null);
        return;
      }
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSeconds(next);
      if (next === 0) {
        localStorage.removeItem("buzbeats-demo-ends-at");
        localStorage.removeItem("buzbeats-mini-player");
        router.replace("/");
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [router]);

  if (seconds === null) return null;

  return <div className="demo-timer">Demo ends in {seconds}s</div>;
}

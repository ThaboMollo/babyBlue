"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "exiting" | "gone">("visible");

  useEffect(() => {
    const exit = setTimeout(() => setPhase("exiting"), 2000);
    const gone = setTimeout(() => setPhase("gone"), 2450);
    return () => {
      clearTimeout(exit);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`splash-overlay${phase === "exiting" ? " splash-exiting" : ""}`}>
      {/* Sonar ripple rings */}
      <div className="splash-ripple splash-ripple-1" />
      <div className="splash-ripple splash-ripple-2" />
      <div className="splash-ripple splash-ripple-3" />

      {/* Shield icon — spring in then heartbeat */}
      <div className="splash-icon-pulse" style={{ marginBottom: "28px" }}>
        <Image
          src="/BabyBlue_icon.png"
          alt="BabyBlue"
          width={96}
          height={96}
          priority
          style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.35))" }}
        />
      </div>

      {/* Wordmark */}
      <div className="splash-wordmark" style={{ textAlign: "center" }}>
        <p style={{
          color: "#ffffff",
          fontSize: "26px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}>
          Clinic<span style={{ color: "#20C997" }}>OS</span>
        </p>
      </div>

      {/* Subtitle */}
      <div className="splash-subtitle" style={{ textAlign: "center", marginTop: "6px" }}>
        <p style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          Admin Portal
        </p>
      </div>

      {/* Progress bar */}
      <div className="splash-progress-track">
        <div className="splash-progress-bar" />
      </div>
    </div>
  );
}

import Image from "next/image";

interface Props {
  size?: number;
  label?: string;
}

export default function AppLoader({ size = 48, label }: Props) {
  const ring = size + 20;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
      }}
    >
      <div style={{ position: "relative", width: ring, height: ring }}>
        {/* Spinning arc ring */}
        <svg
          className="app-loader-ring"
          width={ring}
          height={ring}
          viewBox={`0 0 ${ring} ${ring}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={(ring - 4) / 2}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="3"
          />
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={(ring - 4) / 2}
            fill="none"
            stroke="#0B5AA8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * (ring - 4) * 0.28} ${Math.PI * (ring - 4) * 0.72}`}
            strokeDashoffset="0"
          />
        </svg>

        {/* Shield icon centered inside ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/BabyBlue_icon.png"
            alt="Loading"
            width={size}
            height={size}
            style={{ opacity: 0.9 }}
          />
        </div>
      </div>

      {label && (
        <p style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>{label}</p>
      )}
    </div>
  );
}

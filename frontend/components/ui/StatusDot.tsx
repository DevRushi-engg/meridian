import React from "react";

interface StatusDotProps {
  color?: "red" | "green" | "amber" | "blue" | "zinc";
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}

export function StatusDot({
  color = "green",
  pulse = true,
  size = "md",
}: StatusDotProps) {
  const sizeMap = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  const colorMap = {
    red: "bg-[#e61919]",
    green: "bg-[#22c55e]",
    amber: "bg-[#f59e0b]",
    blue: "bg-[#3b82f6]",
    zinc: "bg-[#71717a]",
  };

  const pulseClass =
    pulse && color === "red"
      ? "beacon-hazard"
      : pulse && color === "green"
      ? "beacon-green"
      : pulse
      ? "animate-ping"
      : "";

  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={`inline-block ${sizeMap[size]} ${colorMap[color]} ${pulseClass}`} />
    </span>
  );
}

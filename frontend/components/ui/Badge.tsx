import React from "react";
import { RiskLevel } from "@/lib/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "risk" | "action" | "status" | "mono";
  risk?: RiskLevel;
  status?: string;
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "risk",
  risk,
  status,
  size = "sm",
}: BadgeProps) {
  let colorClasses = "bg-[#1f1f23] text-[#a1a1aa] border-white/10";

  if (variant === "risk" && risk) {
    switch (risk) {
      case "CRITICAL":
        colorClasses = "bg-[#e61919]/15 text-[#ff4d4d] border-[#e61919]/40";
        break;
      case "HIGH":
        colorClasses = "bg-[#f97316]/15 text-[#fb923c] border-[#f97316]/40";
        break;
      case "MEDIUM":
        colorClasses = "bg-[#f59e0b]/15 text-[#fcd34d] border-[#f59e0b]/40";
        break;
      case "LOW":
        colorClasses = "bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/40";
        break;
    }
  } else if (status) {
    switch (status.toUpperCase()) {
      case "SUCCESS":
      case "COMPLETED":
        colorClasses = "bg-[#22c55e]/15 text-[#4ade80] border-[#22c55e]/40";
        break;
      case "FAILED":
      case "UNSAFE":
        colorClasses = "bg-[#e61919]/15 text-[#ff4d4d] border-[#e61919]/40";
        break;
      case "RUNNING":
        colorClasses = "bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/40 animate-pulse";
        break;
      case "NO_DRIFT":
        colorClasses = "bg-[#10b981]/15 text-[#34d399] border-[#10b981]/40";
        break;
    }
  }

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-2 py-0.5"
      : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.1em] font-medium border ${sizeClasses} ${colorClasses} select-none`}
      style={{ borderRadius: "0px" }}
    >
      {children}
    </span>
  );
}

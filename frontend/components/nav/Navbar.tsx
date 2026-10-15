"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusDot } from "../ui/StatusDot";
import { Activity, ShieldAlert, Cpu, Terminal, Sliders, ExternalLink } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [utcTime, setUtcTime] = useState("");
  const [apiConnected, setApiConnected] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch("http://localhost:8000/health", { method: "GET" });
        setApiConnected(res.ok);
      } catch {
        setApiConnected(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 10000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { href: "/", label: "MISSION CONTROL", icon: Activity },
    { href: "/pipeline", label: "PIPELINE RUNNER", icon: Terminal },
    { href: "/reports", label: "DRIFT DEBRIEFS", icon: ShieldAlert },
    { href: "/settings", label: "CONFIG & POLICIES", icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-md">
      {/* Top telemetry ticker */}
      <div className="flex h-7 items-center justify-between px-4 border-b border-white/[0.04] text-[10px] font-mono tracking-[0.15em] text-[#71717a] bg-[#070707]">
        <div className="flex items-center gap-3">
          <span className="text-[#a1a1aa] flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 bg-[#e61919]" />
            SYS: IAC-SENTINAL-01
          </span>
          <span className="hidden sm:inline">LOC: LAT 37.77 / LON -122.41</span>
          <span className="hidden md:inline text-white/30">|</span>
          <span className="hidden md:inline">IAC_ENGINE: TERRAFORM v1.7.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusDot color={apiConnected ? "green" : "red"} size="sm" />
            <span className={apiConnected ? "text-[#22c55e]" : "text-[#e61919]"}>
              API {apiConnected ? "ONLINE :8000" : "DISCONNECTED"}
            </span>
          </div>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="text-[#a1a1aa] hidden sm:inline">{utcTime}</span>
        </div>
      </div>

      {/* Main tactical navbar */}
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Crosshair / Sentinel Symbol */}
            <div className="w-7 h-7 border border-[#e61919] flex items-center justify-center relative bg-[#e61919]/10 group-hover:border-white transition-colors">
              <div className="w-1.5 h-1.5 bg-[#e61919] group-hover:bg-white" />
              <div className="absolute top-0 bottom-0 w-[1px] bg-[#e61919]/40" />
              <div className="absolute left-0 right-0 h-[1px] bg-[#e61919]/40" />
            </div>
            <div>
              <div className="font-mono text-sm font-bold tracking-[0.2em] text-[#eaeaea] group-hover:text-white flex items-center gap-1.5">
                IAC SENTINAL
                <span className="text-[9px] font-normal px-1 py-0.2 bg-[#e61919] text-white">v1.0</span>
              </div>
              <div className="text-[9px] font-mono tracking-wider text-[#71717a] hidden sm:block">
                TACTICAL DRIFT REMEDIATION
              </div>
            </div>
          </Link>

          {/* Nav items */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono tracking-[0.08em] transition-all border ${
                    isActive
                      ? "bg-[#1f1f23] text-white border-white/20 shadow-sm"
                      : "text-[#888891] border-transparent hover:text-white hover:border-white/10 hover:bg-[#141414]"
                  }`}
                  style={{ borderRadius: "0px" }}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#e61919]" : "text-[#71717a]"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/pipeline"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#e61919] hover:bg-[#c91414] text-white text-xs font-mono font-semibold tracking-wider transition-colors border border-transparent shadow-[0_0_15px_rgba(230,25,25,0.3)]"
            style={{ borderRadius: "0px" }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>RUN PIPELINE</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

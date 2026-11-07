"use client";
import { useEffect, useState } from "react";
import { useT } from "./I18nProvider";

/** Pagi 04.00–10.59, siang 11.00–14.59, sore 15.00–17.59, malam 18.00–03.59. */
function greeting(hour: number) {
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

// Jam WIB dipakai saat render server; di browser diganti jam perangkat pengunjung dan diperbarui tiap menit
const wibHour = () => Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }));

export default function TimeGreeting({ name }: { name: string }) {
  const { t } = useT();
  const [text, setText] = useState(() => greeting(wibHour()));
  useEffect(() => {
    const tick = () => setText(greeting(new Date().getHours()));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{t(text)}, {name}</span>;
}

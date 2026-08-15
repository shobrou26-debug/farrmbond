import { useState } from "react";

const LIVESTOCK_IMAGE_FALLBACKS = [
  "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1442340743774-556731ec65b2?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1453368432345-73725718b7ae?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1462027076063-1ceabb252dbd?q=80&w=900&auto=format&fit=crop",
];

const livestockImageMap: Record<string, string> = {
  cattle:
    "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  cow:
    "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  cows:
    "https://images.unsplash.com/photo-1502734559478-912ab58bda39?q=80&w=900&auto=format&fit=crop",
  bull:
    "https://images.unsplash.com/photo-1584038180163-707e1eeeab6f?q=80&w=900&auto=format&fit=crop",
  goat:
    "https://images.unsplash.com/photo-1573578160998-4f4c7b023aec?q=80&w=900&auto=format&fit=crop",
  sheep:
    "https://images.unsplash.com/photo-1453368432345-73725718b7ae?q=80&w=900&auto=format&fit=crop",
  chicken:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  poultry:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  hen:
    "https://images.unsplash.com/photo-1472430023262-9a743f7570cb?q=80&w=900&auto=format&fit=crop",
  rooster:
    "https://images.unsplash.com/photo-1462027076063-1ceabb252dbd?q=80&w=900&auto=format&fit=crop",
  turkey:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  pig:
    "https://images.unsplash.com/photo-1589922585994-e9ac4fe0f71d?q=80&w=900&auto=format&fit=crop",
  piglet:
    "https://images.unsplash.com/photo-1589922585994-e9ac4fe0f71d?q=80&w=900&auto=format&fit=crop",
  duck:
    "https://images.unsplash.com/photo-1428572509712-cb9a529e81d7?q=80&w=900&auto=format&fit=crop",
  rabbit:
    "https://images.unsplash.com/photo-1433769747000-441481877caf?q=80&w=900&auto=format&fit=crop",
  fish:
    "https://images.unsplash.com/photo-1592339269936-fe8eafdc7fd5?q=80&w=900&auto=format&fit=crop",
};

function getLivestockImage(name: string, type: string): string {
  const haystack = `${name} ${type}`.toLowerCase();
  const key = Object.keys(livestockImageMap).find((k) => haystack.includes(k));
  if (key) return livestockImageMap[key];
  let hash = 0;
  for (let i = 0; i < haystack.length; i++) {
    hash = (hash * 31 + haystack.charCodeAt(i)) >>> 0;
  }
  return LIVESTOCK_IMAGE_FALLBACKS[hash % LIVESTOCK_IMAGE_FALLBACKS.length];
}

function typeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function healthColor(score: number): string {
  if (score >= 80) return "linear-gradient(90deg, #4ade80, #16a34a)";
  if (score >= 60) return "linear-gradient(90deg, #fbbf24, #d97706)";
  return "linear-gradient(90deg, #f87171, #dc2626)";
}

export default function Test() {
  const [v, setV] = useState("");
  return <div onClick={() => setV("x")}>{v || typeLabel("cattle")}</div>;
}

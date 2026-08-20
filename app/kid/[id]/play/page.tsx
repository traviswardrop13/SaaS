"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadState, type Child } from "@/lib/storage";
import { GAMES, todaysGames, type Game } from "@/lib/gameMap";

/**
 * Game Map — Duolingo ABC–style horizontal scrolling world.
 *
 * Page 0 = Today's Practice (daily rotating challenge)
 * Pages 1-4 = Individual game screens (Sound Racer, Story Time, Fruit Ninja, Stacks)
 *
 * Each page is a full-bleed illustrated scene with a grey ground band
 * at the bottom showing the game title. Tap the scene to launch.
 */
export default function PlayPage() {
  const params = useParams<{ id: string }>();
  const [child, setChild] = useState<Child | null>(null);

  useEffect(() => {
    const s = loadState();
    const found = s.children.find((c) => c.id === params.id);
    if (found) setChild(found);
  }, [params.id]);

  if (!child) return null;

  return <GameMap child={child} />;
}

// ── Types ──
type PageData =
  | { kind: "today"; games: Game[] }
  | { kind: "game"; game: Game };

function GameMap({ child }: { child: Child }) {
  const params = useParams<{ id: string }>();
  const [activePage, setActivePage] = useState(0);
  const dailyGames = todaysGames();

  const pages: PageData[] = [
    { kind: "today", games: dailyGames },
    ...GAMES.map((g) => ({ kind: "game" as const, game: g })),
  ];

  // ── Touch swipe ──
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        setActivePage((p) =>
          dx < 0 ? Math.min(p + 1, pages.length - 1) : Math.max(p - 1, 0),
        );
      }
    },
    [pages.length],
  );

  // ── Mouse drag (desktop) ──
  const mouseStartX = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    mouseStartX.current = e.clientX;
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const dx = e.clientX - mouseStartX.current;
      if (Math.abs(dx) > 50) {
        setActivePage((p) =>
          dx < 0 ? Math.min(p + 1, pages.length - 1) : Math.max(p - 1, 0),
        );
      }
    },
    [pages.length],
  );

  // ── Keyboard nav ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setActivePage((p) => Math.min(p + 1, pages.length - 1));
      if (e.key === "ArrowLeft")
        setActivePage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pages.length]);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black select-none"
      style={{ touchAction: "pan-x" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Carousel */}
      <div
        className="flex h-full transition-transform duration-[450ms] ease-out"
        style={{ transform: `translateX(-${activePage * 100}%)` }}
      >
        {pages.map((page, i) => {
          const href =
            page.kind === "today"
              ? `/kid/${params.id}/lesson/${GAMES[0].id}/1`
              : `/kid/${params.id}/${page.game.route}`;
          const scene =
            page.kind === "today"
              ? "/scenes/todays-practice.png"
              : page.game.scene;
          const title =
            page.kind === "today" ? "Today's Practice" : page.game.title;

          return (
            <div key={i} className="flex h-full min-w-full flex-col">
              {/* Scene image — fills the top area */}
              <Link
                href={href}
                className="relative block flex-1 overflow-hidden"
                draggable={false}
              >
                <img
                  src={scene}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  draggable={false}
                />
              </Link>

              {/* Grey ground band with title */}
              <div
                className="px-5 pb-14 pt-3 text-center"
                style={{ backgroundColor: "#6b7b87" }}
              >
                <h2 className="font-display text-2xl font-extrabold text-white/90">
                  {title}
                </h2>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot navigation — overlaid at the bottom */}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => setActivePage(i)}
            className="transition-all duration-300"
            style={{
              width: i === activePage ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                i === activePage ? "#ffffff" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

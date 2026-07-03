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
 * Pages 1-5 = Individual game screens
 *
 * Each page is a full-bleed illustrated scene.
 * Tap the scene (house) to launch the game.
 * No top bar chrome — just immersive scenes + small floating labels.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const dailyGames = todaysGames();

  const pages: PageData[] = [
    { kind: "today", games: dailyGames },
    ...GAMES.map((g) => ({ kind: "game" as const, game: g })),
  ];

  // ── Touch swipe handling ──
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
        const next = dx < 0
          ? Math.min(activePage + 1, pages.length - 1)
          : Math.max(activePage - 1, 0);
        setActivePage(next);
      }
    },
    [activePage, pages.length],
  );

  // ── Mouse drag handling (desktop) ──
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
        const next = dx < 0
          ? Math.min(activePage + 1, pages.length - 1)
          : Math.max(activePage - 1, 0);
        setActivePage(next);
      }
    },
    [activePage, pages.length],
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

  const getSceneForPage = (page: PageData) =>
    page.kind === "today" ? "/scenes/todays-practice.png" : page.game.scene;

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
        ref={scrollRef}
        className="flex h-full transition-transform duration-[450ms] ease-out"
        style={{ transform: `translateX(-${activePage * 100}%)` }}
      >
        {pages.map((page, i) => (
          <div key={i} className="relative h-full min-w-full">
            {/* Full-bleed scene background */}
            <Link
              href={
                page.kind === "today"
                  ? `/kid/${params.id}/lesson/${GAMES[0].id}/1`
                  : `/kid/${params.id}/${page.game.route}`
              }
              className="absolute inset-0 block"
              draggable={false}
            >
              <img
                src={getSceneForPage(page)}
                alt={page.kind === "today" ? "Today's Practice" : page.game.title}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </Link>

            {/* Game title — positioned in the grey ground area */}
            <div className="pointer-events-none absolute inset-x-0 bottom-12 flex items-center justify-center px-6">
              <h2 className="text-center font-display text-2xl font-extrabold text-white/90 sm:text-3xl">
                {page.kind === "today"
                  ? "Today's Practice"
                  : page.game.title}
              </h2>
            </div>

            {/* Swipe hint on first page */}
            {i === 0 && activePage === 0 && (
              <div
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 animate-bounce rounded-2xl bg-black/40 px-3 py-2 text-sm font-bold text-white backdrop-blur"
              >
                Swipe →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dot navigation */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-5 pt-3">
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => setActivePage(i)}
            className="transition-all duration-300"
            style={{
              width: i === activePage ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === activePage ? "#ffffff" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

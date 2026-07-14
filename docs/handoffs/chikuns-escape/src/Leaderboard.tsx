"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import {
  LEADERBOARD_EVENT,
  LEADERBOARD_SIZE,
  LEADERBOARD_TABLE,
  fetchLeaderboard,
  isLeaderboardRemote,
  loadSave,
  type LeaderboardEntry,
  type SaveState,
} from "./game/storage";
import { getSupabase } from "./game/supabase";
import { ZONES } from "./game/config";

function zoneName(zone: number) {
  return (
    ZONES[Math.max(0, Math.min(ZONES.length - 1, zone - 1))]?.name ?? "—"
  );
}

function timeAgo(ts: number, now: number) {
  const diff = Math.max(0, now - ts);
  if (diff < 60_000) return "NOW";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}D`;
  return `${Math.floor(d / 30)}MO`;
}

export default function Leaderboard() {
  const [state, setState] = useState<{
    entries: LeaderboardEntry[];
    save: SaveState;
  } | null>(null);
  // Re-render time-ago labels once per minute without thrashing the UI.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    // Render local cache immediately, then refresh from Supabase.
    const initial = loadSave();
    setState({ entries: initial.leaderboard ?? [], save: initial });

    const refresh = async () => {
      const entries = await fetchLeaderboard();
      if (cancelled) return;
      setState({ entries, save: loadSave() });
    };
    refresh();

    const onLocal = () => {
      // Other components (e.g. game submission) updated the local save;
      // re-read it so the "YOUR BEST / YOUR RANK" stats update instantly.
      setState({ entries: loadSave().leaderboard ?? [], save: loadSave() });
      refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("arise-")) onLocal();
    };
    window.addEventListener(LEADERBOARD_EVENT, onLocal);
    window.addEventListener("storage", onStorage);

    // Realtime: refetch whenever any user inserts a new score.
    const sb = isLeaderboardRemote ? getSupabase() : null;
    const channel = sb
      ? sb
          .channel("leaderboard-stream")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: LEADERBOARD_TABLE },
            () => refresh()
          )
          .subscribe()
      : null;

    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener(LEADERBOARD_EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
      if (channel && sb) sb.removeChannel(channel);
    };
  }, []);

  if (!state) return null;
  const { entries, save } = state;

  // ─── Competitive context ───
  const topScore = entries[0]?.score ?? 0;
  const threshold =
    entries.length >= LEADERBOARD_SIZE
      ? entries[entries.length - 1].score
      : null;
  const yourRankIdx = save.playerName
    ? entries.findIndex(
        (e) => e.name.toUpperCase() === save.playerName.toUpperCase()
      )
    : -1;
  const yourRank = yourRankIdx >= 0 ? yourRankIdx + 1 : null;

  const slots: (LeaderboardEntry | null)[] = Array.from(
    { length: LEADERBOARD_SIZE },
    (_, i) => entries[i] ?? null
  );

  return (
    <section
      id="leaderboard"
      className="relative w-full max-w-5xl mx-auto mt-14 sm:mt-20 px-3 sm:px-6 text-bone scroll-mt-24"
    >
      {/* ─────── Header ─────── */}
      <div className="flex flex-col items-center text-center">
        <span
          className="tape inline-flex items-center gap-2"
          style={{ fontSize: "0.7rem", padding: "0.4rem 0.9rem" }}
        >
          <span className="arise-live-dot" />
          LIVE · TOP {LEADERBOARD_SIZE}
        </span>

        <h2
          className="mt-6 font-black text-bone leading-[0.85] tracking-tight whitespace-nowrap"
          style={{ fontSize: "clamp(1.6rem, 6vw, 4rem)" }}
        >
          GLOBAL <span className="text-glow">LEADERBOARD</span>
        </h2>

        <p className="prose-normal mt-4 text-sm sm:text-base text-bone/80 max-w-2xl">
          Leave your mark on the blockchain, forever.
        </p>
      </div>

      {/* ─────── Board ─────── */}
      <div className="relative mt-8 sm:mt-10 border-2 border-black rounded-xl overflow-hidden bg-ink shadow-[6px_6px_0_0_#0A0A0F]">
        {/* Stat rail */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black border-b-2 border-black bg-ink-soft">
          <StatCell label="TOP SCORE" value={topScore.toLocaleString()} accent="glow" emphasize />
          <StatCell
            label="YOUR RANK"
            value={yourRank ? `#${String(yourRank).padStart(2, "0")}` : "—"}
            accent={yourRank ? "glow" : "bone"}
            sub={yourRank ? "ON THE BOARD" : "UNRANKED"}
          />
          <StatCell
            label="YOUR BEST"
            value={save.highScore ? save.highScore.toLocaleString() : "0"}
            accent="bone"
            sub={save.playerName ? save.playerName : ""}
          />
          <StatCell
            label="THRESHOLD"
            value={threshold !== null ? threshold.toLocaleString() : "OPEN"}
            accent="bone"
            sub={threshold !== null ? "TO JOIN" : `${LEADERBOARD_SIZE - entries.length} SEATS`}
          />
        </div>

        {/* Column header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-black/80 border-b-2 border-black text-[10px] tracking-[0.3em] text-bone/55 font-black">
          <div className="w-10">#</div>
          <div className="flex-1">HANDLE</div>
          <div className="w-20 sm:w-24 text-right">SCORE</div>
          <div className="hidden md:block w-20 text-right">Δ vs #1</div>
          <div className="hidden lg:block w-20 text-right">COINS</div>
          <div className="hidden md:block w-32 lg:w-36 text-right">ZONE</div>
          <div className="hidden sm:block w-12 lg:w-14 text-right">TIME</div>
        </div>

        {/* Rows */}
        {slots.map((entry, i) => {
          const rank = i + 1;
          if (!entry) return <EmptyRow key={`empty-${i}`} rank={rank} />;
          const gapToTop = topScore - entry.score;
          const isYou =
            save.playerName &&
            entry.name.toUpperCase() === save.playerName.toUpperCase();
          if (rank === 1) {
            return (
              <ChampionRow
                key={`${entry.timestamp}-${i}`}
                entry={entry}
                leadOverSecond={
                  entries.length > 1 ? entry.score - entries[1].score : null
                }
                now={now}
                isYou={Boolean(isYou)}
              />
            );
          }
          return (
            <RankRow
              key={`${entry.timestamp}-${i}`}
              entry={entry}
              rank={rank}
              gapToTop={gapToTop}
              now={now}
              isYou={Boolean(isYou)}
            />
          );
        })}
      </div>

      <div className="mt-5 text-center text-[10px] tracking-[0.3em] text-bone/40 font-black">
        {isLeaderboardRemote
          ? "LIVE GLOBAL BOARD · PLAY TO CLAIM A SEAT"
          : "SCORES STORED ON THIS DEVICE · PLAY TO CLAIM A SEAT"}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function StatCell({
  label,
  value,
  sub,
  accent,
  emphasize,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "glow" | "bone";
  emphasize?: boolean;
}) {
  const valueColor = accent === "glow" ? "text-glow" : "text-bone";
  return (
    <div className="px-4 py-3 sm:py-4">
      <div className="text-[9px] sm:text-[10px] tracking-[0.3em] text-bone/55 font-black">
        {label}
      </div>
      <div
        className={`${valueColor} font-black tabular-nums leading-none mt-1.5 truncate`}
        style={{
          fontSize: emphasize
            ? "clamp(1.25rem, 3.6vw, 1.85rem)"
            : "clamp(1.1rem, 3vw, 1.5rem)",
        }}
        title={value}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[9px] tracking-[0.28em] text-bone/45 font-black mt-1 truncate">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function ChampionRow({
  entry,
  leadOverSecond,
  now,
  isYou,
}: {
  entry: LeaderboardEntry;
  leadOverSecond: number | null;
  now: number;
  isYou: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3 px-4 py-4 sm:py-5 bg-glow text-ink border-b-2 border-black">
      <div className="w-10 flex items-center gap-1.5">
        <Crown
          className="w-5 h-5 sm:w-6 sm:h-6 shrink-0"
          strokeWidth={3}
          fill="currentColor"
        />
        <span className="font-black tabular-nums text-base sm:text-lg">
          01
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-black tracking-tight leading-none truncate"
            style={{ fontSize: "clamp(1.1rem, 4vw, 1.75rem)" }}
            title={entry.name}
          >
            {entry.name}
          </span>
          {isYou ? <YouBadge onDark={false} /> : null}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] tracking-[0.3em] font-black opacity-75">
          <span>CHAMPION</span>
          {leadOverSecond !== null && leadOverSecond > 0 ? (
            <>
              <span>·</span>
              <span>LEADS BY {leadOverSecond.toLocaleString()}</span>
            </>
          ) : leadOverSecond === null ? (
            <>
              <span>·</span>
              <span>UNCONTESTED</span>
            </>
          ) : null}
          <span className="md:hidden">
            · {entry.coins} COINS · {zoneName(entry.zone)}
          </span>
        </div>
      </div>
      <div
        className="w-20 sm:w-24 text-right font-black tabular-nums leading-none"
        style={{ fontSize: "clamp(1.1rem, 3.4vw, 1.6rem)" }}
      >
        {entry.score.toLocaleString()}
      </div>
      <div className="hidden md:block w-20 text-right font-black tabular-nums text-sm opacity-80">
        {leadOverSecond !== null && leadOverSecond > 0
          ? `+${leadOverSecond.toLocaleString()}`
          : "—"}
      </div>
      <div className="hidden lg:block w-20 text-right font-black tabular-nums">
        Ł {entry.coins}
      </div>
      <div className="hidden md:block w-32 lg:w-36 text-right text-[10px] tracking-[0.25em] font-black truncate">
        {zoneName(entry.zone)}
      </div>
      <div className="hidden sm:block w-12 lg:w-14 text-right text-[10px] tracking-[0.2em] font-black opacity-80">
        {timeAgo(entry.timestamp, now)}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function RankRow({
  entry,
  rank,
  gapToTop,
  now,
  isYou,
}: {
  entry: LeaderboardEntry;
  rank: number;
  gapToTop: number;
  now: number;
  isYou: boolean;
}) {
  const isElite = rank <= 3;
  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-3 border-b border-bone/10 last:border-b-0 transition-colors ${
        isYou ? "bg-glow/10" : isElite ? "bg-bone/[0.03]" : ""
      } hover:bg-bone/[0.06]`}
    >
      {/* Left accent bar on hover / you-row */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[3px] transition-opacity ${
          isYou ? "opacity-100 bg-glow" : "opacity-0 bg-bone group-hover:opacity-100"
        }`}
      />

      <div className="w-10 flex items-center">
        <span
          className={`font-black tabular-nums text-sm ${
            isElite ? "text-glow" : "text-bone/60"
          }`}
        >
          {String(rank).padStart(2, "0")}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-black tracking-widest text-sm sm:text-base text-bone truncate">
            {entry.name}
          </span>
          {isYou ? <YouBadge onDark /> : null}
        </div>
        {/* Stacked secondary line on narrow screens */}
        <div className="md:hidden flex gap-2 text-[9px] tracking-[0.25em] text-bone/50 font-black mt-0.5">
          <span className="text-glow">Ł {entry.coins}</span>
          <span>·</span>
          <span className="truncate">{zoneName(entry.zone)}</span>
          <span>·</span>
          <span>{timeAgo(entry.timestamp, now)}</span>
        </div>
      </div>

      <div className="w-20 sm:w-24 text-right font-black tabular-nums text-sm sm:text-base text-bone">
        {entry.score.toLocaleString()}
      </div>
      <div className="hidden md:block w-20 text-right font-black tabular-nums text-sm text-bone/60">
        {gapToTop > 0 ? `−${gapToTop.toLocaleString()}` : "—"}
      </div>
      <div className="hidden lg:block w-20 text-right text-glow font-black tabular-nums">
        {entry.coins}
      </div>
      <div className="hidden md:block w-32 lg:w-36 text-right text-[10px] tracking-[0.25em] text-bone/70 font-black truncate">
        {zoneName(entry.zone)}
      </div>
      <div className="hidden sm:block w-12 lg:w-14 text-right text-[10px] tracking-[0.2em] text-bone/55 font-black">
        {timeAgo(entry.timestamp, now)}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function EmptyRow({ rank }: { rank: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-bone/5 last:border-b-0 text-bone/20">
      <div className="w-10 font-black tabular-nums text-sm">
        {String(rank).padStart(2, "0")}
      </div>
      <div className="flex-1 min-w-0 font-black text-[10px] sm:text-xs tracking-[0.35em]">
        — OPEN —
      </div>
      <div className="w-20 sm:w-24 text-right font-black tabular-nums text-sm">
        —
      </div>
      <div className="hidden md:block w-20 text-right font-black tabular-nums text-sm">
        —
      </div>
      <div className="hidden lg:block w-20 text-right font-black tabular-nums">
        —
      </div>
      <div className="hidden md:block w-32 lg:w-36 text-right text-[10px] font-black">
        —
      </div>
      <div className="hidden sm:block w-12 lg:w-14 text-right text-[10px] font-black">
        —
      </div>
    </div>
  );
}

function YouBadge({ onDark }: { onDark: boolean }) {
  return (
    <span
      className={`inline-block text-[9px] tracking-[0.25em] font-black px-1.5 py-0.5 rounded-sm border ${
        onDark
          ? "bg-glow text-ink border-ink"
          : "bg-ink text-glow border-ink"
      }`}
    >
      YOU
    </span>
  );
}

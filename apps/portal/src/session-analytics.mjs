export function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function percentile(values, p = 0.5) {
  const sorted = values.map((value) => numeric(value, NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return Math.round(sorted[0]);
  const clamped = Math.max(0, Math.min(1, numeric(p, 0.5)));
  const index = (sorted.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return Math.round(sorted[lower]);
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function survivalSecondsFor(session) {
  const stats = session?.runStats ?? {};
  return numeric(stats.elapsedSeconds ?? stats.surviveSeconds ?? stats.survivalSeconds ?? stats.survivalTime, 0);
}

function scoreFor(session) {
  return numeric(session?.score ?? session?.runStats?.score, 0);
}

function killsFor(session) {
  return numeric(session?.runStats?.kills, 0);
}

function settledFor(session) {
  return Boolean(session?.settlement?.primaryTxHash ?? session?.settlementTxHash ?? session?.primaryTxHash);
}

function trustVerdictFor(session) {
  if (session?.integrity?.verdict === 'suspicious' || session?.integrity?.verdict === 'rejected') return session.integrity.verdict;
  if (settledFor(session)) return 'settled';
  return 'prototype';
}

function emptyMetric() {
  return { min: 0, p50: 0, p90: 0, max: 0, avg: 0 };
}

function metric(values) {
  const clean = values.map((value) => numeric(value, NaN)).filter(Number.isFinite);
  if (!clean.length) return emptyMetric();
  const sum = clean.reduce((total, value) => total + value, 0);
  return {
    min: Math.round(Math.min(...clean)),
    p50: percentile(clean, 0.5),
    p90: percentile(clean, 0.9),
    max: Math.round(Math.max(...clean)),
    avg: Math.round(sum / clean.length),
  };
}

function gameTitleFor(gameId, sessions) {
  return sessions.find((session) => session.gameId === gameId)?.gameTitle ?? gameId;
}

function summarizeGame(gameId, sessions) {
  const scores = sessions.map(scoreFor);
  const survival = sessions.map(survivalSecondsFor);
  const kills = sessions.map(killsFor);
  const minutes = survival.reduce((sum, seconds) => sum + seconds / 60, 0);
  const totalKills = kills.reduce((sum, killsCount) => sum + killsCount, 0);
  const settledRuns = sessions.filter(settledFor).length;
  return {
    gameId,
    title: gameTitleFor(gameId, sessions),
    runs: sessions.length,
    rankedRuns: sessions.filter((session) => session.mode === 'paid' || session.mode === 'ranked' || session.leaderboardEligible).length,
    settledRuns,
    prototypeRuns: sessions.length - settledRuns,
    score: metric(scores),
    survivalSeconds: metric(survival),
    kills: metric(kills),
    killsPerMinute: minutes > 0 ? Number((totalKills / minutes).toFixed(2)) : 0,
    scorePerMinute: minutes > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / minutes) : 0,
    maxCombo: metric(sessions.map((session) => session.runStats?.maxCombo ?? session.runStats?.maxKillCombo ?? 0)),
  };
}

function buildBalanceFlags(games) {
  const flags = [];
  const hmh = games['lester-blaster'];
  if (hmh) {
    const p50Minutes = hmh.survivalSeconds.p50 / 60;
    const p90Minutes = hmh.survivalSeconds.p90 / 60;
    const inTarget = p50Minutes >= 4 && p50Minutes <= 8 && p90Minutes >= 8 && p90Minutes <= 20;
    flags.push({
      id: 'hmh-master-run-window',
      severity: inTarget ? 'info' : 'warning',
      metric: `${p50Minutes.toFixed(1)}m p50 / ${p90Minutes.toFixed(1)}m p90`,
      copy: inTarget
        ? 'Hard Money Heroes sample sits inside the intended 5-minute average / 15-20 minute mastery window.'
        : 'Hard Money Heroes sample is outside the intended 5-minute average / 15-20 minute mastery window; tune pressure or rewards before broad playtest.',
    });
    if (hmh.killsPerMinute > 16) {
      flags.push({ id: 'hmh-kill-rate-pressure', severity: 'warning', metric: `${hmh.killsPerMinute} kills/min`, copy: 'Kill rate is high; verify enemy readability and reward pickup clarity.' });
    }
  }
  const chikun = games.chikun;
  if (chikun) {
    flags.push({ id: 'chikun-early-slice-sample', severity: 'info', metric: `${chikun.runs} run(s)`, copy: 'Chikun is a vertical slice; keep sample sizes separate from HMH balance calls.' });
  }
  if (!flags.length) flags.push({ id: 'no-game-samples', severity: 'warning', metric: '0 runs', copy: 'No session samples available for balance analysis.' });
  return flags;
}

export function buildSessionAnalyticsReport(sessions = [], { generatedAt = new Date().toISOString(), source = 'local-prototype-session-sample' } = {}) {
  const normalized = sessions.map((session, index) => ({
    ...session,
    analyticsId: session.urlSessionId ?? session.sessionId ?? `sample-${String(index + 1).padStart(3, '0')}`,
    score: scoreFor(session),
    survivalSeconds: survivalSecondsFor(session),
    kills: killsFor(session),
    trustVerdict: trustVerdictFor(session),
  }));
  const gameIds = [...new Set(normalized.map((session) => session.gameId).filter(Boolean))];
  const games = Object.fromEntries(gameIds.map((gameId) => [gameId, summarizeGame(gameId, normalized.filter((session) => session.gameId === gameId))]));
  const rankedRuns = normalized.filter((session) => session.mode === 'paid' || session.mode === 'ranked' || session.leaderboardEligible).length;
  const trust = {
    settled: normalized.filter((session) => session.trustVerdict === 'settled').length,
    prototype: normalized.filter((session) => session.trustVerdict === 'prototype').length,
    suspicious: normalized.filter((session) => session.trustVerdict === 'suspicious').length,
    rejected: normalized.filter((session) => session.trustVerdict === 'rejected').length,
  };
  return {
    generatedAt,
    source,
    summary: {
      totalRuns: normalized.length,
      rankedRuns,
      settledRuns: trust.settled,
      uniqueWallets: new Set(normalized.map((session) => session.wallet).filter(Boolean)).size,
      gamesTracked: gameIds.length,
    },
    trust,
    score: metric(normalized.map((session) => session.score)),
    survivalSeconds: metric(normalized.map((session) => session.survivalSeconds)),
    games,
    balanceFlags: buildBalanceFlags(games),
    samples: normalized.map((session) => ({
      analyticsId: session.analyticsId,
      gameId: session.gameId,
      score: session.score,
      survivalSeconds: session.survivalSeconds,
      kills: session.kills,
      trustVerdict: session.trustVerdict,
      recordedAt: session.syncedAt ?? session.recordedAt ?? null,
    })),
  };
}

export function buildSessionBalanceReportMarkdown(report) {
  const gameRows = Object.values(report.games ?? {}).map((game) => `| ${game.title} | ${game.runs} | ${game.score.p50} | ${game.score.p90} | ${game.survivalSeconds.p50}s | ${game.survivalSeconds.p90}s | ${game.killsPerMinute} | ${game.settledRuns}/${game.runs} |`).join('\n');
  const flags = (report.balanceFlags ?? []).map((flag) => `- **${flag.severity.toUpperCase()}** ${flag.id}: ${flag.metric} — ${flag.copy}`).join('\n');
  const samples = (report.samples ?? []).slice(0, 8).map((sample) => `- ${sample.analyticsId}: ${sample.gameId}, ${sample.score} pts, ${sample.survivalSeconds}s, trust=${sample.trustVerdict}`).join('\n');
  return `# Lester's Arcade Session Analytics Balance Report\n\nGenerated: ${report.generatedAt}  \nSource: ${report.source}\n\n## Summary\n\n- Total runs: ${report.summary.totalRuns}\n- Ranked runs: ${report.summary.rankedRuns}\n- Settled runs: ${report.summary.settledRuns}\n- Unique wallets: ${report.summary.uniqueWallets}\n- Global p50 score: ${report.score.p50}\n- Global p90 survival: ${report.survivalSeconds.p90}s\n\n## Game balance table\n\n| Game | Runs | p50 score | p90 score | p50 survival | p90 survival | Kills/min | Settled |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${gameRows || '| No samples | 0 | 0 | 0 | 0s | 0s | 0 | 0/0 |'}\n\n## Balance flags\n\n${flags}\n\n## Recent samples\n\n${samples || '- No session samples available.'}\n\n## Action items\n\n- Re-run \`npm run design:session-analytics\` after any balance-affecting change.\n- Compare p50/p90 survival against the target HMH average/mastery window.\n- Treat Chikun vertical-slice samples separately until it has a larger run population.\n- Investigate suspicious/rejected trust rows before using them for tuning.\n`;
}

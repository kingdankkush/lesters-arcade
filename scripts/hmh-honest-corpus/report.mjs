// Condenses a batch's verify results (runs/results.json) into the report's
// numbers: verdicts, every flag, one line per run, and the closest approach
// to each v6 rule. Import printReport, or run it on a results file:
//   node scripts/hmh-honest-corpus/report.mjs [runs/results.json]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function printReport({ runs }, log = console.log) {
  const done = runs.filter((run) => run.stats);
  const ticks = done.map((run) => run.stats.survivalTicks).sort((a, b) => a - b);
  log(`runs planned=${runs.length} with summary=${done.length} missing=${runs.filter((r) => r.missing).length} noSummary=${runs.filter((r) => !r.missing && !r.stats).length}`);
  if (!done.length) return;
  const count = (list, keyOf) => JSON.stringify(list.reduce((acc, r) => { const k = keyOf(r); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}));
  log(`ticks total=${ticks.reduce((a, b) => a + b, 0)} min=${ticks[0]} median=${ticks[Math.floor(ticks.length / 2)]} max=${ticks.at(-1)}`);
  log(`endedBy ${count(done, (r) => r.endedBy)}`);
  log(`entries ${count(done, (r) => r.margins.district.entry)}`);
  log(`child errors ${done.reduce((a, r) => a + r.childErrors, 0)} invalid child messages ${done.reduce((a, r) => a + r.invalidChildMessages.length, 0)} schema errors ${done.filter((r) => r.schemaError).length}`);
  log(`verifyRankedRun ${count(done, (r) => (r.verifyRankedRun.ok ? `ok:${r.verifyRankedRun.verdict}` : `fail:${r.verifyRankedRun.error}`))}`);
  log(`plausibility ${count(done, (r) => r.plausibility.verdict)}`);
  log('\nALL FLAGS / REJECTS');
  for (const r of done) for (const f of r.plausibility.flags) log(`  ${r.label} ${f.severity} ${f.id} value=${f.value} limit=${f.limit} (ticks ${r.stats.survivalTicks}, kills ${r.stats.kills})`);
  for (const r of done) if (!r.verifyRankedRun.ok) log(`  ${r.label} verifyRankedRun ${JSON.stringify(r.verifyRankedRun)}`);

  log('\nPER RUN');
  for (const r of done) {
    const s = r.stats;
    const g = s.grenades;
    log([
      r.label.padEnd(33), String(s.survivalTicks).padStart(6), r.endedBy.padEnd(21),
      `k=${s.kills}`, `gk=${g.kills}`, `thr=${g.thrown}`, `det=${g.detonated}`, `lvl=${s.level}`,
      `d=${s.districts.length}`, `sites=${s.sitesOperated.length}`, `sec=${s.secretsFound.length}`,
      `pick=${Object.entries(s.pickupsByEffect).map(([k, v]) => `${k.replace('-cache', '').replace('-liquidation', '')}:${v}`).join(',')}`,
      `wpick=${Object.entries(s.weaponPickups).map(([k, v]) => `${k}:${v}`).join(',')}`, `swaps=${s.weaponSwaps}`,
      `boss=${s.boss}`, `errs=${r.childErrors}`, `verdict=${r.plausibility.verdict}`,
    ].join(' '));
  }

  log('\nCLOSEST APPROACH PER RULE');
  const best = (label, values) => {
    const sorted = values.filter(Boolean).sort((a, b) => a.key - b.key);
    log(`  ${label}: ${sorted.slice(0, 3).map((v) => `${v.label}:${v.text}`).join(' | ')}`);
  };
  const m = (r) => r.margins;
  best('grenade-kills-above-weapon-kills (weaponKills-grenadeKills)', done.map((r) => ({ key: m(r).grenadeKillsVsWeaponKills.grenadeWeaponKills - m(r).grenadeKillsVsWeaponKills.grenadeKills, label: r.label, text: `${m(r).grenadeKillsVsWeaponKills.grenadeKills}/${m(r).grenadeKillsVsWeaponKills.grenadeWeaponKills}` })));
  best('pickups-above-capacity (tightest effect slack)', done.map((r) => m(r).pickupTightest && ({ key: m(r).pickupTightest.slack, label: r.label, text: `${m(r).pickupTightest.effectId} ${m(r).pickupTightest.collected}/${m(r).pickupTightest.capacity}` })));
  best('districts-before-travel-time (runTicks-minTicks)', done.map((r) => ({ key: -(m(r).district.ratio ?? 0), label: r.label, text: `min ${m(r).district.minTicks} of ${m(r).district.runTicks} (travel ${m(r).district.travelPx}px, mask ${m(r).district.mask}, ratio ${m(r).district.ratio})` })));
  log(`  district-path-invalid: invalid paths=${done.filter((r) => !m(r).district.pathValid).length}; masks=${[...new Set(done.map((r) => `${m(r).district.entry}:${m(r).district.mask}`))].join(' ')}`);
  best('equipped-ticks-above-run (slack)', done.map((r) => ({ key: m(r).equippedTicks.slack, label: r.label, text: `${m(r).equippedTicks.equipped}/${m(r).equippedTicks.runTicks}` })));
  const cacheSlack = done.flatMap((r) => m(r).weaponSource.filter((w) => w.cacheCollected !== null && w.pickups > 0).map((w) => w.cacheCollected - w.pickups));
  log(`  weapon-without-source: offending rows=${done.reduce((a, r) => a + m(r).weaponsWithoutSource.length, 0)}; min cache slack=${cacheSlack.length ? Math.min(...cacheSlack) : 'n/a'}`);
  best('grenade-kills-above-contacts (contacts-kills)', done.map((r) => ({ key: m(r).grenadeContacts.contacts - m(r).grenadeContacts.kills, label: r.label, text: `${m(r).grenadeContacts.kills}/${m(r).grenadeContacts.contacts}` })));
  best('grenade-detonations-above-launches (launches-detonated)', done.map((r) => ({ key: m(r).grenadeLaunches.launches - m(r).grenadeLaunches.detonated, label: r.label, text: `${m(r).grenadeLaunches.detonated}/${m(r).grenadeLaunches.launches}` })));
  best('grenades-thrown-above-supply (slack)', done.map((r) => ({ key: m(r).grenadeSupply.slack, label: r.label, text: `${m(r).grenadeSupply.thrown}/${m(r).grenadeSupply.supply}` })));
  log(`  damage-dealt-mismatch: nonzero diffs=${done.filter((r) => m(r).damage.diff !== 0).length}`);
  best('combo-above-kills (kills-maxCombo)', done.map((r) => ({ key: m(r).combo.kills - m(r).combo.maxCombo, label: r.label, text: `${m(r).combo.maxCombo}/${m(r).combo.kills}` })));
  best('knife-kills-above-contacts (contacts-kills)', done.map((r) => m(r).knifeContacts && ({ key: m(r).knifeContacts.slack, label: r.label, text: `${m(r).knifeContacts.kills}/${m(r).knifeContacts.contacts} (swings ${m(r).knifeContacts.triggers}, hitting ${m(r).knifeContacts.triggerContacts})` })));
  log(`  melee-contacts-without-trigger: offending rows=${done.reduce((a, r) => a + (m(r).meleeContactsWithoutTrigger?.length ?? 0), 0)}`);
  best('knife-triggers-above-cadence (ratio)', done.map((r) => m(r).knifeCadence && ({ key: -(m(r).knifeCadence.ratio ?? 0), label: r.label, text: `${m(r).knifeCadence.triggers}/${m(r).knifeCadence.limit} (${m(r).knifeCadence.ratio})` })));
  best('standard-triggers-above-cadence (ratio)', done.map((r) => m(r).standardCadence && ({ key: -(m(r).standardCadence.ratio ?? 0), label: r.label, text: `${m(r).standardCadence.strikes}/${m(r).standardCadence.limit} (${m(r).standardCadence.ratio}; contacts ${m(r).standardCadence.contacts}, kills ${m(r).standardCadence.kills})` })));
  best('kills-above-capacity (ratio)', done.map((r) => ({ key: -m(r).killsCapacity.ratio, label: r.label, text: `${m(r).killsCapacity.kills}/${m(r).killsCapacity.capacity} (${m(r).killsCapacity.ratio})` })));
  best('xp-above-ceiling (ratio)', done.map((r) => ({ key: -(m(r).xpCeiling.ratio ?? 0), label: r.label, text: `${m(r).xpCeiling.xp}/${m(r).xpCeiling.ceiling} (${m(r).xpCeiling.ratio})` })));
  best('score-above-ceiling (ratio)', done.map((r) => ({ key: -(m(r).scoreCeiling.ratio ?? 0), label: r.label, text: `${m(r).scoreCeiling.score}/${m(r).scoreCeiling.ceiling} (${m(r).scoreCeiling.ratio})` })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'runs', 'results.json');
  printReport(JSON.parse(readFileSync(file, 'utf8')));
}

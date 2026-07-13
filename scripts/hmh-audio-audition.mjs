import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HMH_SFX_CUE_REGISTRY } from '../apps/portal/src/hmh-audio-system.mjs';

const SAMPLE_RATE = 44_100;
const CUE_SECONDS = 0.34;
const GAP_SECONDS = 0.06;

function wave(type, phase) {
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  if (type === 'square') return cycle < 0.5 ? 1 : -1;
  if (type === 'sawtooth') return (cycle * 2) - 1;
  if (type === 'triangle') return 1 - (4 * Math.abs(cycle - 0.5));
  return Math.sin(phase);
}

function renderCue(spec) {
  const length = Math.ceil(CUE_SECONDS * SAMPLE_RATE);
  const samples = new Float32Array(length);
  const voiceSeconds = 0.085;
  const baseGain = Math.min(0.13, 0.055 * (spec.gainMul ?? 1));
  spec.tone.forEach((frequency, index) => {
    const start = Math.round(index * 0.045 * SAMPLE_RATE);
    const stop = Math.min(length, start + Math.round(voiceSeconds * SAMPLE_RATE));
    for (let i = start; i < stop; i += 1) {
      const local = (i - start) / SAMPLE_RATE;
      const envelope = Math.max(0, 1 - (local / voiceSeconds));
      samples[i] += wave(spec.synth, Math.PI * 2 * frequency * local) * envelope * baseGain;
    }
  });
  let sumSquares = 0;
  let peak = 0;
  let nonZero = 0;
  for (const sample of samples) {
    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    sumSquares += sample * sample;
    if (absolute > 0.00001) nonZero += 1;
  }
  return {
    samples,
    peak,
    rms: Math.sqrt(sumSquares / samples.length),
    nonZero,
  };
}

function pcm16Wav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return buffer;
}

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function buildAudioAudition({ repoRoot = repoRootFromHere() } = {}) {
  const entries = Object.entries(HMH_SFX_CUE_REGISTRY);
  const gap = new Float32Array(Math.round(GAP_SECONDS * SAMPLE_RATE));
  const rendered = entries.map(([cue, spec]) => ({ cue, spec, ...renderCue(spec) }));
  const totalLength = rendered.reduce((sum, item) => sum + item.samples.length + gap.length, 0);
  const reel = new Float32Array(totalLength);
  let cursor = 0;
  for (const item of rendered) {
    reel.set(item.samples, cursor);
    cursor += item.samples.length + gap.length;
  }

  const wav = pcm16Wav(reel);
  const vaultDir = path.join(os.homedir(), 'lesters-arcade-vault', 'qa', 'audio');
  mkdirSync(vaultDir, { recursive: true });
  const reelPath = path.join(vaultDir, 'hmh-sfx-audition-83-cues.wav');
  writeFileSync(reelPath, wav);

  const rows = rendered.map((item) => ({
    cue: item.cue,
    family: item.spec.family,
    synth: item.spec.synth,
    tones: item.spec.tone,
    peak: Number(item.peak.toFixed(6)),
    rms: Number(item.rms.toFixed(6)),
    nonZeroSamples: item.nonZero,
    silent: item.rms < 0.0005 || item.nonZero === 0,
    clipped: item.peak >= 0.99,
  }));
  const signatureCount = new Set(entries.map(([, spec]) => `${spec.synth}:${spec.tone.join('/')}:${spec.cooldownMs}`)).size;
  const report = {
    generatedAt: new Date().toISOString(),
    cueCount: entries.length,
    signatureCount,
    sampleRate: SAMPLE_RATE,
    cueSeconds: CUE_SECONDS,
    gapSeconds: GAP_SECONDS,
    durationSeconds: Number((reel.length / SAMPLE_RATE).toFixed(3)),
    reelFile: path.basename(reelPath),
    reelSha256: createHash('sha256').update(wav).digest('hex'),
    silentCueCount: rows.filter((row) => row.silent).length,
    clippedCueCount: rows.filter((row) => row.clipped).length,
    status: entries.length >= 64 && signatureCount >= 52 && rows.every((row) => !row.silent && !row.clipped) ? 'PASS' : 'FAIL',
    cues: rows,
  };

  const docsDir = path.join(repoRoot, 'docs', 'audio');
  mkdirSync(docsDir, { recursive: true });
  const jsonPath = path.join(docsDir, 'hard-money-heroes-audio-audition.json');
  const mdPath = path.join(docsDir, 'hard-money-heroes-audio-audition.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, `# Hard Money Heroes SFX Audition Certificate\n\n- Status: **${report.status}**\n- Runtime-playable cues: ${report.cueCount}\n- Distinct procedural signatures: ${report.signatureCount}\n- Silent cues: ${report.silentCueCount}\n- Clipped cues: ${report.clippedCueCount}\n- Audition reel: \`${report.reelFile}\` (vault QA artifact, intentionally not committed)\n- Reel duration: ${report.durationSeconds}s\n- SHA-256: \`${report.reelSha256}\`\n\nThe deterministic reel renders every registry cue with the same waveform and frequency model used by the browser fallback. This certificate proves technical audibility and headroom. Subjective mix approval remains a human sign-off.\n`);
  return { report, reelPath, jsonPath, mdPath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = buildAudioAudition();
  console.log(`Audio audition ${result.report.status}: ${result.report.cueCount} cues, ${result.report.signatureCount} signatures, ${result.report.silentCueCount} silent, ${result.report.clippedCueCount} clipped.`);
  console.log(`Reel: ${result.reelPath}`);
  console.log(`Certificate: ${result.jsonPath}`);
  if (result.report.status !== 'PASS') process.exitCode = 1;
}

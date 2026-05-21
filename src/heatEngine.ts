import type { HeatLevel, RollingWindow, SignalSnapshot } from './types.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function computeHeat(window: RollingWindow): SignalSnapshot {
  const now = Date.now();

  const reportSpike = safeScore(() => computeReportSpike(window.reportTimestamps, now));
  const removalSurge = safeScore(() => computeRemovalSurge(window, now));
  const newAccountFlood = safeScore(() => computeNewAccountFlood(window, now));
  const velocitySpike = safeScore(() => computeVelocitySpike(window.commentTimestamps, now));
  const controversyCluster = safeScore(() => computeControversyCluster(window.controversialPosts, now));
  const total = clampScore(reportSpike + removalSurge + newAccountFlood + velocitySpike + controversyCluster, 100);

  return {
    reportSpike,
    removalSurge,
    newAccountFlood,
    velocitySpike,
    controversyCluster,
    total,
    level: getHeatLevel(total),
    computedAt: now,
  };
}

export function getHeatLevel(score: number): HeatLevel {
  if (score <= 30) return 'cool';
  if (score <= 55) return 'warming';
  if (score <= 74) return 'hot';
  return 'ember';
}

function computeReportSpike(reportTimestamps: number[], now: number): number {
  const baselineStart = now - 7 * DAY;
  const baselineReports = reportTimestamps.filter((timestamp) => timestamp >= baselineStart);
  const baselineHours = Math.max(1, (now - baselineStart) / HOUR);
  const avgRate = baselineReports.length / baselineHours;
  if (avgRate === 0 || baselineReports.length < 24) return 0;

  const currentRate = baselineReports.filter((timestamp) => timestamp >= now - HOUR).length;
  return clampScore((currentRate / avgRate - 1) * 30, 30);
}

function computeRemovalSurge(window: RollingWindow, now: number): number {
  const since = now - 30 * MINUTE;
  const removals = window.removalTimestamps.filter((timestamp) => timestamp >= since).length;
  const comments = window.commentTimestamps.filter((timestamp) => timestamp >= since).length;
  if (comments === 0) return 0;

  const removalRatio = removals / comments;
  return clampScore(removalRatio * 100, 25);
}

function computeNewAccountFlood(window: RollingWindow, now: number): number {
  const since = now - 20 * MINUTE;
  const newAccountComments = window.newAccountComments.filter((timestamp) => timestamp >= since).length;
  const comments = window.commentTimestamps.filter((timestamp) => timestamp >= since).length;
  if (comments === 0) return 0;

  const newAccountPct = (newAccountComments / comments) * 100;
  return clampScore(newAccountPct * 0.4, 20);
}

function computeVelocitySpike(commentTimestamps: number[], now: number): number {
  const baselineStart = now - 7 * DAY;
  const baselineComments = commentTimestamps.filter((timestamp) => timestamp >= baselineStart);
  const baselineMinutes = Math.max(1, (now - baselineStart) / MINUTE);
  const avgCPM = baselineComments.length / baselineMinutes;
  if (avgCPM === 0 || baselineComments.length < 100) return 0;

  const currentCPM = baselineComments.filter((timestamp) => timestamp >= now - 10 * MINUTE).length / 10;
  return clampScore((currentCPM / avgCPM - 1) * 15, 15);
}

function computeControversyCluster(controversialPosts: number[], now: number): number {
  const recentCount = controversialPosts.filter((timestamp) => timestamp >= now - HOUR).length;
  return clampScore(recentCount * 2, 10);
}

function safeScore(compute: () => number): number {
  try {
    return compute();
  } catch (error) {
    console.error('[Ember] heatEngine signal failed:', error);
    return 0;
  }
}

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, Math.round(value));
}


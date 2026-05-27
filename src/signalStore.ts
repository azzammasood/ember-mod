import type { AlertRecord, EmberConfig, EmberSettings, RollingWindow, SignalSnapshot } from './types.js';

const WINDOW_KEY = 'ember:window';
const SNAPSHOT_KEY = 'ember:snapshot';
const SNAPSHOT_HISTORY_KEY = 'ember:snapshotHistory';
const LAST_ALERT_KEY = 'ember:lastAlert';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function emptyWindow(): RollingWindow {
  return {
    reportTimestamps: [],
    commentTimestamps: [],
    removalTimestamps: [],
    newAccountComments: [],
    controversialPosts: [],
  };
}

export async function getWindow(kvStore: any): Promise<RollingWindow> {
  try {
    const raw = await kvStore.get(WINDOW_KEY);
    if (typeof raw !== 'string') return emptyWindow();
    const parsed = JSON.parse(raw) as Partial<RollingWindow>;
    return {
      reportTimestamps: ensureNumberArray(parsed.reportTimestamps),
      commentTimestamps: ensureNumberArray(parsed.commentTimestamps),
      removalTimestamps: ensureNumberArray(parsed.removalTimestamps),
      newAccountComments: ensureNumberArray(parsed.newAccountComments),
      controversialPosts: ensureNumberArray(parsed.controversialPosts),
    };
  } catch (error) {
    console.error('[Ember] signalStore.getWindow failed:', error);
    return emptyWindow();
  }
}

export async function saveWindow(kvStore: any, window: RollingWindow): Promise<void> {
  try {
    const trimmed = trimWindow(window, Date.now());
    await kvStore.put(WINDOW_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[Ember] signalStore.saveWindow failed:', error);
  }
}

export async function getSnapshot(kvStore: any): Promise<SignalSnapshot | null> {
  try {
    const raw = await kvStore.get(SNAPSHOT_KEY);
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw) as SignalSnapshot;
  } catch (error) {
    console.error('[Ember] signalStore.getSnapshot failed:', error);
    return null;
  }
}

export async function saveSnapshot(kvStore: any, snap: SignalSnapshot): Promise<void> {
  try {
    await kvStore.put(SNAPSHOT_KEY, JSON.stringify(snap));
    await appendSnapshotHistory(kvStore, snap);
  } catch (error) {
    console.error('[Ember] signalStore.saveSnapshot failed:', error);
  }
}

export async function getSnapshotHistory(kvStore: any): Promise<SignalSnapshot[]> {
  try {
    const raw = await kvStore.get(SNAPSHOT_HISTORY_KEY);
    if (typeof raw !== 'string') return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSignalSnapshot).slice(-12);
  } catch (error) {
    console.error('[Ember] signalStore.getSnapshotHistory failed:', error);
    return [];
  }
}

export async function saveSnapshotHistory(kvStore: any, history: SignalSnapshot[]): Promise<void> {
  try {
    const next = history.filter(isSignalSnapshot).slice(-12);
    await kvStore.put(SNAPSHOT_HISTORY_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('[Ember] signalStore.saveSnapshotHistory failed:', error);
  }
}

export async function getLastAlert(kvStore: any): Promise<AlertRecord | null> {
  try {
    const raw = await kvStore.get(LAST_ALERT_KEY);
    if (typeof raw !== 'string') return null;
    return JSON.parse(raw) as AlertRecord;
  } catch (error) {
    console.error('[Ember] signalStore.getLastAlert failed:', error);
    return null;
  }
}

export async function saveLastAlert(kvStore: any, alert: AlertRecord): Promise<void> {
  try {
    await kvStore.put(LAST_ALERT_KEY, JSON.stringify(alert));
  } catch (error) {
    console.error('[Ember] signalStore.saveLastAlert failed:', error);
  }
}

export async function getConfig(_kvStore: any, settings: EmberSettings): Promise<EmberConfig> {
  try {
    return {
      alertThreshold: clampNumber(settings['alert-threshold'], 60, 0, 100),
      alertCooldownMinutes: clampNumber(settings['alert-cooldown-minutes'], 30, 5, 360),
      scanIntervalMinutes: clampNumber(settings['scan-interval-minutes'], 5, 2, 60),
      muteAlerts: settings['mute-alerts'] ?? false,
    };
  } catch (error) {
    console.error('[Ember] signalStore.getConfig failed:', error);
    return {
      alertThreshold: 60,
      alertCooldownMinutes: 30,
      scanIntervalMinutes: 5,
      muteAlerts: false,
    };
  }
}

function trimWindow(window: RollingWindow, now: number): RollingWindow {
  return {
    reportTimestamps: trimSince(window.reportTimestamps, now - 7 * DAY),
    commentTimestamps: trimSince(window.commentTimestamps, now - DAY),
    removalTimestamps: trimSince(window.removalTimestamps, now - 2 * HOUR),
    newAccountComments: trimSince(window.newAccountComments, now - HOUR),
    controversialPosts: trimSince(window.controversialPosts, now - 2 * HOUR),
  };
}

function trimSince(values: number[], minTimestamp: number): number[] {
  return ensureNumberArray(values).filter((timestamp) => timestamp >= minTimestamp);
}

async function appendSnapshotHistory(kvStore: any, snap: SignalSnapshot): Promise<void> {
  try {
    const history = await getSnapshotHistory(kvStore);
    const next = [...history, snap].slice(-12);
    await kvStore.put(SNAPSHOT_HISTORY_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('[Ember] signalStore.appendSnapshotHistory failed:', error);
  }
}

function isSignalSnapshot(value: unknown): value is SignalSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SignalSnapshot>;
  return (
    typeof candidate.total === 'number' &&
    typeof candidate.computedAt === 'number' &&
    typeof candidate.level === 'string'
  );
}

function ensureNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';

import { maybeSendAlert } from './alerter.js';
import {
  renderDashboard,
  renderLoadingDashboard,
  renderSafeDashboardFallback,
} from './dashboard.js';
import type { DashboardChooser, DashboardPanel, DashboardTheme } from './dashboard.js';
import { computeHeat } from './heatEngine.js';
import {
  getConfig,
  getLastAlert,
  getSnapshot,
  getSnapshotHistory,
  saveLastAlert,
  saveSnapshotHistory,
  getWindow,
  saveSnapshot,
  saveWindow,
} from './signalStore.js';
import type { ActivityStats, EmberConfig, EmberSettings, RollingWindow, SignalSnapshot } from './types.js';

const SCAN_JOB = 'ember-scan';
const DAILY_RESET_JOB = 'ember-daily-reset';
const DEFAULT_SCAN_INTERVAL_MINUTES = 5;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * 60 * 60 * 1000;
type RuntimeContext = Pick<
  Context,
  'kvStore' | 'reddit' | 'scheduler' | 'settings' | 'subredditName'
>;

Devvit.configure({
  redditAPI: true,
  kvStore: true,
});

Devvit.addSettings([
  {
    type: 'number',
    name: 'alert-threshold',
    defaultValue: 60,
    label: 'Alert threshold (Heat Score 0-100)',
    helpText: 'Ember sends a modmail alert when the Heat Score exceeds this. Default: 60. Set to 0 to disable alerts.',
  },
  {
    type: 'number',
    name: 'alert-cooldown-minutes',
    defaultValue: 30,
    label: 'Alert cooldown (minutes)',
    helpText: 'Minimum minutes between consecutive alerts. Prevents spam. Default: 30.',
  },
  {
    type: 'number',
    name: 'scan-interval-minutes',
    defaultValue: DEFAULT_SCAN_INTERVAL_MINUTES,
    label: 'Scan interval (minutes)',
    helpText: 'How often Ember checks signals. Lower = faster detection but more KV reads. Default: 5.',
  },
  {
    type: 'boolean',
    name: 'mute-alerts',
    defaultValue: false,
    label: 'Mute all alerts',
    helpText: 'Temporarily silence all Ember modmail alerts. Heat Score still computed.',
  },
]);

Devvit.addTrigger({
  event: 'AppInstall',
  async onEvent(_event, context) {
    await scheduleRecurringJobs(context);
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  async onEvent(_event, context) {
    await scheduleRecurringJobs(context);
  },
});

Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {
    try {
      const now = Date.now();
      const window = await getWindow(context.kvStore);
      window.commentTimestamps.push(now);

      const ratio = getUpvoteRatio(event.post);
      if (typeof ratio === 'number' && ratio < 0.45) {
        window.controversialPosts.push(now);
      }

      await saveWindow(context.kvStore, window);
      await scanAndMaybeAlert(context);
    } catch (error) {
      console.error('[Ember] PostSubmit trigger failed:', error);
    }
  },
});

Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {
    try {
      const now = Date.now();
      const window = await getWindow(context.kvStore);
      window.commentTimestamps.push(now);

      const authorName = getCommentAuthorName(event);
      if (authorName && (await isNewAccount(authorName, context))) {
        window.newAccountComments.push(now);
      }

      await saveWindow(context.kvStore, window);
      await scanAndMaybeAlert(context);
    } catch (error) {
      console.error('[Ember] CommentSubmit trigger failed:', error);
    }
  },
});

Devvit.addTrigger({
  event: 'PostReport',
  async onEvent(_event, context) {
    await recordReport(context, 'post');
  },
});

Devvit.addTrigger({
  event: 'CommentReport',
  async onEvent(_event, context) {
    await recordReport(context, 'comment');
  },
});

Devvit.addTrigger({
  event: 'ModAction',
  async onEvent(event, context) {
    try {
      const action = event.action?.toLowerCase() ?? '';
      if (!['removecomment', 'removelink', 'remove_comment', 'remove_post'].includes(action)) {
        return;
      }

      const window = await getWindow(context.kvStore);
      window.removalTimestamps.push(Date.now());
      await saveWindow(context.kvStore, window);
      await scanAndMaybeAlert(context);
    } catch (error) {
      console.error('[Ember] ModAction trigger failed:', error);
    }
  },
});

Devvit.addSchedulerJob({
  name: SCAN_JOB,
  async onRun(_event, context) {
    await scanAndMaybeAlert(context);
  },
});

Devvit.addSchedulerJob({
  name: DAILY_RESET_JOB,
  async onRun(_event, context) {
    try {
      const window = await getWindow(context.kvStore);
      await saveWindow(context.kvStore, window);
      console.log('[Ember] daily trim completed');
    } catch (error) {
      console.error('[Ember] daily reset failed:', error);
    }
  },
});

Devvit.addMenuItem({
  label: 'View Ember Dashboard',
  location: 'subreddit',
  forUserType: 'moderator',
  async onPress(_event, context) {
    try {
      const snap = await getSnapshot(context.kvStore);
      const config = await loadConfig(context);
      const history = await getSnapshotHistory(context.kvStore);
      const lastAlert = await getLastAlert(context.kvStore);
      const activity = computeActivityStats(await getWindow(context.kvStore));
      const subreddit = await context.reddit.getCurrentSubreddit();
      context.ui.showToast('Creating Ember dashboard...');
      try {
        await context.reddit.submitPost({
          title: 'Ember Dashboard',
          subredditName: subreddit.name,
          preview: renderDashboard(snap, config, { history, lastAlert, activity }),
          textFallback: { text: 'Ember dashboard requires the Reddit app or web client with Devvit custom posts enabled.' },
        });
      } catch (previewError) {
        console.error('[Ember] rich dashboard preview failed, trying fallback:', previewError);
        await context.reddit.submitPost({
          title: 'Ember Dashboard',
          subredditName: subreddit.name,
          preview: renderSafeDashboardFallback(),
          textFallback: { text: 'Ember dashboard is loading.' },
        });
      }
      context.ui.showToast('Dashboard queued - refresh posts in a few seconds.');
    } catch (error) {
      console.error('[Ember] dashboard menu action failed:', error);
      context.ui.showToast('Ember could not create the dashboard.');
    }
  },
});

Devvit.addMenuItem({
  label: 'Check Heat Now',
  location: 'subreddit',
  forUserType: 'moderator',
  async onPress(_event, context) {
    try {
      const snap = await scanAndMaybeAlert(context);
      context.ui.showToast(`${levelLabel(snap.level)} Heat Score: ${snap.total}/100`);
    } catch (error) {
      console.error('[Ember] check heat menu action failed:', error);
      context.ui.showToast('No data yet - Ember is still warming up.');
    }
  },
});

Devvit.addCustomPostType({
  name: 'Ember Dashboard',
  height: 'tall',
  render: (context) => {
    const [snapState, setSnapState] = context.useState(async (): Promise<any> => {
      return await getSnapshot(context.kvStore);
    });
    const [configState, setConfigState] = context.useState(async (): Promise<any> => {
      return await loadConfig(context);
    });
    const [historyState, setHistoryState] = context.useState(async (): Promise<any> => {
      return await getSnapshotHistory(context.kvStore);
    });
    const [lastAlertState, setLastAlertState] = context.useState(async (): Promise<any> => {
      return await getLastAlert(context.kvStore);
    });
    const [activityState, setActivityState] = context.useState(async (): Promise<any> => {
      return computeActivityStats(await getWindow(context.kvStore));
    });
    const [theme, setTheme] = context.useState<DashboardTheme>('ember');
    const [panel, setPanel] = context.useState<DashboardPanel>('trend');
    const [chooser, setChooser] = context.useState<DashboardChooser>('none');

    const snap = snapState as SignalSnapshot | null;
    const config = configState as EmberConfig | null;
    const history = historyState as SignalSnapshot[];
    const lastAlert = lastAlertState as any;
    const activity = activityState as ActivityStats;
    if (!config) return renderLoadingDashboard();
    return renderDashboard(snap, config, {
      history,
      lastAlert,
      activity,
      theme,
      panel,
      chooser,
      onThemePress: () => setChooser(chooser === 'theme' ? 'none' : 'theme'),
      onPanelPress: () => setChooser(chooser === 'panel' ? 'none' : 'panel'),
      onSettingsPress: () => setChooser('settings'),
      onRefresh: async () => {
        const latestSnap = await scanAndMaybeAlert(context);
        setSnapState(latestSnap);
        setConfigState(await loadConfig(context));
        setHistoryState(await getSnapshotHistory(context.kvStore));
        setLastAlertState(await getLastAlert(context.kvStore));
        setActivityState(computeActivityStats(await getWindow(context.kvStore)));
      },
      onTriggerDemo: async () => {
        const demoSnap = await seedDemoScenario(context);
        setSnapState(demoSnap);
        setConfigState(await loadConfig(context));
        setHistoryState(await getSnapshotHistory(context.kvStore));
        setLastAlertState(await getLastAlert(context.kvStore));
        setActivityState(computeActivityStats(await getWindow(context.kvStore)));
        setPanel('trend');
        setChooser('none');
        context.ui.showToast(`Demo loaded: ${demoSnap.total}/100 heat`);
      },
      onChooseTheme: (nextTheme) => {
        setTheme(nextTheme);
        setChooser('none');
      },
      onChoosePanel: (nextPanel) => {
        setPanel(nextPanel);
        setChooser('none');
      },
      onCloseChooser: () => setChooser('none'),
    });
  },
});

async function recordReport(context: RuntimeContext, targetType: string): Promise<void> {
  try {
    const window = await getWindow(context.kvStore);
    window.reportTimestamps.push(Date.now());
    await saveWindow(context.kvStore, window);
    await scanAndMaybeAlert(context);
    console.log('[Ember] report recorded', { targetType });
  } catch (error) {
    console.error('[Ember] report trigger failed:', error);
  }
}

async function seedDemoScenario(context: Pick<Context, 'kvStore'>): Promise<SignalSnapshot> {
  const now = Date.now();
  const window = buildDemoWindow(now);
  const snapshot = computeHeat(window);
  const history = buildDemoHistory(now);

  await saveWindow(context.kvStore, window);
  await saveSnapshotHistory(context.kvStore, history);
  await saveSnapshot(context.kvStore, snapshot);
  await saveLastAlert(context.kvStore, {
    firedAt: now - 6 * MINUTE,
    heatScore: snapshot.total,
    level: snapshot.level,
    snapshot,
  });

  return snapshot;
}

async function scanAndMaybeAlert(context: RuntimeContext): Promise<SignalSnapshot> {
  try {
    const window = await getWindow(context.kvStore);
    const snap = computeHeat(window);
    await saveSnapshot(context.kvStore, snap);

    const config = await loadConfig(context);
    const subredditName = await getSubredditName(context);
    await maybeSendAlert(snap, config, context.kvStore, context.reddit, subredditName);

    console.log('[Ember] heat scan completed', {
      heatScore: snap.total,
      level: snap.level,
      reportSpike: snap.reportSpike,
      removalSurge: snap.removalSurge,
      newAccountFlood: snap.newAccountFlood,
      velocitySpike: snap.velocitySpike,
      controversyCluster: snap.controversyCluster,
    });

    return snap;
  } catch (error) {
    console.error('[Ember] scan failed:', error);
    const fallback = computeHeat(emptyRuntimeWindow());
    await saveSnapshot(context.kvStore, fallback);
    return fallback;
  }
}

async function scheduleRecurringJobs(context: RuntimeContext): Promise<void> {
  try {
    const config = await loadConfig(context);
    const interval = config.scanIntervalMinutes || DEFAULT_SCAN_INTERVAL_MINUTES;
    const jobs = await context.scheduler.listJobs();

    for (const job of jobs) {
      if (job.name === SCAN_JOB || job.name === DAILY_RESET_JOB) {
        try {
          await context.scheduler.cancelJob(job.id);
        } catch (error) {
          console.error('[Ember] failed to cancel existing job:', { jobName: job.name, error });
        }
      }
    }

    await context.scheduler.runJob({
      name: SCAN_JOB,
      cron: `*/${interval} * * * *`,
    });
    await context.scheduler.runJob({
      name: DAILY_RESET_JOB,
      cron: '0 3 * * *',
    });

    console.log('[Ember] scheduled recurring jobs', { scanCron: `*/${interval} * * * *` });
  } catch (error) {
    console.error('[Ember] failed to schedule recurring jobs:', error);
  }
}

async function loadConfig(context: Pick<RuntimeContext, 'kvStore' | 'settings'>): Promise<EmberConfig> {
  try {
    const settings = await context.settings.getAll<EmberSettings>();
    return await getConfig(context.kvStore, settings);
  } catch (error) {
    console.error('[Ember] failed to load config:', error);
    return {
      alertThreshold: 60,
      alertCooldownMinutes: 30,
      scanIntervalMinutes: DEFAULT_SCAN_INTERVAL_MINUTES,
      muteAlerts: false,
    };
  }
}

async function getSubredditName(context: Pick<RuntimeContext, 'reddit' | 'subredditName'>): Promise<string> {
  try {
    if (context.subredditName) return context.subredditName;
    const subreddit = await context.reddit.getCurrentSubreddit();
    return subreddit.name;
  } catch (error) {
    console.error('[Ember] failed to get subreddit name:', error);
    return '';
  }
}

async function isNewAccount(username: string, context: Pick<RuntimeContext, 'reddit'>): Promise<boolean> {
  try {
    const user = await context.reddit.getUserByUsername(username);
    if (!user) return false;
    const createdAt = user.createdAt?.getTime();
    if (!createdAt) return false;
    return Date.now() - createdAt < 30 * DAY;
  } catch (error) {
    console.error('[Ember] failed to check account age:', { username, error });
    return false;
  }
}

function getCommentAuthorName(event: unknown): string | undefined {
  const typed = event as {
    author?: { name?: string };
    comment?: { authorName?: string; author?: string };
  };
  return typed.author?.name || typed.comment?.authorName || typed.comment?.author;
}

function getUpvoteRatio(post: unknown): number | null {
  const runtimePost = post as { upvoteRatio?: number; upvote_ratio?: number };
  const ratio = runtimePost.upvoteRatio ?? runtimePost.upvote_ratio;
  return typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : null;
}

function levelLabel(level: SignalSnapshot['level']): string {
  if (level === 'cool') return 'Cool';
  if (level === 'warming') return 'Warming';
  if (level === 'hot') return 'Hot';
  return 'Ember';
}

function emptyRuntimeWindow(): RollingWindow {
  return {
    reportTimestamps: [],
    commentTimestamps: [],
    removalTimestamps: [],
    newAccountComments: [],
    controversialPosts: [],
  };
}

function buildDemoWindow(now: number): RollingWindow {
  const commentTimestamps = [
    ...Array.from({ length: 104 }, (_, index) => now - 23 * HOUR + index * 13 * MINUTE),
    now - 9 * MINUTE,
    now - 8 * MINUTE,
    now - 7 * MINUTE,
    now - 6 * MINUTE,
    now - 5 * MINUTE,
    now - 4 * MINUTE,
    now - 3 * MINUTE,
  ];

  const reportTimestamps = [
    ...Array.from({ length: 24 }, (_, index) => now - 6 * DAY + index * 6 * HOUR),
    now - 48 * MINUTE,
    now - 40 * MINUTE,
    now - 29 * MINUTE,
    now - 18 * MINUTE,
    now - 7 * MINUTE,
  ];

  return {
    reportTimestamps,
    commentTimestamps,
    removalTimestamps: [now - 7 * MINUTE, now - 5 * MINUTE, now - 2 * MINUTE],
    newAccountComments: [now - 8 * MINUTE, now - 5 * MINUTE, now - 3 * MINUTE],
    controversialPosts: [now - 42 * MINUTE, now - 19 * MINUTE, now - 6 * MINUTE],
  };
}

function buildDemoHistory(now: number): SignalSnapshot[] {
  const totals = [8, 12, 18, 29, 43, 58, 71];
  return totals.map((total, index) => ({
    reportSpike: Math.max(0, Math.min(30, Math.round(total * 0.26))),
    removalSurge: Math.max(0, Math.min(25, Math.round(total * 0.2))),
    newAccountFlood: Math.max(0, Math.min(20, Math.round(total * 0.17))),
    velocitySpike: Math.max(0, Math.min(15, Math.round(total * 0.14))),
    controversyCluster: Math.max(0, Math.min(10, Math.round(total * 0.09))),
    total,
    level: total <= 30 ? 'cool' : total <= 55 ? 'warming' : total <= 74 ? 'hot' : 'ember',
    computedAt: now - (totals.length - index) * 3 * MINUTE,
  }));
}

function computeActivityStats(window: RollingWindow): ActivityStats {
  const now = Date.now();
  return {
    comments10m: countSince(window.commentTimestamps, now - 10 * 60 * 1000),
    comments30m: countSince(window.commentTimestamps, now - 30 * 60 * 1000),
    comments24h: countSince(window.commentTimestamps, now - DAY),
    removals30m: countSince(window.removalTimestamps, now - 30 * 60 * 1000),
    reports60m: countSince(window.reportTimestamps, now - 60 * 60 * 1000),
    newAccounts20m: countSince(window.newAccountComments, now - 20 * 60 * 1000),
    controversial60m: countSince(window.controversialPosts, now - 60 * 60 * 1000),
  };
}

function countSince(timestamps: number[], since: number): number {
  return timestamps.filter((timestamp) => timestamp >= since).length;
}

export default Devvit;

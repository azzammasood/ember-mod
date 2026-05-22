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
  getWindow,
  saveSnapshot,
  saveWindow,
} from './signalStore.js';
import type { EmberConfig, EmberSettings, RollingWindow, SignalSnapshot } from './types.js';

const SCAN_JOB = 'ember-scan';
const DAILY_RESET_JOB = 'ember-daily-reset';
const DEFAULT_SCAN_INTERVAL_MINUTES = 5;
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
      const subreddit = await context.reddit.getCurrentSubreddit();
      context.ui.showToast('Creating Ember dashboard...');
      try {
        await context.reddit.submitPost({
          title: `Ember Dashboard - ${subreddit.name}`,
          subredditName: subreddit.name,
          preview: renderDashboard(snap, config, { history, lastAlert }),
          textFallback: { text: 'Ember dashboard requires the Reddit app or web client with Devvit custom posts enabled.' },
        });
      } catch (previewError) {
        console.error('[Ember] rich dashboard preview failed, trying fallback:', previewError);
        await context.reddit.submitPost({
          title: `Ember Dashboard - ${subreddit.name}`,
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
  height: 'regular',
  render: (context) => {
    const [snapState] = context.useState(async (): Promise<any> => {
      return await getSnapshot(context.kvStore);
    });
    const [configState] = context.useState(async (): Promise<any> => {
      return await loadConfig(context);
    });
    const [historyState] = context.useState(async (): Promise<any> => {
      return await getSnapshotHistory(context.kvStore);
    });
    const [lastAlertState] = context.useState(async (): Promise<any> => {
      return await getLastAlert(context.kvStore);
    });
    const [theme, setTheme] = context.useState<DashboardTheme>('ember');
    const [panel, setPanel] = context.useState<DashboardPanel>('trend');
    const [chooser, setChooser] = context.useState<DashboardChooser>('none');

    const snap = snapState as SignalSnapshot | null;
    const config = configState as EmberConfig | null;
    const history = historyState as SignalSnapshot[];
    const lastAlert = lastAlertState as any;
    if (!config) return renderLoadingDashboard();
    return renderDashboard(snap, config, {
      history,
      lastAlert,
      theme,
      panel,
      chooser,
      onThemePress: () => setChooser(chooser === 'theme' ? 'none' : 'theme'),
      onPanelPress: () => setChooser(chooser === 'panel' ? 'none' : 'panel'),
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

export default Devvit;

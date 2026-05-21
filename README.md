# 🔥 Ember — Community Heat Monitor

> "Ember spots the spark before your community catches fire."

Ember is a proactive Devvit moderation app for Reddit communities. Instead of waiting for a thread to fully explode, Ember watches live moderation signals and computes a 0-100 Heat Score for the subreddit.

## What It Does

Ember collects subreddit activity signals from Devvit triggers and stores only timestamped moderation metadata in per-subreddit Devvit KV Store. Every scan computes the current Heat Score and, when the score crosses the configured threshold, sends a moderator-only Modmail alert with a clear signal breakdown and suggested next steps.

The app is designed for human-in-the-loop moderation. Ember does not remove posts, ban users, or send user-visible replies. It alerts moderators before a small spark becomes a larger community fire.

## How the Heat Score Works

| Signal | What it detects | Max points | Why it matters |
|---|---:|---:|---|
| Report spike | Reports in the last hour vs. rolling baseline | 30 | Sudden report bursts often mean a thread is deteriorating. |
| Removal surge | Recent removals vs. recent comments | 25 | A high removal ratio means mods or automations are already intervening. |
| New account flood | New-account commenters in the last 20 minutes | 20 | Helps identify brigading or outside attention. |
| Velocity spike | Current comments per minute vs. baseline | 15 | Fast-moving threads become harder to moderate manually. |
| Controversy cluster | Posts with very low vote ratio | 10 | Several controversial posts at once can signal community tension. |

## Heat Levels

| Score | Level | Suggested action |
|---:|---|---|
| 0-30 | 🟢 Cool | Normal activity. |
| 31-55 | 🟡 Warming | Keep an eye on active threads. |
| 56-74 | 🟠 Hot | Review reports and monitor closely. |
| 75-100 | 🔴 Ember | Consider active intervention. |

## Installation

1. Open the Ember app page on developers.reddit.com.
2. Click **Install**.
3. Select the subreddit where you are a moderator.
4. Open **Mod Tools > Apps > Ember** and review the settings.
5. Use the subreddit mod menu action **View Ember Dashboard** to create a live dashboard post.

## Settings

| Setting | Description | Default |
|---|---|---:|
| Alert threshold | Sends a Modmail alert when Heat Score reaches this value. Set to 0 to disable alerts. | 60 |
| Alert cooldown | Minimum time between alerts. | 30 minutes |
| Scan interval | How often the scheduled scanner recomputes the score. | 5 minutes |
| Mute all alerts | Silences Modmail alerts while still computing scores. | Off |

## How Alerts Work

Ember sends a moderator-only Modmail conversation when the Heat Score is at or above the configured alert threshold and the cooldown has expired. The alert includes the total score, heat level, a five-signal breakdown, detection time, and suggested moderator actions.

## Dashboard

Moderators can create an Ember dashboard from the subreddit menu with **View Ember Dashboard**. The dashboard is a Devvit custom post with:

- a large Heat Score gauge,
- five signal cards,
- current threshold,
- last updated time,
- a baseline status indicator.

## Privacy & Data

Ember uses only Reddit Devvit, Reddit API events, and Devvit KV Store. No external servers, no paid APIs, and no AI APIs are used. Data stays within Reddit/Devvit infrastructure and is limited to rolling timestamp arrays and the latest computed score.

## Known Behavior

The report spike and velocity signals need baseline data before they become meaningful. During the first few days, those signals may show 0 while Ember builds history.

## Links

- Devvit app: https://developers.reddit.com/apps/ember-mod
- GitHub repository: https://github.com/azzammasood/ember-mod

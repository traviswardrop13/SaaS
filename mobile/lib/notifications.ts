/**
 * Local daily practice reminder — the retention nudge. Dynamically requires
 * expo-notifications so the bundle still loads if it isn't installed (calls
 * become graceful no-ops). Schedules one repeating daily notification with
 * a warm, sleeping-Leo-flavored message.
 */
let mod: any = null;
let tried = false;
function n(): any {
  if (tried) return mod;
  tried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-notifications");
  } catch {
    mod = null;
  }
  return mod;
}

const REMINDER_ID = "sona-daily-reminder";

export function notificationsSupported(): boolean {
  return n() != null;
}

/** Ask for permission. Returns true if we may post notifications. */
export async function requestNotifPermission(): Promise<boolean> {
  const m = n();
  if (!m) return false;
  try {
    const cur = await m.getPermissionsAsync();
    if (cur?.granted) return true;
    const req = await m.requestPermissionsAsync();
    return !!req?.granted;
  } catch {
    return false;
  }
}

const MESSAGES = (name: string) => [
  { title: "Leo misses you! 🦁", body: `${name}, come practice your sounds!` },
  { title: "Time to practice 🌟", body: `Leo is waiting for ${name} — just a few minutes!` },
  { title: "Keep your streak! 🔥", body: `Don't let the streak sleep — ${name}, let's go!` },
];

/**
 * Schedule (or reschedule) the daily reminder at the given local time.
 * Returns true on success.
 */
export async function scheduleDailyReminder(
  childName: string,
  hour = 17,
  minute = 0,
): Promise<boolean> {
  const m = n();
  if (!m) return false;
  try {
    await cancelDailyReminder();
    const pick = MESSAGES(childName)[Math.floor(Math.random() * 3)];
    const TT = m.SchedulableTriggerInputTypes;
    const trigger = TT?.DAILY
      ? { type: TT.DAILY, hour, minute }
      : { hour, minute, repeats: true };
    await m.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: pick.title, body: pick.body, sound: true },
      trigger,
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  const m = n();
  if (!m) return;
  try {
    await m.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // ignore
  }
}

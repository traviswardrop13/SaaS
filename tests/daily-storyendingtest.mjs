// Keep the actual narrated final-route regression separate from the broad
// Trainline battery; its existing physical driver is shared, never copied.
process.env.DAILY_TRAINLINE_ENDING='1';
await import('./daily-trainlinetest.mjs');

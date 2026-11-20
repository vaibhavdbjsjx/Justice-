// The local backend with longer pauses before AI results, so a Live Activity can
// be watched (and photographed) in the Dynamic Island and on the Lock Screen
// while a document is being read. Development and testing only.
process.env.LOCAL_AI_ANALYSIS_DELAY_MS ??= "30000";
process.env.LOCAL_AI_DELAY_MS ??= "1500";
await import("./local-backend.mjs");

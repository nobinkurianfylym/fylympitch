// OpenNext / Cloudflare configuration.
//
// Without an incrementalCache, OpenNext serves every route as plain SSR:
// revalidate and unstable_cache have nowhere to persist, so they quietly do
// nothing. That is the state this project was in — the scaffold file shipped
// with r2IncrementalCache commented out and was never revisited.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // Handles the background refresh when a cached entry goes stale, so a
  // visitor who lands on a stale entry is served it immediately rather than
  // waiting for the regeneration.
  queue: doQueue,
});

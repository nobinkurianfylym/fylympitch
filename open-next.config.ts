// OpenNext / Cloudflare configuration.
//
// Without an incrementalCache, OpenNext serves every route as plain SSR:
// revalidate and unstable_cache have nowhere to persist, so they quietly do
// nothing. That is the state this project was in — the scaffold file shipped
// with r2IncrementalCache commented out and was never revisited.
//
// R2 alone made every cache HIT a round trip to the bucket, and a homepage
// render reads a dozen cached entries across three levels of the component
// tree. withRegionalCache puts the Cloudflare Cache API in front of R2: a hit
// is answered from the data centre serving the request, and R2 is re-read in
// the background (after the response) to keep that copy current. Entries
// still go stale on their own revalidate time exactly as before, because the
// regional copy carries R2's lastModified with it.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
  // Handles the background refresh when a cached entry goes stale, so a
  // visitor who lands on a stale entry is served it immediately rather than
  // waiting for the regeneration.
  queue: doQueue,
});

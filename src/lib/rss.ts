// Compatibility shim — vault's homepage imports from @lib/rss.
// Bridges vault's naming (fetchPodcastEpisodes/fetchSubstackEditions)
// to our split lib files (getPodcastEpisodes/getSubstackPosts).

import { getPodcastEpisodes, type PodcastEpisode } from "./podcast-rss";
import { getSubstackPosts, type SubstackPost } from "./substack";

const PODCAST_FEED_URL = import.meta.env.PUBLIC_PODCAST_RSS_URL ?? "";
const SUBSTACK_URL =
  import.meta.env.PUBLIC_SUBSTACK_URL ??
  "https://productimpactpod.substack.com";

export async function fetchPodcastEpisodes(count = 12): Promise<PodcastEpisode[]> {
  const result = await getPodcastEpisodes(PODCAST_FEED_URL, count);
  return result.episodes;
}

export async function fetchSubstackEditions(count = 3): Promise<SubstackPost[]> {
  return getSubstackPosts(SUBSTACK_URL, count);
}

export type { PodcastEpisode, SubstackPost };

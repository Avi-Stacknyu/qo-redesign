/**
 * News remote — fetches and normalizes RSS feeds from multiple finance sources.
 * Runs server-side so no CORS issues. Parses XML with regex (CF Workers compatible).
 */

import { query } from '$app/server';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description: string;
  thumbnail?: string;
}

// ── RSS Feed Sources ─────────────────────────────────────────────────────────

const RSS_FEEDS = [
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories', source: 'MarketWatch' },
  {
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    source: 'BBC Business'
  }
];

// ── XML Parsing (regex, CF Workers compatible) ───────────────────────────────

/** Decode common HTML/XML entities that appear in RSS feeds. */
function decodeEntities(str: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'"
  };
  return str
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => named[m] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function parseRSSItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  const attr = (tagText: string, name: string): string => {
    const m = tagText.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
    return m?.[1]?.trim() ?? '';
  };

  const firstTag = (block: string, name: string): string => {
    return block.match(new RegExp(`<${name}\\b[^>]*>`, 'i'))?.[0] ?? '';
  };

  const thumbnailFrom = (block: string, rawDescription: string): string | undefined => {
    const mediaThumbnail = attr(firstTag(block, 'media:thumbnail'), 'url');
    const mediaContent = attr(firstTag(block, 'media:content'), 'url');
    const enclosure = firstTag(block, 'enclosure');
    const enclosureType = attr(enclosure, 'type');
    const enclosureUrl =
      !enclosureType || enclosureType.startsWith('image/') ? attr(enclosure, 'url') : '';
    const descriptionImage = rawDescription.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] ?? '';

    const url = mediaThumbnail || mediaContent || enclosureUrl || descriptionImage;
    return url ? decodeEntities(url) : undefined;
  };

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const tag = (name: string): string => {
      const m = block.match(
        new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${name}>`, 's')
      );
      return m?.[1]?.trim() ?? '';
    };

    const title = decodeEntities(tag('title'));
    const link = tag('link') || tag('guid');
    const pubDate = tag('pubDate');
    const rawDescription = tag('description');
    const description = decodeEntities(rawDescription.replace(/<[^>]+>/g, '').slice(0, 200));
    const thumbnail = thumbnailFrom(block, rawDescription);

    if (title && link) {
      items.push({
        id: `${source}-${items.length}`,
        title,
        link,
        source,
        pubDate,
        description,
        thumbnail
      });
    }
  }

  return items;
}

// ── Query ────────────────────────────────────────────────────────────────────

export const loadNews = query(async () => {
  const limit = 20;

  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'QuantOrion/2.0 (RSS Reader)' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRSSItems(xml, feed.source);
    })
  );

  const allItems = feedResults
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Sort by pubDate descending, take top N
  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return allItems.slice(0, limit);
});

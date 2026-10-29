// Pulls good-news RSS feeds into data/stories.json. Run: node scripts/fetch-news.mjs  (Node 18+)
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { locate } from './places.mjs';

const FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/' },
  { name: 'Reasons to be Cheerful', url: 'https://reasonstobecheerful.world/feed/' },
  { name: 'The Optimist Daily', url: 'https://www.optimistdaily.com/feed/' },
  { name: 'The Better India', url: 'https://www.thebetterindia.com/feed/' },
  { name: 'Upworthy', url: 'https://www.upworthy.com/feed' },
];


const CATEGORIES = [
  ['animals', /\b(dog|dogs|cat|cats|puppy|rescue[sd]?|wildlife|whale|elephant|bird|birds|panda|turtle|rhino|species|bees?|animal|animals|zoo|tiger|wolf|wolves|otter)\b/i],
  ['planet', /\b(climate|solar|wind|renewable|forest|reef|ocean|recycl\w*|emissions|conservation|rewild\w*|trees?|clean energy|carbon|plastic)\b/i],
  ['health', /\b(cure|cancer|vaccine|health|hospital|patients?|surgery|disease|doctors?|medical|therapy|malaria|treatment|mental)\b/i],
  ['science', /\b(scientists?|researchers?|study|discover\w*|space|nasa|telescope|invent\w*|technology|ai|physics|engineers?)\b/i],
  ['kindness', /\b(kindness|kind|strangers?|generous|donat\w*|gift|surprise[sd]?|volunteers?|neighbou?rs?|community|teacher|students?|grandmother|grandfather|school|reunited|hero)\b/i],
];

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘').replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
  .replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—').replace(/&#8230;|&hellip;/g, '…')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&#8217;/g, "'")
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const shorten = (text, max = 320) => text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

function imageOf(item) {
  const m = item.match(/<media:content[^>]+url="([^"]+)"/i)
    || item.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)
    || item.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
}

async function readFeed(feed) {
  try {
    const res = await fetch(feed.url, { headers: { 'user-agent': 'GoodNewsEverywhere/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(res.status);
    const xml = await res.text();
    return xml.split(/<item[ >]/i).slice(1).map(item => {
      const title = decode(tag(item, 'title'));
      const summary = shorten(decode(tag(item, 'description') || tag(item, 'content:encoded'))
        .replace(/The post .* appeared first on .*$/i, '').replace(/^This article has been published in.*?(\.|$)/i, '').trim());
      const text = `${title}. ${summary}`;
      const { place, lat, lon } = locate(text);
      const category = (CATEGORIES.find(([, re]) => re.test(text)) || ['kindness'])[0];
      const link = decode(tag(item, 'link'));
      return {
        id: createHash('sha1').update(link).digest('hex').slice(0, 10),
        title, summary, url: link, source: feed.name,
        date: new Date(decode(tag(item, 'pubDate')) || Date.now()).toISOString(),
        category, place, lat, lon, image: imageOf(item),
      };
    }).filter(s => s.title && s.url && s.summary.length >= 20).slice(0, 40);
  } catch (err) {
    console.warn(`Skipped ${feed.name}: ${err.message}`);
    return [];
  }
}

const all = (await Promise.all(FEEDS.map(readFeed))).flat();
const seen = new Set();
const stories = all
  .filter(s => !seen.has(s.url) && seen.add(s.url))
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 200);

await mkdir('data', { recursive: true });
await writeFile('data/stories.json', JSON.stringify({ updated: new Date().toISOString(), stories }, null, 2));
console.log(`Wrote ${stories.length} stories (${stories.filter(s => s.lat !== null).length} placed on the map).`);

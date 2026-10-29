// Pulls good-news RSS feeds into data/stories.json. Run: node scripts/fetch-news.mjs  (Node 18+)
import { writeFile, mkdir } from 'node:fs/promises';

const FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/' },
  { name: 'Reasons to be Cheerful', url: 'https://reasonstobecheerful.world/feed/' },
];

// name -> [lat, lon]
const PLACES = {
  'United States': [39, -98], 'U.S.': [39, -98], 'America': [39, -98], 'Canada': [56, -106], 'Mexico': [23, -102],
  'Brazil': [-10, -52], 'Argentina': [-34, -64], 'Chile': [-33, -71], 'Colombia': [4, -73], 'Peru': [-10, -76],
  'Costa Rica': [10, -84], 'Ecuador': [-1, -78], 'United Kingdom': [54, -2], 'Britain': [54, -2], 'England': [52.5, -1.5],
  'Scotland': [56.5, -4], 'Wales': [52, -3.7], 'Ireland': [53, -8], 'France': [46, 2], 'Germany': [51, 10],
  'Spain': [40, -4], 'Portugal': [39.5, -8], 'Italy': [42.5, 12.5], 'Netherlands': [52, 5.5], 'Belgium': [50.6, 4.6],
  'Switzerland': [46.8, 8.2], 'Austria': [47.5, 14.5], 'Poland': [52, 19], 'Sweden': [62, 15], 'Norway': [61, 9],
  'Finland': [64, 26], 'Denmark': [56, 10], 'Iceland': [65, -18], 'Greece': [39, 22], 'Ukraine': [49, 32],
  'Turkey': [39, 35], 'Egypt': [26.5, 30], 'Morocco': [32, -6], 'Kenya': [0.2, 38], 'Ethiopia': [9, 40],
  'Nigeria': [9, 8], 'Ghana': [8, -1.2], 'Uganda': [1.4, 32.3], 'Rwanda': [-2, 29.9], 'Tanzania': [-6.4, 34.9],
  'South Africa': [-29, 24], 'Namibia': [-22, 17], 'Zimbabwe': [-19, 29.2], 'Madagascar': [-19, 47],
  'India': [21, 78], 'Pakistan': [30, 70], 'Bangladesh': [24, 90], 'Nepal': [28, 84], 'Sri Lanka': [7.8, 80.7],
  'China': [35, 103], 'Japan': [36, 138], 'South Korea': [36.5, 128], 'Taiwan': [23.7, 121], 'Thailand': [15, 101],
  'Vietnam': [16, 107], 'Indonesia': [-2, 118], 'Philippines': [12.5, 122], 'Malaysia': [4, 102], 'Singapore': [1.35, 103.8],
  'Australia': [-25, 134], 'New Zealand': [-41, 174], 'Israel': [31.5, 35], 'Saudi Arabia': [24, 45],
  'United Arab Emirates': [24, 54], 'Iran': [32, 53], 'Jordan': [31, 36], 'Kazakhstan': [48, 67], 'Mongolia': [46.8, 103],
};
const COUNTRY_RE = new RegExp(`\\b(${Object.keys(PLACES).map(s => s.replace(/\./g, '\\.')).join('|')})\\b`);

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
      const summary = decode(tag(item, 'description')).replace(/The post .* appeared first on .*$/i, '').trim();
      const text = `${title}. ${summary}`;
      const place = text.match(COUNTRY_RE)?.[1];
      const [lat, lon] = place ? PLACES[place] : [null, null];
      const category = (CATEGORIES.find(([, re]) => re.test(text)) || ['kindness'])[0];
      const link = decode(tag(item, 'link'));
      return {
        id: Buffer.from(link).toString('base64url').slice(-12),
        title, summary, url: link, source: feed.name,
        date: new Date(decode(tag(item, 'pubDate')) || Date.now()).toISOString(),
        category, place: place || null, lat, lon, image: imageOf(item),
      };
    }).filter(s => s.title && s.url);
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
  .slice(0, 120);

await mkdir('data', { recursive: true });
await writeFile('data/stories.json', JSON.stringify({ updated: new Date().toISOString(), stories }, null, 2));
console.log(`Wrote ${stories.length} stories (${stories.filter(s => s.lat !== null).length} placed on the map).`);

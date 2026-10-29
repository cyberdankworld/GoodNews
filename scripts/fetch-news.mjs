// Pulls good-news RSS feeds into data/stories.json. Run: node scripts/fetch-news.mjs  (Node 18+)
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { locate } from './places.mjs';

const FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/' },
  { name: 'Reasons to be Cheerful', url: 'https://reasonstobecheerful.world/feed/' },
  { name: 'The Optimist Daily', url: 'https://www.optimistdaily.com/feed/' },
  { name: 'The Better India', url: 'https://www.thebetterindia.com/feed/' },
];


const CATEGORIES = [
  ['animals', /\b(dogs?|cats?|puppy|puppies|kittens?|wildlife|whales?|elephants?|birds?|pandas?|turtles?|rhinos?|species|bees|animals?|zoo|tigers?|wolf|wolves|otters?|horses?|rescued)\b/i],
  ['planet', /\b(climate|solar|wind power|renewable|forests?|reefs?|oceans?|recycl\w*|emissions|conservation|rewild\w*|trees|clean energy|carbon|plastic|gardens?|gardening|biodiversity|farm\w*)\b/i],
  ['health', /\b(cure|cancer|vaccines?|health|hospitals?|patients?|surgery|disease|doctors?|medical|therapy|malaria|treatment|mental|diabetes|blindness|nurses?|healing|wellbeing|lifesaving|heart|brain|hearing|transplant)\b/i],
  ['science', /\b(scientists?|researchers?|study|discover\w*|space|nasa|telescope|invent\w*|technology|physics|engineers?|astronom\w*|fossil|breakthrough)\b/i],
  ['culture', /\b(art|artists?|museum|festival|tradition\w*|heritage|music\w*|craft\w*|culture|cultural|films?|books?|librar\w*|language|dance|diwali|temple|history|historic|theatre|theater|poet\w*|painting|folk|cuisine|recipes?)\b/i],
  ['kindness', /\b(kindness|kind|strangers?|generous|donat\w*|gift|surprise[sd]?|volunteers?|neighbou?rs?|community|teacher|students?|grandmother|grandfather|school|reunited|hero|helps?|helped|free)\b/i],
];
// Words that don't belong on a good-news site.
const GRIM = /\b(killed|dead|dies|died|death|murder\w*|shooting|shot dead|war|attack\w*|bomb\w*|abuse[sd]?|rape|suicide|crash\w*|terror\w*)\b/i;

/** Topic with the most keyword hits; a hit in the headline counts triple. Falls back to kindness. */
function categorise(title, summary) {
  let best = 'kindness', top = 0;
  for (const [name, re] of CATEGORIES) {
    const score = (title.match(new RegExp(re.source, 'gi'))?.length || 0) * 3 + (summary.match(new RegExp(re.source, 'gi'))?.length || 0);
    if (score > top) { top = score; best = name; }
  }
  return best;
}


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
        .replace(/The post .* appeared first on .*$/i, '').replace(/^This article has been published in.*?(\.|$)/i, '').replace(/^BY (?:[A-Z][A-Z.'’-]*\s+)+/, '').trim());
      // The headline names the story's place; the summary is the next best clue.
      const { place, lat, lon } = locate(title).place ? locate(title) : locate(summary);
      const category = categorise(title, summary);
      const link = decode(tag(item, 'link'));
      return {
        id: createHash('sha1').update(link).digest('hex').slice(0, 10),
        title, summary, url: link, source: feed.name,
        date: new Date(decode(tag(item, 'pubDate')) || Date.now()).toISOString(),
        category, place, lat, lon, image: imageOf(item),
      };
    }).filter(s => s.title && s.url && s.summary.length >= 20 && !GRIM.test(`${s.title} ${s.summary}`)).slice(0, 40);
  } catch (err) {
    console.warn(`Skipped ${feed.name}: ${err.message}`);
    return [];
  }
}

const all = (await Promise.all(FEEDS.map(readFeed))).flat();
const seen = new Set();
const stories = all
  .sort((a, b) => b.date.localeCompare(a.date))
  .filter(s => !seen.has(s.url) && seen.add(s.url))
  // A daily "on this day" post would otherwise fill the feed with near-copies; keep the newest.
  .filter(s => !/^Good News in History/i.test(s.title) || (seen.has('history') ? false : seen.add('history')))
  .slice(0, 200);

const OUT = process.env.DATA_DIR || 'data'; // same variable the server reads
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'stories.json'), JSON.stringify({ updated: new Date().toISOString(), stories }, null, 2));
console.log(`Wrote ${stories.length} stories (${stories.filter(s => s.lat !== null).length} placed on the map).`);

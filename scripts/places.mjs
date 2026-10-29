// Place lookup shared by the news fetcher and the submission server.
// name -> [lat, lon]
const PLACES = {
  'United States': [39, -98], 'U.S.': [39, -98], 'America': [39, -98], 'Canada': [56, -106], 'Mexico': [23, -102],
  'Brazil': [-10, -52], 'Argentina': [-34, -64], 'Chile': [-33, -71], 'Colombia': [4, -73], 'Peru': [-10, -76],
  'Costa Rica': [10, -84], 'Ecuador': [-1, -78], 'United Kingdom': [54, -2], 'Britain': [54, -2], 'England': [52.5, -1.5],
  'Scotland': [56.5, -4], 'Wales': [52, -3.7], 'Ireland': [53, -8], 'France': [46, 2], 'Germany': [51, 10],
  'Spain': [40, -4], 'Portugal': [39.5, -8], 'Italy': [42.5, 12.5], 'Netherlands': [52, 5.5], 'Belgium': [50.6, 4.6],
  'Switzerland': [46.8, 8.2], 'Austria': [47.5, 14.5], 'Poland': [52, 19], 'Sweden': [62, 15], 'Norway': [61, 9],
  'Finland': [64, 26], 'Denmark': [56, 10], 'Iceland': [65, -18], 'Greece': [39, 22], 'Ukraine': [49, 32],
  'Egypt': [26.5, 30], 'Morocco': [32, -6], 'Kenya': [0.2, 38], 'Ethiopia': [9, 40],
  'Nigeria': [9, 8], 'Ghana': [8, -1.2], 'Uganda': [1.4, 32.3], 'Rwanda': [-2, 29.9], 'Tanzania': [-6.4, 34.9],
  'South Africa': [-29, 24], 'Namibia': [-22, 17], 'Zimbabwe': [-19, 29.2], 'Madagascar': [-19, 47],
  'India': [21, 78], 'Pakistan': [30, 70], 'Bangladesh': [24, 90], 'Nepal': [28, 84], 'Sri Lanka': [7.8, 80.7],
  'China': [35, 103], 'Japan': [36, 138], 'South Korea': [36.5, 128], 'Taiwan': [23.7, 121], 'Thailand': [15, 101],
  'Vietnam': [16, 107], 'Indonesia': [-2, 118], 'Philippines': [12.5, 122], 'Malaysia': [4, 102], 'Singapore': [1.35, 103.8],
  'Australia': [-25, 134], 'New Zealand': [-41, 174], 'Israel': [31.5, 35], 'Saudi Arabia': [24, 45],
  'United Arab Emirates': [24, 54], 'Iran': [32, 53], 'Kazakhstan': [48, 67], 'Mongolia': [46.8, 103],
};

const CITIES = `London|51.5|-0.12|UK;Manchester|53.48|-2.24|UK;Liverpool|53.4|-3|UK;Glasgow|55.86|-4.25|UK;Edinburgh|55.95|-3.19|UK;Bristol|51.45|-2.58|UK;Leeds|53.8|-1.55|UK;Birmingham|52.48|-1.9|UK;Cardiff|51.48|-3.18|UK;Belfast|54.6|-5.93|UK;Dublin|53.35|-6.26|Ireland;
Paris|48.86|2.35|France;Berlin|52.52|13.4|Germany;Munich|48.14|11.58|Germany;Hamburg|53.55|10|Germany;Madrid|40.42|-3.7|Spain;Barcelona|41.39|2.17|Spain;Lisbon|38.72|-9.14|Portugal;Rome|41.9|12.5|Italy;Milan|45.46|9.19|Italy;Amsterdam|52.37|4.9|Netherlands;Brussels|50.85|4.35|Belgium;Zurich|47.37|8.54|Switzerland;Vienna|48.21|16.37|Austria;Prague|50.08|14.44|Czechia;Warsaw|52.23|21|Poland;Stockholm|59.33|18.07|Sweden;Oslo|59.91|10.75|Norway;Copenhagen|55.68|12.57|Denmark;Helsinki|60.17|24.94|Finland;Reykjavik|64.15|-21.94|Iceland;Athens|37.98|23.73|Greece;Kyiv|50.45|30.52|Ukraine;Istanbul|41.01|28.98|Turkey;
New York|40.71|-74.01|USA;Los Angeles|34.05|-118.24|USA;San Francisco|37.77|-122.42|USA;Seattle|47.61|-122.33|USA;Portland|45.52|-122.68|USA;Chicago|41.88|-87.63|USA;Boston|42.36|-71.06|USA;Philadelphia|39.95|-75.17|USA;Atlanta|33.75|-84.39|USA;Miami|25.76|-80.19|USA;Houston|29.76|-95.37|USA;Dallas|32.78|-96.8|USA;Denver|39.74|-104.99|USA;Phoenix|33.45|-112.07|USA;Detroit|42.33|-83.05|USA;Minneapolis|44.98|-93.27|USA;New Orleans|29.95|-90.07|USA;Nashville|36.16|-86.78|USA;Honolulu|21.31|-157.86|USA;Alaska|64.2|-149.5|USA;Texas|31|-100|USA;California|37|-120|USA;Florida|28|-82|USA;
Toronto|43.65|-79.38|Canada;Vancouver|49.28|-123.12|Canada;Montreal|45.5|-73.57|Canada;Calgary|51.05|-114.07|Canada;Mexico City|19.43|-99.13|Mexico;Havana|23.11|-82.37|Cuba;Bogota|4.71|-74.07|Colombia;Medellin|6.24|-75.58|Colombia;Lima|-12.05|-77.04|Peru;Santiago|-33.45|-70.67|Chile;Buenos Aires|-34.6|-58.38|Argentina;Sao Paulo|-23.55|-46.63|Brazil;Rio de Janeiro|-22.9|-43.17|Brazil;Amazon|-3.5|-62|Brazil;
Cairo|30.04|31.24|Egypt;Lagos|6.52|3.38|Nigeria;Nairobi|-1.29|36.82|Kenya;Addis Ababa|9.03|38.74|Ethiopia;Accra|5.6|-0.19|Ghana;Kampala|0.35|32.58|Uganda;Kigali|-1.95|30.06|Rwanda;Cape Town|-33.92|18.42|South Africa;Johannesburg|-26.2|28.05|South Africa;Dakar|14.72|-17.47|Senegal;Marrakech|31.63|-8|Morocco;
Mumbai|19.08|72.88|India;Delhi|28.61|77.21|India;Bengaluru|12.97|77.59|India;Bangalore|12.97|77.59|India;Chennai|13.08|80.27|India;Kolkata|22.57|88.36|India;Hyderabad|17.39|78.49|India;Pune|18.52|73.86|India;Kerala|10.85|76.27|India;Karachi|24.86|67|Pakistan;Dhaka|23.81|90.41|Bangladesh;Kathmandu|27.72|85.32|Nepal;Colombo|6.93|79.86|Sri Lanka;Beijing|39.9|116.4|China;Shanghai|31.23|121.47|China;Hong Kong|22.32|114.17|China;Tokyo|35.68|139.69|Japan;Kyoto|35.01|135.77|Japan;Osaka|34.69|135.5|Japan;Seoul|37.57|126.98|South Korea;Taipei|25.03|121.57|Taiwan;Bangkok|13.76|100.5|Thailand;Hanoi|21.03|105.85|Vietnam;Jakarta|-6.2|106.85|Indonesia;Bali|-8.4|115.19|Indonesia;Manila|14.6|120.98|Philippines;Kuala Lumpur|3.14|101.69|Malaysia;
Sydney|-33.87|151.21|Australia;Melbourne|-37.81|144.96|Australia;Brisbane|-27.47|153.03|Australia;Perth|-31.95|115.86|Australia;Auckland|-36.85|174.76|New Zealand;Wellington|-41.29|174.78|New Zealand;Dubai|25.2|55.27|UAE;Tel Aviv|32.09|34.78|Israel;Jerusalem|31.77|35.21|Israel;Tehran|35.69|51.39|Iran;Amman|31.95|35.93|Jordan`
  .split(';').map(s => s.trim().split('|')).map(([name, lat, lon, country]) => ({ name, lat: +lat, lon: +lon, country }));

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CITY_RE = new RegExp(`\\b(${CITIES.map(c => esc(c.name)).join('|')})\\b`);
const COUNTRY_RE = new RegExp(`\\b(${Object.keys(PLACES).map(esc).join('|')})\\b`);

/** Finds the most specific place named in a piece of text: a city first, then a country. */
export function locate(text) {
  const city = text.match(CITY_RE)?.[1];
  if (city) {
    const c = CITIES.find(x => x.name === city);
    return { place: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon };
  }
  const country = text.match(COUNTRY_RE)?.[1];
  if (country) return { place: country, lat: PLACES[country][0], lon: PLACES[country][1] };
  return { place: null, lat: null, lon: null };
}

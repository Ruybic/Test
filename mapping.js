import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// --- CREDENTIALS ---
const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const COUNTRY = "IQ"; 
const MODE = "osu"; 

// --- CONFIGURATION ---
const MAX_PAGES = 200; 
const DELAY_BETWEEN_REQUESTS = 1500; // Safe throttling
const DATA_DIR = path.join('data', 'mapping');

// NEW: Opt-out system. Add IDs of people who don't want to be on the Mapping list.
const IGNORED_USER_IDS = [99999999, 88888888]; 

function mkdirp(dir){if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});}
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function getToken(){
  const res = await fetch('https://osu.ppy.sh/oauth/token',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'client_credentials',scope:'public'})
  });
  const data = await res.json();
  return data.access_token;
}

async function main(){
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  
  mkdirp(DATA_DIR);
  let mapperList = [];

  console.log(`📡 Scraping Iraqi player list...`);

  let allUserIds = new Set();
  for(let page = 1; page <= MAX_PAGES; page++) {
    try {
        const res = await fetch(`https://osu.ppy.sh/api/v2/rankings/${MODE}/performance?country=${COUNTRY}&cursor[page]=${page}`, {headers});
        const data = await res.json();
        if (!data.ranking || data.ranking.length === 0) break;
        data.ranking.forEach(u => allUserIds.add(u.user.id));
    } catch (e) { break; }
  }

  // Apply Opt-out Filter
  const filteredUsers = Array.from(allUserIds).filter(id => !IGNORED_USER_IDS.includes(id));
  console.log(`✅ Checking ${filteredUsers.length} players for mapping data...`);

  for (const userId of filteredUsers) {
    try {
      const res = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/${MODE}`, {headers});
      const user = await res.json();

      if (!user.username) continue;

      // STRICT FILTER: Only proceed if they have at least 1 map of any kind
      const rankedCount = user.ranked_and_approved_beatmapset_count || 0;
      const unrankedCount = user.unranked_beatmapset_count || 0;
      const guestCount = user.guest_beatmapset_count || 0;
      const lovedCount = user.loved_beatmapset_count || 0;

      if (rankedCount + unrankedCount + guestCount + lovedCount > 0) {
        console.log(`✨ Adding Mapper: ${user.username}`);
        mapperList.push({
          username: user.username,
          id: user.id,
          avatar: user.avatar_url,
          banner: user.cover_url, // Added banner for the card top
          statistics: {
            ranked_sets: rankedCount,
            unranked_sets: unrankedCount,
            guest_sets: guestCount,
            loved_sets: lovedCount
          }
        });
      }
    } catch (e) { console.error(`Failed ${userId}`); }
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  // Sort by Ranked Sets descending, then by Unranked
  mapperList.sort((a, b) => {
    if (b.statistics.ranked_sets !== a.statistics.ranked_sets) {
        return b.statistics.ranked_sets - a.statistics.ranked_sets;
    }
    return b.statistics.unranked_sets - a.statistics.unranked_sets;
  });

  fs.writeFileSync(path.join(DATA_DIR, 'iraqi_mappers.json'), JSON.stringify({
    last_updated: new Date().toISOString(),
    mappers: mapperList
  }, null, 2));

  console.log(`🚀 Done! Found ${mapperList.length} Iraqi mappers.`);
}

main();


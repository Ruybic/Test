import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// --- CREDENTIALS ---
const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const COUNTRY = "IQ"; 

// --- CONFIGURATION ---
const MODES = ['osu', 'taiko', 'fruits', 'mania']; // Scans all 4 modes
const MAX_PAGES_PER_MODE = 100; // Up to 5000 players per mode
const DELAY_BETWEEN_REQUESTS = 1500; // Mandatory 1.5s delay to protect API limit
const DATA_DIR = path.join('data', 'mapping');

// Opt-out system: Add User IDs here to completely ignore them
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

  let allUserIds = new Set();
  
  // 1. Gather players from ALL 4 MODES
  console.log(`📡 Scraping leaderboards across all 4 modes...`);
  for (const mode of MODES) {
      console.log(`-> Scanning ${mode}...`);
      for(let page = 1; page <= MAX_PAGES_PER_MODE; page++) {
        try {
            const res = await fetch(`https://osu.ppy.sh/api/v2/rankings/${mode}/performance?country=${COUNTRY}&cursor[page]=${page}`, {headers});
            const data = await res.json();
            if (!data.ranking || data.ranking.length === 0) break;
            data.ranking.forEach(u => allUserIds.add(u.user.id));
        } catch (e) { break; }
        await sleep(500); // Small pause between ranking pages
      }
  }

  // Apply Opt-out
  const filteredUsers = Array.from(allUserIds).filter(id => !IGNORED_USER_IDS.includes(id));
  console.log(`✅ Found ${filteredUsers.length} unique players. Checking for maps...`);

  let allMaps = [];

  // 2. Scan Profiles and Extract Maps
  for (const userId of filteredUsers) {
    try {
      // First, check profile to see if they even map (saves API calls)
      const res = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/osu`, {headers});
      const user = await res.json();

      if (!user.username) continue;

      const totalMaps = (user.ranked_and_approved_beatmapset_count || 0) + 
                        (user.unranked_beatmapset_count || 0) + 
                        (user.loved_beatmapset_count || 0);

      if (totalMaps > 0) {
        console.log(`✨ Extracting maps for: ${user.username} (${totalMaps} mapsets)`);
        
        // Map types to fetch
        const mapTypes = ['ranked', 'loved', 'pending', 'graveyard'];
        
        for (const type of mapTypes) {
            const mapRes = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/beatmapsets/${type}?limit=100`, {headers});
            if (!mapRes.ok) continue;
            const maps = await mapRes.json();
            
            maps.forEach(m => {
                allMaps.push({
                    id: m.id,
                    title: m.title,
                    artist: m.artist,
                    creator: m.creator,
                    creator_id: m.user_id,
                    status: type, // ranked, loved, pending, graveyard
                    cover: m.covers.card,
                    playcount: m.play_count,
                    favourite_count: m.favourite_count,
                    bpm: m.bpm,
                    submitted_date: m.submitted_date
                });
            });
            await sleep(DELAY_BETWEEN_REQUESTS);
        }
      } else {
        // If they have 0 maps, we just sleep and move on
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (e) { 
        console.error(`Failed on user ${userId}`); 
        await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // 3. Sort Maps (Newest first, or by playcount. Let's do newest first)
  allMaps.sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date));

  fs.writeFileSync(path.join(DATA_DIR, 'iraqi_maps.json'), JSON.stringify({
    last_updated: new Date().toISOString(),
    total_maps: allMaps.length,
    maps: allMaps
  }, null, 2));

  console.log(`🚀 Done! Extracted ${allMaps.length} maps into iraqi_maps.json.`);
}

main();

import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// --- CREDENTIALS ---
const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const COUNTRY = "IQ"; 

// --- CONFIGURATION ---
const MODES = ['osu', 'taiko', 'fruits', 'mania']; 
const MAX_PAGES_PER_MODE = 200; // API absolute max is 200 pages (10,000 players) per mode
const DELAY_BETWEEN_REQUESTS = 1500; // Mandatory 1.5s delay
const DATA_DIR = path.join('data', 'mapping');

// Anonymize system: Add User IDs here. Their maps will be fetched, but credited to "Anonymous"
const ANONYMIZED_USER_IDS = [99999999, 88888888]; 

function mkdirp(dir){if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});}
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function getToken(){
  const res = await fetch('https://osu.ppy.sh/oauth/token',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'public'
    })
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
  console.log(`📡 Scraping leaderboards across all 4 modes (Up to ${MAX_PAGES_PER_MODE} pages each)...`);
  for (const mode of MODES) {
      console.log(`-> Scanning ${mode}...`);
      for(let page = 1; page <= MAX_PAGES_PER_MODE; page++) {
        try {
            const res = await fetch(`https://osu.ppy.sh/api/v2/rankings/${mode}/performance?country=${COUNTRY}&cursor[page]=${page}`, {headers});
            if (!res.ok) break; // Reached end of available pages
            const data = await res.json();
            if (!data.ranking || data.ranking.length === 0) break;
            data.ranking.forEach(u => allUserIds.add(u.user.id));
        } catch (e) { 
            break; 
        }
        await sleep(500); 
      }
  }

  const usersArray = Array.from(allUserIds);
  console.log(`✅ Found ${usersArray.length} unique players. Checking for maps...`);

  let allMaps = [];

  // 2. Scan Profiles and Extract Maps
  for (let i = 0; i < usersArray.length; i++) {
    const userId = usersArray[i];
    
    try {
      // Check profile first to save massive amounts of API calls
      const res = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/osu`, {headers});
      if (!res.ok) {
          await sleep(DELAY_BETWEEN_REQUESTS);
          continue;
      }
      
      const user = await res.json();
      if (!user.username) continue;

      // Accurately sum all possible map categories
      const totalMaps = (user.ranked_and_approved_beatmapset_count || 0) + 
                        (user.loved_beatmapset_count || 0) + 
                        (user.pending_beatmapset_count || 0) + 
                        (user.graveyard_beatmapset_count || 0);

      if (totalMaps > 0) {
        console.log(`✨ [${i+1}/${usersArray.length}] Extracting maps for: ${user.username} (${totalMaps} mapsets)`);
        
        const mapTypes = ['ranked', 'loved', 'pending', 'graveyard'];
        const isAnonymized = ANONYMIZED_USER_IDS.includes(userId);
        const finalCreatorName = isAnonymized ? 'Anonymous' : user.username;
        
        for (const type of mapTypes) {
            let offset = 0;
            const limit = 100;
            let hasMoreMaps = true;

            // Paginate through categories if they have >100 maps in a specific status
            while (hasMoreMaps) {
                const mapRes = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/beatmapsets/${type}?limit=${limit}&offset=${offset}`, {headers});
                
                if (!mapRes.ok) break;
                
                const maps = await mapRes.json();
                if (!maps || maps.length === 0) break;
                
                maps.forEach(m => {
                    allMaps.push({
                        id: m.id,
                        title: m.title,
                        artist: m.artist,
                        creator: finalCreatorName, // Applies Anonymous check
                        creator_id: m.user_id,
                        status: type, 
                        cover: m.covers.card,
                        playcount: m.play_count,
                        favourite_count: m.favourite_count,
                        bpm: m.bpm,
                        submitted_date: m.submitted_date
                    });
                });

                if (maps.length < limit) {
                    hasMoreMaps = false; // Less than 100 returned, end of list
                } else {
                    offset += limit; // Move forward 100 maps
                }
                
                await sleep(DELAY_BETWEEN_REQUESTS);
            }
        }
      } else {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (e) { 
        console.error(`Failed on user ${userId}`); 
        await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // 3. Sort Maps (Newest first)
  allMaps.sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date));

  // Saving exactly as iraqi_maps.json (Ensure your HTML fetches this exact name!)
  fs.writeFileSync(path.join(DATA_DIR, 'iraqi_maps.json'), JSON.stringify({
    last_updated: new Date().toISOString(),
    total_maps: allMaps.length,
    maps: allMaps
  }, null, 2));

  console.log(`🚀 Done! Extracted ${allMaps.length} maps into iraqi_maps.json.`);
}

main();

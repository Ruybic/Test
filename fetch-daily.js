import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const COUNTRY = "IQ";
const MODE = "osu";

// --- CONFIGURATION ---
const PAGES_TO_SCAN = 4; // 4 pages = Top 200 players. 
const MANUAL_USER_IDS = []; // Add specific IDs here (e.g. [123456, 789101]) to track them regardless of rank.
const DELAY_BETWEEN_BATCHES = 1000; // 1 second pause to stay safe from API bans.

// Helpers
function mkdirp(dir){if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});}
function today(){return new Date().toISOString().split('T')[0];}
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
  const headers = {Authorization:`Bearer ${token}`};

  let allUserIds = new Set(MANUAL_USER_IDS);

  // 1. Get Top Players across multiple pages
  console.log(`📡 Fetching Top ${PAGES_TO_SCAN * 50} players from ${COUNTRY}...`);
  for(let page = 1; page <= PAGES_TO_SCAN; page++) {
    try {
        const rankingRes = await fetch(`https://osu.ppy.sh/api/v2/rankings/${MODE}/performance?country=${COUNTRY}&cursor[page]=${page}`,{headers});
        const rankingData = await rankingRes.json();
        if (rankingData.ranking) {
            rankingData.ranking.forEach(u => allUserIds.add(u.user.id));
        }
    } catch (e) { console.error(`Failed to fetch ranking page ${page}`); }
  }

  const userList = Array.from(allUserIds);
  console.log(`✅ Total players to check: ${userList.length}`);

  let allScores = [];

  // 2. Fetch Recent Scores in Batches (to be fast but safe)
  const BATCH_SIZE = 10;
  for (let i = 0; i < userList.length; i += BATCH_SIZE) {
    const batch = userList.slice(i, i + BATCH_SIZE);
    console.log(`⏳ Checking batch ${i/BATCH_SIZE + 1}...`);

    const batchPromises = batch.map(async (userId) => {
      try {
        const res = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/scores/recent?limit=10&include_fails=0`,{headers});
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        
        return data.map(s => ({
          user: s.user.username,
          user_id: s.user.id,
          country: COUNTRY,
          score_id: s.id,
          rank: s.rank,
          accuracy: s.accuracy,
          pp: s.pp,
          mods: s.mods,
          combo: s.max_combo,
          created_at: s.created_at,
          beatmapset: {
            id: s.beatmapset.id,
            title: s.beatmapset.title,
            cover: s.beatmapset.covers.card
          }
        }));
      } catch (e) { return []; }
    });

    const results = await Promise.all(batchPromises);
    allScores.push(...results.flat());

    // Anti-ban pause
    await sleep(DELAY_BETWEEN_BATCHES);
  }

  // 3. Cleanup & Save
  // Remove duplicates and sort newest first
  const uniqueScores = Array.from(new Map(allScores.map(s => [s.score_id, s])).values());
  uniqueScores.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  const dateParts = today().split('-');
  const dir = path.join('data', dateParts[0], dateParts[1]);
  mkdirp(dir);
  
  fs.writeFileSync(path.join(dir, dateParts[2]+'.json'), JSON.stringify({
    date: today(),
    country: COUNTRY,
    generated_at: new Date().toISOString(),
    scores: uniqueScores
  }, null, 2));

  // Update index.json
  const indexFile = path.join('data','index.json');
  let indexData = { available_dates: [] };
  if(fs.existsSync(indexFile)) indexData = JSON.parse(fs.readFileSync(indexFile));
  if(!indexData.available_dates.includes(today())) {
    indexData.available_dates.push(today());
    indexData.available_dates.sort();
  }
  fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2));

  console.log(`🚀 Done! Archived ${uniqueScores.length} scores for today.`);
}

main();

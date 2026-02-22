import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

const CLIENT_ID = process.env.OSU_CLIENT_ID;
const CLIENT_SECRET = process.env.OSU_CLIENT_SECRET;
const COUNTRY = "IQ";
const MODE = "osu";

const PAGES_TO_SCAN = 10; // 10 pages * 50 = Top 500 players
const DELAY = 800; 

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
function today(){ return new Date().toISOString().split('T')[0]; }
function mkdirp(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }

async function getToken(){
  const res = await fetch('https://osu.ppy.sh/oauth/token',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:CLIENT_ID, client_secret:CLIENT_SECRET, grant_type:'client_credentials', scope:'public'})
  });
  const data = await res.json();
  return data.access_token;
}

async function main(){
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };

  console.log(`🏆 Fetching Top ${PAGES_TO_SCAN * 50} rankings for ${COUNTRY}...`);
  let baseRankings = [];
  
  // 1. Fetch Leaderboard Pages
  for(let page = 1; page <= PAGES_TO_SCAN; page++) {
    try {
        const res = await fetch(`https://osu.ppy.sh/api/v2/rankings/${MODE}/performance?country=${COUNTRY}&cursor[page]=${page}`, {headers});
        const data = await res.json();
        if (data.ranking) baseRankings.push(...data.ranking);
    } catch (e) { console.error(`Failed page ${page}`); }
    await sleep(300);
  }

  const userIds = baseRankings.map(r => r.user.id);

  // 2. Fetch Full User Stats (Medals & Last Visit) in batches of 50
  console.log(`🏅 Fetching full stats (Medals/Activity) for ${userIds.length} users...`);
  const fullStatsMap = {};
  for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      const query = batch.map(id => `ids[]=${id}`).join('&');
      try {
          const res = await fetch(`https://osu.ppy.sh/api/v2/users?${query}`, {headers});
          const data = await res.json();
          if (data.users) {
              data.users.forEach(u => {
                  fullStatsMap[u.id] = {
                      medals: u.user_achievements ? u.user_achievements.length : 0,
                      last_visit: u.last_visit || new Date(0).toISOString()
                  };
              });
          }
      } catch (e) { console.error("Failed user batch"); }
      await sleep(DELAY);
  }

  // 3. Calculate "Daily PP Gained" by cross-referencing today's scores json
  const dateParts = today().split('-');
  const todayScoresPath = path.join('data', dateParts[0], dateParts[1], dateParts[2] + '.json');
  const userDailyPP = {};
  if (fs.existsSync(todayScoresPath)) {
      const dailyData = JSON.parse(fs.readFileSync(todayScoresPath));
      if (dailyData.scores) {
          dailyData.scores.forEach(s => {
              if (!userDailyPP[s.user_id]) userDailyPP[s.user_id] = 0;
              userDailyPP[s.user_id] += s.pp; // Summing raw PP gained today
          });
      }
  }

  // 4. Fetch the #1 Top Play for each user
  console.log(`🔥 Fetching #1 Top Plays...`);
  const finalLeaderboard = [];
  
  // Using batches of 10 to stay within API limits safely
  for (let i = 0; i < baseRankings.length; i += 10) {
      const batch = baseRankings.slice(i, i + 10);
      const promises = batch.map(async (player) => {
          let topPlay = null;
          try {
              const res = await fetch(`https://osu.ppy.sh/api/v2/users/${player.user.id}/scores/best?limit=1&mode=${MODE}`, {headers});
              const bestScores = await res.json();
              if (Array.isArray(bestScores) && bestScores.length > 0) {
                  const s = bestScores[0];
                  topPlay = {
                      title: s.beatmapset.title,
                      diff: s.beatmap.version,
                      cover: s.beatmapset.covers.card,
                      stars: s.beatmap ? s.beatmap.difficulty_rating : 0,
                      mods: s.mods.length > 0 ? `+${s.mods.join('')}` : '',
                      pp: s.pp,
                      acc: s.accuracy * 100
                  };
              }
          } catch(e) {}

          const fullStats = fullStatsMap[player.user.id] || { medals: 0, last_visit: new Date(0).toISOString() };

          return {
              rank: player.global_rank, // Or just use index + 1 for country rank
              id: player.user.id,
              user: player.user.username,
              avatar: player.user.avatar_url,
              pp: player.pp,
              accuracy: player.hit_accuracy,
              play_count: player.play_count,
              play_time: player.play_time,
              total_score: player.total_score,
              total_hits: player.total_hits,
              a_ranks: player.grade_counts ? player.grade_counts.a : 0,
              medals: fullStats.medals,
              last_active: fullStats.last_visit,
              daily_pp: userDailyPP[player.user.id] || 0,
              top_play: topPlay
          };
      });

      const results = await Promise.all(promises);
      finalLeaderboard.push(...results);
      await sleep(DELAY);
  }

  // 5. Save the data
  const dir = path.join('data', 'leaderboards', dateParts[0], dateParts[1]);
  mkdirp(dir);
  fs.writeFileSync(path.join(dir, dateParts[2] + '.json'), JSON.stringify(finalLeaderboard, null, 2));

  // Update leaderboard index
  const indexFile = path.join('data', 'leaderboards', 'index.json');
  let indexData = { available_dates: [] };
  if(fs.existsSync(indexFile)) indexData = JSON.parse(fs.readFileSync(indexFile));
  if(!indexData.available_dates.includes(today())) {
      indexData.available_dates.push(today());
      indexData.available_dates.sort();
      fs.writeFileSync(indexFile, JSON.stringify(indexData, null, 2));
  }

  console.log(`✅ Saved ${finalLeaderboard.length} users to Leaderboard!`);
}

main();
            

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// These two lines are needed to make __dirname work in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processYesterday() {
    // 1. Get Yesterday's Date components
    const date = new Date();
    date.setDate(date.getDate() - 1);
    
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    // 2. Construct the path: data/2026/02/27.json
    // Note: If your months/days DON'T have leading zeros (e.g. /2/2/ instead of /02/02/), 
    // remove the .padStart(2, '0') above.
    const dailyPath = path.join(__dirname, 'data', year, month, `${day}.json`);
    const insightsPath = path.join(__dirname, 'data', 'community_insights.json');

    console.log(`Checking for file: ${dailyPath}`);

    if (!fs.existsSync(dailyPath)) {
        console.error(`❌ Data for ${dateKey} does not exist at ${dailyPath}`);
        return;
    }

    // 3. Read the existing daily JSON
    const dayData = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
    const scores = dayData.scores || [];

    // 4. Load or Initialize the Master Insights file
    let insights = { 
        community_streak: { current: 0, longest: 0, last_updated: "" }, 
        daily_stats: {} 
    };

    if (fs.existsSync(insightsPath)) {
        insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
    }

    // 5. Generate the stats for that specific day
    const stats = {
        total_scores: scores.length,
        peak_hour_baghdad: calculatePeakHour(scores),
        top_grinder: calculateTopGrinder(scores),
        most_played_map: calculateTopMap(scores)
    };

    // 6. Update Community Streak logic
    if (insights.community_streak.last_updated !== dateKey) {
        if (scores.length >= 50) {
            insights.community_streak.current++;
            if (insights.community_streak.current > insights.community_streak.longest) {
                insights.community_streak.longest = insights.community_streak.current;
            }
        } else {
            insights.community_streak.current = 0;
        }
        insights.community_streak.last_updated = dateKey;
    }

    // 7. Save to the master record
    insights.daily_stats[dateKey] = stats;
    
    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
    console.log(`✅ Success: Insights updated using ${day}.json`);
}

// --- MATH HELPERS ---
function calculatePeakHour(scores) {
    if (!scores.length) return 0;
    const hours = scores.map(s => (new Date(s.date).getUTCHours() + 3) % 24);
    return hours.sort((a,b) => hours.filter(v => v===a).length - hours.filter(v => v===b).length).pop();
}

function calculateTopGrinder(scores) {
    if (!scores.length) return null;
    const counts = {};
    scores.forEach(s => counts[s.user] = (counts[s.user] || 0) + 1);
    const topName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    const topScores = scores.filter(s => s.user === topName);
    return { user: topName, user_id: topScores[0].user_id, count: counts[topName], scores: topScores.slice(0, 15) };
}

function calculateTopMap(scores) {
    if (!scores.length) return null;
    const maps = {};
    scores.forEach(s => {
        if (!maps[s.title]) maps[s.title] = { count: 0, cover: s.cover };
        maps[s.title].count++;
    });
    const topMapTitle = Object.keys(maps).reduce((a, b) => maps[a].count > maps[b].count ? a : b);
    return { title: topMapTitle, cover: maps[topMapTitle].cover, unique_players: maps[topMapTitle].count };
}

processYesterday();

const fs = require('fs');
const path = require('path');

async function generate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    // Look for data folder in the same directory as this script
    const dailyPath = path.join(__dirname, 'data', String(year), month, `${day}.json`);
    const insightsPath = path.join(__dirname, 'data', 'community_insights.json');

    console.log(`Searching for: ${dailyPath}`);

    if (!fs.existsSync(dailyPath)) {
        console.error("❌ Yesterday's data not found. Ensure fetch_daily.js ran first.");
        return;
    }

    const dayData = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
    const scores = dayData.scores || [];

    let insights = { 
        community_streak: { current: 0, longest: 0, last_updated: "" }, 
        daily_stats: {} 
    };

    if (fs.existsSync(insightsPath)) {
        insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
    }

    // Process Stats
    const stats = {
        total_scores: scores.length,
        peak_hour_baghdad: calculatePeakHour(scores),
        top_grinder: calculateTopGrinder(scores),
        most_played_map: calculateTopMap(scores)
    };

    // Update Streak
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

    insights.daily_stats[dateKey] = stats;
    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
    console.log(`✅ Success! insights updated for ${dateKey}`);
}

function calculatePeakHour(scores) {
    if (!scores.length) return 0;
    const hours = scores.map(s => (new Date(s.date).getUTCHours() + 3) % 24);
    return hours.sort((a,b) => hours.filter(v => v===a).length - hours.filter(v => v===b).length).pop();
}

function calculateTopGrinder(scores) {
    if (!scores.length) return { user: "None", user_id: 1, count: 0, scores: [] };
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

generate();

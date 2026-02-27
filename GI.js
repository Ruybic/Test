const fs = require('fs');
const path = require('path');

async function generate() {
    // 1. Get Yesterday's Date (The most recently completed data)
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    // Paths
    const dailyPath = path.join(__dirname, 'data', String(year), month, `${day}.json`);
    const insightsPath = path.join(__dirname, 'data', 'community_insights.json');

    console.log(`Reading daily data from: ${dailyPath}`);

    if (!fs.existsSync(dailyPath)) {
        console.error("❌ Daily data file not found for yesterday.");
        return;
    }

    const dayData = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
    const scores = dayData.scores || [];

    if (scores.length === 0) {
        console.log("⚠️ No scores found in daily file. Skipping update.");
        return;
    }

    // 2. Load existing insights history
    let insights = { 
        community_streak: { current: 0, longest: 0, last_updated: "" }, 
        daily_stats: {} 
    };

    if (fs.existsSync(insightsPath)) {
        try {
            insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
        } catch (e) {
            console.error("Malformed insights file, resetting.");
        }
    }

    // 3. Calculate Stats
    const stats = {
        total_scores: scores.length,
        peak_hour_baghdad: calculatePeakHour(scores),
        top_grinder: calculateTopGrinder(scores),
        most_played_map: calculateTopMap(scores)
    };

    // 4. Update Community Streak
    // Logic: If 50+ scores and it's a new day, increment streak.
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

    // 5. Save back to daily_stats
    insights.daily_stats[dateKey] = stats;

    // Optional: Keep only last 30 days in daily_stats to keep file small
    const keys = Object.keys(insights.daily_stats).sort();
    if (keys.length > 30) {
        delete insights.daily_stats[keys[0]];
    }

    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
    console.log(`✅ community_insights.json updated for ${dateKey}`);
}

// Logic Helpers
function calculatePeakHour(scores) {
    const hours = scores.map(s => {
        const utcHour = new Date(s.date).getUTCHours();
        return (utcHour + 3) % 24; // Convert to Baghdad Time
    });
    return hours.sort((a,b) => 
        hours.filter(v => v===a).length - hours.filter(v => v===b).length
    ).pop();
}

function calculateTopGrinder(scores) {
    const counts = {};
    scores.forEach(s => counts[s.user] = (counts[s.user] || 0) + 1);
    const topName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    const topScores = scores.filter(s => s.user === topName);
    return { 
        user: topName, 
        user_id: topScores[0].user_id, 
        count: counts[topName], 
        scores: topScores.slice(0, 15) // Limit to top 15 plays to save space
    };
}

function calculateTopMap(scores) {
    const maps = {};
    scores.forEach(s => {
        if (!maps[s.title]) maps[s.title] = { count: 0, cover: s.cover };
        maps[s.title].count++;
    });
    const topMapTitle = Object.keys(maps).reduce((a, b) => maps[a].count > maps[b].count ? a : b);
    return { 
        title: topMapTitle, 
        cover: maps[topMapTitle].cover, 
        unique_players: maps[topMapTitle].count 
    };
}

generate();

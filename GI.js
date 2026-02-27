import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFormattedDate(filePath) {
    // Extracts YYYY-MM-DD from paths like data/2026/02/25.json
    const parts = filePath.split(path.sep);
    const day = parts.pop().replace('.json', '');
    const month = parts.pop();
    const year = parts.pop();
    return `${year}-${month}-${day}`;
}

function processAllHistory() {
    const dataDir = path.join(__dirname, 'data');
    const insightsPath = path.join(__dirname, 'data', 'community_insights.json');
    let allValidFiles = [];

    console.log("🔍 Scanning data directory for historical files...");

    // 1. Gather all JSON files recursively
    if (fs.existsSync(dataDir)) {
        const years = fs.readdirSync(dataDir).filter(f => !f.includes('.'));
        for (const year of years) {
            const yearPath = path.join(dataDir, year);
            const months = fs.readdirSync(yearPath).filter(f => !f.includes('.'));
            for (const month of months) {
                const monthPath = path.join(yearPath, month);
                const days = fs.readdirSync(monthPath).filter(f => f.endsWith('.json'));
                for (const day of days) {
                    allValidFiles.push(path.join(monthPath, day));
                }
            }
        }
    }

    if (allValidFiles.length === 0) {
        console.log("⚠️ No historical data found.");
        return;
    }

    // Sort chronologically so streak calculates correctly
    allValidFiles.sort();

    let insights = { 
        community_streak: { current: 0, longest: 0, last_updated: "" }, 
        daily_stats: {} 
    };

    console.log(`⏳ Processing ${allValidFiles.length} days of history...`);

    // 2. Process each file
    for (const file of allValidFiles) {
        const dateKey = getFormattedDate(file);
        const fileContent = fs.readFileSync(file, 'utf8').trim();
        
        if (!fileContent || fileContent === "{}" || fileContent === "[]") continue;

        let dayData;
        try {
            dayData = JSON.parse(fileContent);
        } catch (e) {
            console.log(`   ⏭️ Skipping corrupted file: ${dateKey}`);
            continue;
        }

        const scores = dayData.scores || [];
        if (scores.length === 0) continue;

        // Calculate Stats
        const stats = {
            total_scores: scores.length,
            peak_hour_baghdad: calculatePeakHour(scores),
            top_grinder: calculateTopGrinder(scores),
            most_played_map: calculateTopMap(scores)
        };

        // Calculate Streak chronologically
        if (scores.length >= 50) {
            insights.community_streak.current++;
            if (insights.community_streak.current > insights.community_streak.longest) {
                insights.community_streak.longest = insights.community_streak.current;
            }
        } else {
            insights.community_streak.current = 0;
        }
        insights.community_streak.last_updated = dateKey;

        // Save daily stat
        insights.daily_stats[dateKey] = stats;
    }

    // 3. Save Master File
    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
    console.log(`✅ Success! Master history created with ${Object.keys(insights.daily_stats).length} days recorded.`);
}

// --- MATH HELPERS ---
function calculatePeakHour(scores) {
    if (!scores.length) return 0;
    const hours = scores.map(s => (new Date(s.created_at || s.date).getUTCHours() + 3) % 24);
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
        const title = s.beatmapset ? s.beatmapset.title : s.title;
        const cover = s.beatmapset ? s.beatmapset.cover : s.cover;
        if (!title) return;
        if (!maps[title]) maps[title] = { count: 0, cover: cover || '' };
        maps[title].count++;
    });
    if (Object.keys(maps).length === 0) return null;
    const topMapTitle = Object.keys(maps).reduce((a, b) => maps[a].count > maps[b].count ? a : b);
    return { title: topMapTitle, cover: maps[topMapTitle].cover, unique_players: maps[topMapTitle].count };
}

processAllHistory();

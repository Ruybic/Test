import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get YYYY-MM-DD from a path
function getFormattedDate(filePath) {
    const parts = filePath.split(path.sep);
    const day = parts.pop().replace('.json', '');
    const month = parts.pop();
    const year = parts.pop();
    return `${year}-${month}-${day}`;
}

async function run() {
    const args = process.argv.slice(2);
    const isFullBackfill = args.includes('--all');
    
    const dataDir = path.join(__dirname, 'data');
    const insightsPath = path.join(__dirname, 'data', 'community_insights.json');
    let filesToProcess = [];

    if (isFullBackfill) {
        console.log("📂 Mode: FULL BACKFILL (Scanning all history)");
        // Find all JSON files in data/YYYY/MM/DD.json
        if (fs.existsSync(dataDir)) {
            const years = fs.readdirSync(dataDir).filter(f => !f.includes('.'));
            for (const year of years) {
                const yearPath = path.join(dataDir, year);
                const months = fs.readdirSync(yearPath).filter(f => !f.includes('.'));
                for (const month of months) {
                    const monthPath = path.join(yearPath, month);
                    const days = fs.readdirSync(monthPath).filter(f => f.endsWith('.json'));
                    for (const day of days) {
                        filesToProcess.push(path.join(monthPath, day));
                    }
                }
            }
        }
    } else {
        console.log("📅 Mode: DAILY UPDATE (Processing yesterday)");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const y = yesterday.getUTCFullYear();
        const m = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
        const d = String(yesterday.getUTCDate()).padStart(2, '0');
        
        const targetFile = path.join(dataDir, String(y), m, `${d}.json`);
        if (fs.existsSync(targetFile)) {
            filesToProcess.push(targetFile);
        } else {
            console.error(`❌ No data file found for yesterday: ${targetFile}`);
            process.exit(0);
        }
    }

    filesToProcess.sort(); // Ensure chronological order for streaks

    // Load existing insights if they exist
    let insights = { 
        community_streak: { current: 0, longest: 0, last_updated: "" }, 
        daily_stats: {} 
    };

    if (fs.existsSync(insightsPath) && !isFullBackfill) {
        try {
            const existing = fs.readFileSync(insightsPath, 'utf8');
            if (existing) insights = JSON.parse(existing);
        } catch (e) {
            console.warn("⚠️ insights.json was corrupted, starting fresh.");
        }
    }

    for (const file of filesToProcess) {
        const dateKey = getFormattedDate(file);
        console.log(`🔎 Processing: ${dateKey}`);
        
        const content = fs.readFileSync(file, 'utf8').trim();
        if (!content || content === "[]" || content === "{}") continue;

        try {
            const dayData = JSON.parse(content);
            const scores = dayData.scores || [];
            if (scores.length === 0) continue;

            const stats = {
                total_scores: scores.length,
                peak_hour_baghdad: calculatePeakHour(scores),
                top_grinder: calculateTopGrinder(scores),
                most_played_map: calculateTopMap(scores)
            };

            // Update streaks
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
        } catch (err) {
            console.error(`❌ Error parsing ${file}:`, err.message);
        }
    }

    fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2));
    console.log(`✅ Done. Updated ${insightsPath}`);
}

// --- MATH HELPERS (Keep these exactly as they are) ---
function calculatePeakHour(scores) {
    if (!scores.length) return 0;
    const hours = scores.map(s => (new Date(s.created_at || s.date).getUTCHours() + 3) % 24);
    return hours.sort((a,b) => hours.filter(v => v===a).length - hours.filter(v => v===b).length).pop();
}

function calculateTopGrinder(scores) {
    if (!scores.length) return null;
    const counts = {};
    scores.forEach(s => counts[s.user] = (counts[s.user] || 0) + 1);
    const topName = Object.keys(counts).reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b);
    const topScores = scores.filter(s => s.user === topName);
    return { user: topName, user_id: topScores[0].user_id, count: counts[topName], scores: topScores.slice(0, 15) };
}

function calculateTopMap(scores) {
    if (!scores.length) return null;
    const maps = {};
    scores.forEach(s => {
        const title = s.beatmapset?.title || s.title;
        const cover = s.beatmapset?.cover || s.cover;
        if (!title) return;
        if (!maps[title]) maps[title] = { count: 0, cover: cover || '' };
        maps[title].count++;
    });
    const topMapTitle = Object.keys(maps).reduce((a, b) => maps[a].count > maps[b].count ? a : b);
    return { title: topMapTitle, cover: maps[topMapTitle].cover, unique_players: maps[topMapTitle].count };
}

run();

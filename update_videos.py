import os
import json
import subprocess

# --- CONFIGURATION ---
CHANNELS = [
    "https://www.youtube.com/@FancyToast501/videos"
]
DATA_FILE = "data/video_db.json"
HTML_FILE = "Videos.html"

def get_videos():
    all_videos = []
    for url in CHANNELS:
        print(f"📡 Scanning {url}...")
        cmd = [
            "yt-dlp", 
            "--flat-playlist", 
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "--print", "%(title)s\n%(id)s\n%(upload_date)s", 
            "--playlist-items", "1-5", 
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if not result.stdout.strip():
            print(f"⚠️ No output for {url}")
            continue

        lines = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
        
        for i in range(0, len(lines), 3):
            if i+2 < len(lines):
                all_videos.append({
                    "title": lines[i],
                    "id": lines[i+1],
                    "date": lines[i+2]
                })
    return all_videos

def main():
    os.makedirs("data", exist_ok=True)
    
    # 1. Load History
    db = []
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                db = json.load(f)
        except: db = []

    # 2. Get New Videos
    found_vids = get_videos()
    
    # 3. Merge (Avoid Duplicates)
    existing_ids = {v['id'] for v in db}
    for v in found_vids:
        if v['id'] not in existing_ids:
            db.append(v)
    
    # Sort newest date first
    db.sort(key=lambda x: x['date'], reverse=True)

    # 4. Save DB
    with open(DATA_FILE, "w") as f:
        json.dump(db, f, indent=2)

    # 5. GENERATE CARDS (Matches your Clean CSS)
    cards_html = ""
    total_vids = len(db)
    for index, v in enumerate(db):
        display_num = total_vids - index 
        cards_html += f'''
        <div class="video-card">
            <div class="video-num">#{display_num}</div>
            <h3>{v['title']}</h3>
            <iframe src="https://www.youtube.com/embed/{v['id']}" allowfullscreen loading="lazy"></iframe>
        </div>'''

    # 6. THE CLEAN TEMPLATE
    # This now matches your desired HTML structure exactly
    template = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>osu! Iraq | Showcase</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {{ --osu-pink: #ff66aa; --dark-base: #1c1c21; --panel-bg: #2e2e38; --text-muted: #888895; }}
        body {{ background-color: var(--dark-base); color: white; font-family: 'Exo 2', sans-serif; margin: 0; padding: 0; }}

        /* HEADER & NAV */
        header {{
            background: #111116; padding: 15px 25px; display: flex; align-items: center;
            justify-content: space-between; border-bottom: 2px solid var(--panel-bg);
            position: sticky; top: 0; z-index: 1000;
        }}
        .logo {{ font-weight: 800; color: var(--osu-pink); font-size: 22px; text-decoration: none; }}
        .nav-links a {{ color: white; text-decoration: none; margin-left: 20px; font-weight: 600; font-size: 14px; transition: 0.2s; }}
        .nav-links a:hover {{ color: var(--osu-pink); }}

        .container {{ max-width: 1400px; margin: 40px auto; padding: 0 20px; }}
        .page-title {{ margin-bottom: 30px; border-left: 4px solid var(--osu-pink); padding-left: 15px; }}
        .page-title h1 {{ margin: 0; font-size: 28px; font-weight: 800; }}
        .page-title p {{ margin: 5px 0 0; color: var(--text-muted); }}

        /* THE VIDEO GRID */
        .video-grid {{ 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); 
            gap: 25px; 
        }}

        .video-card {{ 
            background: var(--panel-bg); 
            border-radius: 12px; 
            overflow: hidden; 
            border: 1px solid #3e3e4a; 
            position: relative;
            transition: transform 0.3s ease;
        }}
        .video-card:hover {{ transform: translateY(-5px); border-color: var(--osu-pink); }}

        /* Video ID Number Badge */
        .video-num {{ 
            position: absolute; top: 10px; left: 10px; 
            background: rgba(0,0,0,0.8); color: var(--osu-pink); 
            padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 12px; z-index: 5;
            border: 1px solid var(--osu-pink);
        }}

        .video-card h3 {{ 
            font-size: 15px; padding: 15px; margin: 0; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
            background: #25252e; color: #eee;
        }}

        iframe {{ width: 100%; aspect-ratio: 16 / 9; border: none; display: block; }}

        @media (max-width: 480px) {{
            .video-grid {{ grid-template-columns: 1fr; }}
        }}
    </style>
</head>
<body>

<header>
    <a href="index.html" class="logo">FancyToastOsu!</a>
    <nav class="nav-links">
        <a href="index.html">Daily Scores</a>
        <a href="Videos.html" style="color: var(--osu-pink);">Showcase</a>
    </nav>
</header>

<div class="container">
    <div class="page-title">
        <h1>Community Showcase</h1>
        <p>Latest replays and highlights from Iraqi players</p>
    </div>

    <div class="video-grid" id="videoGrid">
        {cards_html}
    </div>
</div>

</body>
</html>'''

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(template)
    print(f"✅ Rebuilt {HTML_FILE} with {total_vids} videos.")

if __name__ == "__main__":
    main()
    

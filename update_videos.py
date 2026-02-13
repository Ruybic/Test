import os
import json
import subprocess

# Configuration
CHANNELS = [
    "https://m.youtube.com/@FancyToast501/videos",
]
DATA_FILE = "data/video_db.json"
HTML_FILE = "Videos.html"

def get_videos():
    all_videos = []
    for url in CHANNELS:
        print(f"📡 Scanning {url}...")
        # We add --user-agent to prevent YouTube from blocking the request
        cmd = [
            "yt-dlp", 
            "--flat-playlist", 
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "--print", "%(title)s\n%(id)s\n%(upload_date)s", 
            "--playlist-items", "1-5", 
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # DEBUG: Print the raw output to GitHub Logs so we can see it
        if not result.stdout.strip():
            print(f"❌ Error: No output from yt-dlp for {url}")
            print(f"System Message: {result.stderr}")
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
    # 1. Load existing database to prevent duplicates
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            db = json.load(f)
    else:
        db = []

    # 2. Fetch new videos
    new_vids = get_videos()
    
    # 3. Merge and sort by date (newest first)
    existing_ids = {v['id'] for v in db}
    for v in new_vids:
        if v['id'] not in existing_ids:
            db.append(v)
    
    db.sort(key=lambda x: x['date'], reverse=True)

    # 4. Save Database
    os.makedirs("data", exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(db, f, indent=2)

    # 5. Generate HTML
    cards_html = ""
    for index, v in enumerate(db):
        display_num = len(db) - index
        cards_html += f'''
        <div class="video-card">
            <div class="video-num">#{display_num}</div>
            <h3>{v['title']}</h3>
            <iframe src="https://www.youtube.com/embed/{v['id']}" allowfullscreen loading="lazy"></iframe>
        </div>'''

    # This template has a placeholder where we inject cards
    template = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>osu! Iraq | Showcase</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {{ --osu-pink: #ff66aa; --dark-base: #1c1c21; --panel-bg: #2e2e38; }}
        body {{ background-color: var(--dark-base); color: white; font-family: 'Exo 2', sans-serif; margin: 0; padding: 20px; }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .video-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 25px; max-width: 1400px; margin: 0 auto; }}
        .video-card {{ background: var(--panel-bg); padding: 15px; border-radius: 12px; border: 1px solid #3e3e4a; position: relative; }}
        .video-num {{ position: absolute; top: 10px; right: 15px; background: var(--osu-pink); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 12px; }}
        .video-card h3 {{ font-size: 14px; margin: 0 0 15px 0; color: #eee; width: 85%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        iframe {{ width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; border: none; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Community Showcase</h1>
        <p>Iraqi osu! Highlights & Replays</p>
    </div>
    <div class="video-grid">
        {cards_html}
    </div>
</body>
</html>'''

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(template)

if __name__ == "__main__":
    main()
  

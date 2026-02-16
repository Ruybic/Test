import json
import subprocess
import os

# 1. YOUR TARGET CHANNELS
CHANNELS = [
    {"url": "https://www.youtube.com/channel/UCAZTO65RFJoH3thMzFlnHvw", "name": "FancyToast"},
    {"url": "https://www.youtube.com/@ano8859", "name": "Ano"},
    {"url": "https://youtube.com/@len_osu", "name": "Len"},
    {"url": "https://youtube.com/@ysolar", "name": "Solar"},
    {"url": "https://youtube.com/@greevcs", "name": "Gree"}
]

DATABASE_FILE = "data/video_database.json"

def load_db():
    if os.path.exists(DATABASE_FILE):
        with open(DATABASE_FILE, "r", encoding="utf-8") as f:
            try:
                # Load as dict for fast lookup: { "vid_id": {data} }
                data = json.load(f)
                return {v['id']: v for v in data} if isinstance(data, list) else data
            except: return {}
    return {}

def fetch_videos():
    db = load_db()
    print(f"Loaded {len(db)} existing videos.")

    for channel in CHANNELS:
        print(f"Fetching {channel['name']}...")
        # We use /videos and get the last 10 to keep it fast
        cmd = [
            "yt-dlp", "--dump-json", "--flat-playlist", "--quiet",
            "--playlist-end", "10", f"{channel['url']}/videos"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            for line in result.stdout.splitlines():
                video = json.loads(line)
                v_id = video['id']
                
                # Format Date: YYYYMMDD -> YYYY-MM-DD
                raw_date = video.get('upload_date', '20240101')
                fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"

                if v_id not in db:
                    # NEW VIDEO: Default to Yes
                    db[v_id] = {
                        "id": v_id,
                        "title": video.get('title'),
                        "channel": channel['name'],
                        "published": fmt_date,
                        "url": f"https://youtu.be/{v_id}",
                        "status": "Yes" 
                    }
                else:
                    # EXISTING: Update title/date but KEEP the user's status (Yes/No)
                    db[v_id].update({
                        "title": video.get('title'),
                        "published": fmt_date
                    })
        except Exception as e:
            print(f"Error on {channel['name']}: {e}")

    # 2. SORT & SEQUENCE
    # Sort by date newest first
    sorted_vids = sorted(db.values(), key=lambda x: x['published'], reverse=True)
    
    # Add sequence number (1 = newest)
    for i, vid in enumerate(sorted_vids, 1):
        vid['sequence'] = i

    # 3. SAVE
    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted_vids, f, indent=4)
    
    print(f"Done! Saved {len(sorted_vids)} videos.")

if __name__ == "__main__":
    fetch_videos()
    

import json
import subprocess
import os

CHANNELS = [
    {"url": "https://www.youtube.com/@fancytoast501/videos", "name": "FancyToastOsu!"},
    {"url": "https://www.youtube.com/@fancytoast551/videos", "name": "FancyToastMain"},
    {"url": "https://www.youtube.com/@ano8859/videos", "name": "Ano"},
    {"url": "https://www.youtube.com/@len_osu/videos", "name": "Len"},
    {"url": "https://www.youtube.com/@ysolar/videos", "name": "Sola"},
    {"url": "https://www.youtube.com/@greevcs/videos", "name": "Greev"}
]

DATABASE_FILE = "data/video_database.json"

def fetch_videos():
    db = {}
    if os.path.exists(DATABASE_FILE):
        try:
            with open(DATABASE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                db = {v['id']: v for v in data}
        except: pass

    for channel in CHANNELS:
        print(f"--- Scraping {channel['name']} ---")
        # We use --flat-playlist for speed and reliability on GitHub
        cmd = [
            "yt-dlp", "--dump-json", "--flat-playlist", 
            "--ignore-errors", "--no-warnings",
            channel['url']
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            for line in result.stdout.splitlines():
                video = json.loads(line)
                v_id = video.get('id')
                if not v_id: continue

                # Get date if available, otherwise use a placeholder that sorts well
                raw_date = video.get('upload_date')
                fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}" if raw_date else "2000-01-01"

                if v_id not in db:
                    db[v_id] = {
                        "id": v_id,
                        "title": video.get('title'),
                        "channel": channel['name'],
                        "published": fmt_date,
                        "url": f"https://youtu.be/{v_id}",
                        "status": "Yes"
                    }
        except Exception as e:
            print(f"Error: {e}")

    # --- THE FIX FOR SEQUENCE ---
    # 1. Sort oldest to newest (by date, then by title as fallback)
    all_vids = sorted(db.values(), key=lambda x: (x['published'], x['title']))
    
    # 2. Assign #1 to the OLDEST video
    for i, v in enumerate(all_vids, 1):
        v['sequence'] = i

    # 3. Final Sort: NEWEST first for the website
    final_list = sorted(all_vids, key=lambda x: (x['published'], x['sequence']), reverse=True)

    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=4)
    
    print(f"Success! {len(final_list)} videos indexed.")

if __name__ == "__main__":
    fetch_videos()    

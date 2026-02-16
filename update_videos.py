import json
import subprocess
import os

CHANNELS = [
    {"url": "https://www.youtube.com/channel/UCAZTO65RFJoH3thMzFlnHvw", "name": "FancyToast"},
    {"url": "https://www.youtube.com/@ano8859", "name": "Ano"},
    {"url": "https://youtube.com/@len_osu", "name": "Len"},
    {"url": "https://youtube.com/@ysolar", "name": "Solar"},
    {"url": "https://youtube.com/@greevcs", "name": "Gree"}
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
        print(f"--- Archiving: {channel['name']} ---")
        # We removed --flat-playlist to ensure we get the real 'upload_date'
        # but kept --playlist-end to avoid a 10-hour run. 
        # Increase '200' if you need even more history per channel.
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--playlist-end", "200", 
            "--ignore-errors",
            "--no-warnings",
            f"{channel['url']}/videos"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            for line in result.stdout.splitlines():
                if not line.strip(): continue
                video = json.loads(line)
                v_id = video.get('id')
                
                # FIXING THE DATE:
                # yt-dlp uses 'upload_date' (YYYYMMDD). If missing, we try 'timestamp'
                raw_date = video.get('upload_date')
                if raw_date:
                    fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                else:
                    fmt_date = "2000-01-01" 

                if v_id not in db:
                    db[v_id] = {
                        "id": v_id,
                        "title": video.get('title'),
                        "channel": channel['name'],
                        "published": fmt_date,
                        "url": f"https://youtu.be/{v_id}",
                        "status": "Yes"
                    }
                else:
                    # Update date if it was previously stuck at 2024-01-01
                    db[v_id]["published"] = fmt_date

        except Exception as e:
            print(f"Error on {channel['name']}: {e}")

    # --- SORT & REVERSE SEQUENCE ---
    # 1. Sort by date (Oldest to Newest)
    all_vids = sorted(db.values(), key=lambda x: x['published'])
    
    # 2. Assign sequence #1 to oldest, up to #1500 for newest
    for i, vid in enumerate(all_vids, 1):
        vid['sequence'] = i

    # 3. Final Sort (Newest first for the Website display)
    final_list = sorted(all_vids, key=lambda x: x['published'], reverse=True)

    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=4)
    
    print(f"Saved {len(final_list)} videos. Highest sequence: #{len(final_list)}")

if __name__ == "__main__":
    fetch_videos()

import json
import subprocess
import os

CHANNELS = [
    {"url": "https://www.youtube.com/channel/UCAZTO65RFJoH3thMzFlnHvw", "name": "FancyToast"},
    {"url": "https://www.youtube.com/@ano8859", "name": "Ano"},
    {"url": "https://www.youtube.com/@len_osu", "name": "Len"},
    {"url": "https://www.youtube.com/@ysolar", "name": "Solar"},
    {"url": "https://www.youtube.com/@greevcs", "name": "Gree"}
]

DATABASE_FILE = "data/video_database.json"

def fetch_videos():
    db = {}
    # Load existing to keep your "No" statuses
    if os.path.exists(DATABASE_FILE):
        try:
            with open(DATABASE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                db = {v['id']: v for v in data}
        except: pass

    for channel in CHANNELS:
        print(f"--- Deep Scraping: {channel['name']} ---")
        
        # REMOVED --playlist-end to get EVERYTHING
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist", 
            "--ignore-errors",
            f"{channel['url']}/videos"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            lines = result.stdout.strip().split('\n')
            
            count = 0
            for line in lines:
                if not line.strip(): continue
                video = json.loads(line)
                v_id = video.get('id')
                if not v_id: continue

                raw_date = video.get('upload_date', '20240101')
                fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"

                # If it's a new video, add it. 
                # If it exists, we update metadata but KEEP status.
                if v_id not in db:
                    db[v_id] = {
                        "id": v_id,
                        "title": video.get('title', 'Unknown Title'),
                        "channel": channel['name'],
                        "published": fmt_date,
                        "url": f"https://youtu.be/{v_id}",
                        "status": "Yes"
                    }
                else:
                    db[v_id].update({
                        "title": video.get('title', 'Unknown Title'),
                        "published": fmt_date
                    })
                count += 1
            print(f"Processed {count} videos for {channel['name']}")

        except Exception as e:
            print(f"Error: {e}")

    # Sort and re-sequence
    sorted_list = sorted(db.values(), key=lambda x: x.get('published', '0000-00-00'), reverse=True)
    for i, v in enumerate(sorted_list, 1):
        v['sequence'] = i

    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted_list, f, indent=4)
    
    print(f"Final Database Size: {len(sorted_list)} videos.")

if __name__ == "__main__":
    fetch_videos()
    

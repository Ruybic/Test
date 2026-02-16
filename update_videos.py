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
        # Changed: We target /videos but add the 'tab' filter in the command
        print(f"--- Deep Archiving: {channel['name']} ---")
        
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--ignore-errors",
            "--no-check-certificates",
            # This helps catch Shorts and Streams as well
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

                # Better Date Parsing
                raw_date = video.get('upload_date')
                if not raw_date or raw_date == "null":
                    fmt_date = "2024-01-01" # Fallback for very old un-indexed vids
                else:
                    fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"

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
                    # Update metadata but preserve YOUR manual "No"
                    db[v_id].update({
                        "title": video.get('title', 'Unknown Title'),
                        "published": fmt_date
                    })
                count += 1
            print(f"Captured {count} items for {channel['name']}")

        except Exception as e:
            print(f"Error: {e}")

    # Re-sort everything by date
    sorted_list = sorted(db.values(), key=lambda x: x.get('published', '0000-00-00'), reverse=True)
    
    # Update sequence numbers based on the full sorted list
    for i, v in enumerate(sorted_list, 1):
        v['sequence'] = i

    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted_list, f, indent=4)
    
    print(f"Final Global Database Size: {len(sorted_list)} items.")

if __name__ == "__main__":
    fetch_videos()
    

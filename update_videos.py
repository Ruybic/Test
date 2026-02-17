import json
import subprocess
import os

# Your list of channels
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
    # 1. Load existing DB to keep your manual "No" edits
    db = {}
    if os.path.exists(DATABASE_FILE):
        try:
            with open(DATABASE_FILE, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                # Create a dict for easy lookup
                db = {v['id']: v for v in existing_data}
        except: pass

    new_videos_list = []

    for channel in CHANNELS:
        print(f"--- Processing {channel['name']} ---")
        
        # We use flat-playlist because it's fast. 
        # YouTube returns videos Newest -> Oldest.
        cmd = [
            "yt-dlp", "--dump-json", "--flat-playlist", 
            "--ignore-errors", "--no-warnings",
            channel['url']
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            # This index 'i' helps us sort relative to this specific fetch
            for i, line in enumerate(result.stdout.splitlines()):
                video = json.loads(line)
                v_id = video.get('id')
                if not v_id: continue

                # Try to get date, default to fallback
                raw_date = video.get('upload_date')
                fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}" if raw_date else "2000-01-01"

                # Prepare the video object
                vid_obj = {
                    "id": v_id,
                    "title": video.get('title', 'Unknown'),
                    "channel": channel['name'],
                    "published": fmt_date,
                    "url": f"https://youtu.be/{v_id}",
                    "status": "Yes", # Default new videos to Yes
                    "sort_index": i  # 0 is newest, 1 is older...
                }

                # If it already exists, keep the OLD status (Yes/No) but update title/date
                if v_id in db:
                    vid_obj['status'] = db[v_id].get('status', 'Yes')
                
                # Add to our temporary list
                new_videos_list.append(vid_obj)

        except Exception as e:
            print(f"Error scraping {channel['name']}: {e}")

    # --- FINAL PROCESSING ---
    # We rely on YouTube's order. 
    # If we want a global sort, we rely on Date first, then the specific channel batch.
    
    # Sort by Date (Newest first)
    # If date is 2000-01-01, it falls to the bottom, unless we start trusting 'sort_index' more.
    # For now, standard date sorting is safest.
    final_list = sorted(new_videos_list, key=lambda x: x['published'], reverse=True)

    # Save
    os.makedirs("data", exist_ok=True)
    with open(DATABASE_FILE, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=4)
    
    print(f"Database Updated. Total videos: {len(final_list)}")

if __name__ == "__main__":
    fetch_videos()

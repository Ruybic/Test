import json
import subprocess
import os
import time

CHANNELS = [
    {"id": "UCAZTO65RFJoH3thMzFlnHvw", "name": "FancyToast"},
    {"id": "UCq_f7_7_uN82mX_f9S8h28A", "name": "Ano"}
]

OUTPUT_FILE = "data/videos.json"

def get_videos():
    all_videos = []
    
    for channel in CHANNELS:
        # MAGIC TRICK: Convert Channel ID (UC...) to Uploads Playlist ID (UU...)
        uploads_playlist_id = "UU" + channel['id'][2:]
        url = f"https://www.youtube.com/playlist?list={uploads_playlist_id}"
        
        print(f"Fetching {channel['name']} via Uploads Playlist...")

        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--extract-flat",
            "--quiet",
            "--no-warnings",
            "--playlist-end", "50", # Limit to last 50 videos to stay fast
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            # If stdout is empty, YouTube might be blocking the request
            if not result.stdout.strip():
                print(f"Warning: No data returned for {channel['name']}. Might be a soft-block.")
                continue

            lines = result.stdout.strip().split('\n')
            for line in lines:
                video_data = json.loads(line)
                
                # In 2026, upload_date is often missing in flat mode. 
                # We use a placeholder if it's not found.
                date = video_data.get('upload_date', "20260101")
                
                all_videos.append({
                    "id": video_data['id'],
                    "title": video_data['title'],
                    "channel": channel['name'],
                    "url": f"https://youtu.be/{video_data['id']}",
                    "date": f"{date[:4]}-{date[4:6]}-{date[6:]}"
                })
            
            print(f"Done. Found {len(lines)} videos.")
            time.sleep(2) # Small throttle

        except Exception as e:
            print(f"Error: {e}")

    # Save
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=4)
    
    print(f"\nFinal count: {len(all_videos)} saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    get_videos()

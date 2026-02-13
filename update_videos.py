import json
import subprocess
import os

# Your Target Channels
CHANNELS = [
    {"id": "UCuzHfz9jikRLrow8lcyjEQQ", "name": "FancyToast"},
    {"id": "UC2tN8yIRVdZ8-Ig2REhPPWg", "name": "Ano"}
]

OUTPUT_FILE = "data/videos.json"

def get_videos():
    all_videos = []
    
    for channel in CHANNELS:
        print(f"Fetching: {channel['name']}...")
        
        # We use the /videos tab specifically
        url = f"https://www.youtube.com/channel/{channel['id']}/videos"
        
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--quiet",
            "--no-warnings",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            url
        ]
        
        try:
            # Capture output
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if result.stderr:
                print(f"Log for {channel['name']}: {result.stderr}")

            lines = result.stdout.strip().split('\n')
            count = 0
            for line in lines:
                if not line.strip(): continue
                
                video_data = json.loads(line)
                
                # yt-dlp flat-playlist uses 'id' and 'title'
                # For date, it might use 'upload_date' or None in flat mode
                raw_date = video_data.get('upload_date', "20240101") 
                formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"

                all_videos.append({
                    "id": video_data['id'],
                    "title": video_data['title'],
                    "channel": channel['name'],
                    "published": formatted_date,
                    "timestamp": raw_date
                })
                count += 1
            
            print(f"Found {count} videos for {channel['name']}")
                    
        except Exception as e:
            print(f"Error scraping {channel['name']}: {e}")

    # Sort: Newest first
    all_videos.sort(key=lambda x: x['timestamp'], reverse=True)

    # Clean up
    for v in all_videos:
        if 'timestamp' in v: del v['timestamp']

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=4)
    
    print(f"Final Count: {len(all_videos)} videos saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    get_videos()

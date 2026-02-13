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
        print(f"Fetching videos for: {channel['name']}...")
        
        # Build the yt-dlp command
        # --dump-json: Output raw data
        # --flat-playlist: Scrape list only (don't download videos) -> Super fast
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            f"https://www.youtube.com/channel/{channel['id']}/videos"
        ]
        
        try:
            # Run command and capture output
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            # yt-dlp outputs one JSON object per line
            for line in result.stdout.strip().split('\n'):
                if not line: continue
                
                try:
                    video_data = json.loads(line)
                    
                    # Extract only what we need
                    # Note: We skip live streams that haven't happened yet (checks for upload_date)
                    if 'upload_date' in video_data:
                        # Format Date from YYYYMMDD to YYYY-MM-DD for JavaScript
                        raw_date = video_data['upload_date']
                        formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                        
                        all_videos.append({
                            "id": video_data['id'],
                            "title": video_data['title'],
                            "channel": channel['name'],
                            "published": formatted_date,
                            "timestamp": raw_date # Used for sorting
                        })
                except json.JSONDecodeError:
                    continue
                    
        except Exception as e:
            print(f"Error scraping {channel['name']}: {e}")

    # Sort all videos by date (Newest first)
    # We compare the 'timestamp' strings (YYYYMMDD sorts correctly as string)
    all_videos.sort(key=lambda x: x['timestamp'], reverse=True)

    # Remove the helper 'timestamp' key before saving (optional, keeps JSON clean)
    for v in all_videos:
        del v['timestamp']

    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # Save to file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=4)
    
    print(f"Successfully saved {len(all_videos)} videos.")

if __name__ == "__main__":
    get_videos()

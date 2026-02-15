import json
import subprocess
import os
import time
import random  # Added for "human-like" variance

# Your Target Channels
CHANNELS = [
    {"id": "UCAZTO65RFJoH3thMzFlnHvw", "name": "FancyToast"},
    {"id": "UCq_f7_7_uN82mX_f9S8h28A", "name": "Ano"}
]

OUTPUT_FILE = "data/videos.json"

def get_videos():
    all_videos = []
    
    for i, channel in enumerate(CHANNELS):
        print(f"[{i+1}/{len(CHANNELS)}] Fetching videos for: {channel['name']}...")
        
        # Strictly targeting the long-form videos tab
        url = f"https://www.youtube.com/channel/{channel['id']}/videos"
        
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--ignore-errors",   # Keep going if one video fails
            "--no-warnings",
            
            # --- THROTTLING FLAGS ---
            "--sleep-requests", "2",      # Sleep min 2 seconds between internal requests
            "--max-sleep-interval", "5",  # Sleep max 5 seconds (randomized 2-5s)
            
            # --- NETWORKING FIXES ---
            "--force-ipv4",      # Often fixes "network unreachable" or empty results
            
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            url
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if result.stderr:
                print(f"  > Log: {result.stderr[:100]}...") # Print first 100 chars of error if any

            lines = result.stdout.strip().split('\n')
            count = 0
            
            for line in lines:
                if not line.strip(): continue
                
                try:
                    video_data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                
                # yt-dlp flat-playlist often misses the exact upload date.
                # We use a safe fallback.
                raw_date = video_data.get('upload_date')
                if raw_date:
                    formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
                else:
                    formatted_date = "Unknown Date"

                all_videos.append({
                    "id": video_data.get('id'),
                    "title": video_data.get('title'),
                    "channel": channel['name'],
                    "published": formatted_date,
                    "url": f"https://www.youtube.com/watch?v={video_data.get('id')}"
                })
                count += 1
            
            print(f"  > Success: Found {count} videos.")
                    
        except Exception as e:
            print(f"  > Error: {e}")

        # --- MANUAL BRAKE ---
        # If this is not the last channel, take a nap.
        if i < len(CHANNELS) - 1:
            sleep_time = random.uniform(5, 10) # Random sleep between 5 and 10 seconds
            print(f"  > Cooling down for {sleep_time:.2f} seconds...")
            time.sleep(sleep_time)

    # Save to file
    print(f"Saving {len(all_videos)} total videos to {OUTPUT_FILE}...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=4)
    
    print("Done!")

if __name__ == "__main__":
    get_videos()

import json
import os
import feedparser # Use: pip install feedparser
from datetime import datetime

# --- CONFIGURATION: Add your target Channel IDs here ---
CHANNELS = {
    "UCxxxxxxxxxxxx": "Example Channel 1", 
    "UCyyyyyyyyyyyy": "Example Channel 2"
}
# Tip: You can get Channel ID from the URL of the channel page

OUTPUT_FILE = "data/videos.json"

def fetch_videos():
    all_videos = []

    for channel_id, channel_name in CHANNELS.items():
        print(f"Fetching {channel_name}...")
        # YouTube provides an RSS feed for every channel
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        feed = feedparser.parse(rss_url)

        for entry in feed.entries:
            # Extract Video ID
            video_id = entry.yt_videoid
            
            # Simple data structure
            video_data = {
                "id": video_id,
                "title": entry.title,
                "channel": entry.author,
                "published": entry.published,
                "timestamp": datetime.fromisoformat(entry.published).timestamp()
            }
            all_videos.append(video_data)

    # Sort by Date (Newest first)
    all_videos.sort(key=lambda x: x['timestamp'], reverse=True)

    # Ensure data directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    # Save to JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_videos, f, indent=4)
    
    print(f"Saved {len(all_videos)} videos to {OUTPUT_FILE}")

if __name__ == "__main__":
    fetch_videos()

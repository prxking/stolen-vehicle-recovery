import sqlite3
import urllib.request
import urllib.parse
import re
import json
import time

def search_ddg_image(query):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        url = f'https://duckduckgo.com/?q={urllib.parse.quote(query)}'
        req = urllib.request.Request(url, headers=headers)
        res = urllib.request.urlopen(req).read().decode('utf-8')
        vqd_match = re.search(r'vqd=([\d-]+)', res)
        if not vqd_match: return None
        vqd = vqd_match.group(1)
        
        api_url = f'https://duckduckgo.com/i.js?l=us-en&o=json&q={urllib.parse.quote(query)}&vqd={vqd}&f=,,,&p=1'
        req = urllib.request.Request(api_url, headers=headers)
        res = urllib.request.urlopen(req).read().decode('utf-8')
        data = json.loads(res)
        if 'results' in data and len(data['results']) > 0:
            return data['results'][0]['image']
    except Exception as e:
        print(f"Error searching DDG: {e}")
    return None

def main():
    print("Starting exact image matching using DuckDuckGo (Google Alternative)...")
    db_path = "/Users/prasanth/Documents/project v1/dataset/stolen-vehicle-recovery/prisma/dev.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, make, model, color, imageUrl FROM RTODatabase")
    records = cursor.fetchall()
    
    print(f"Found {len(records)} records. Processing...")
    
    updated = 0
    for record in records:
        record_id, make, model, color, current_url = record
        
        # We want to re-fetch to ensure the color is strictly matched
        query = f"{color} {make} {model} car high quality"
        print(f"Fetching image for: {color} {make} {model} ...")
        
        image_url = search_ddg_image(query)
        if image_url:
            cursor.execute("UPDATE RTODatabase SET imageUrl = ? WHERE id = ?", (image_url, record_id))
            print(f"  -> Success: {image_url}")
            updated += 1
            conn.commit()
        else:
            print("  -> No image found.")
        
        time.sleep(1) # Respect rate limits
        
    conn.close()
    print(f"Finished! Updated {updated} records.")

if __name__ == "__main__":
    main()

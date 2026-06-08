import sqlite3
import urllib.request
import urllib.parse
import os
import re
import json
import time

def search_ddg_image(query):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        url = f'https://duckduckgo.com/?q={urllib.parse.quote(query)}'
        req = urllib.request.Request(url, headers=headers)
        res = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        vqd_match = re.search(r'vqd=([\d-]+)', res)
        if not vqd_match: return None
        vqd = vqd_match.group(1)
        
        api_url = f'https://duckduckgo.com/i.js?l=us-en&o=json&q={urllib.parse.quote(query)}&vqd={vqd}&f=,,,&p=1'
        req = urllib.request.Request(api_url, headers=headers)
        res = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        data = json.loads(res)
        if 'results' in data and len(data['results']) > 0:
            return data['results'][0]['image']
    except Exception as e:
        print(f"Error searching DDG: {e}")
    return None

def download_image(url, save_path):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as response, open(save_path, 'wb') as out_file:
            out_file.write(response.read())
            return True
    except Exception as e:
        print(f"  -> Download failed: {e}")
        return False

def main():
    print("Starting local image download to fix hotlinking issues...")
    db_path = "/Users/prasanth/Documents/project v1/dataset/stolen-vehicle-recovery/prisma/dev.db"
    public_dir = "/Users/prasanth/Documents/project v1/dataset/stolen-vehicle-recovery/public/cars"
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, make, model, color, imageUrl FROM RTODatabase")
    records = cursor.fetchall()
    
    updated = 0
    for record in records:
        record_id, make, model, color, current_url = record
        
        # Determine the target path
        ext = 'jpg'
        if current_url and current_url.lower().endswith('.png'): ext = 'png'
        filename = f"{record_id}.{ext}"
        filepath = os.path.join(public_dir, filename)
        local_url = f"/cars/{filename}"
        
        # If it's already a local URL and file exists, skip
        if current_url and current_url.startswith('/cars/') and os.path.exists(filepath):
            continue
            
        print(f"Processing: {color} {make} {model}")
        
        # Try to download the existing URL first if it's an http link
        success = False
        if current_url and current_url.startswith('http'):
            print(f"  Attempting to download current URL...")
            success = download_image(current_url, filepath)
            
        # If failed or no URL, search DDG and download
        if not success:
            print(f"  Searching DDG for new image...")
            query = f"{color} {make} {model} car high quality"
            new_url = search_ddg_image(query)
            if new_url:
                success = download_image(new_url, filepath)
                if not success:
                    # Try a fallback image query
                    fallback_url = search_ddg_image(f"{make} {model} car")
                    if fallback_url:
                        success = download_image(fallback_url, filepath)
            
        if success:
            cursor.execute("UPDATE RTODatabase SET imageUrl = ? WHERE id = ?", (local_url, record_id))
            conn.commit()
            updated += 1
            print(f"  -> Saved locally as {local_url}")
        else:
            print("  -> Completely failed to get image.")
            
        time.sleep(0.5)
        
    conn.close()
    print(f"Finished! Downloaded and updated {updated} records.")

if __name__ == "__main__":
    main()

import json
import os
import urllib.parse

def extract_html(file_path):
    print("Extracting HTML from HAR file...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return

    entries = data.get('log', {}).get('entries', [])
    out_dir = "extracted_html"
    os.makedirs(out_dir, exist_ok=True)
    
    for entry in entries:
        req = entry.get('request', {})
        res = entry.get('response', {})
        url = req.get('url', '')
        
        # We only want the specific lists
        if '/blindersoe-panel/' not in url:
            continue
            
        if 'list' not in url and 'history' not in url and 'timeline' not in url:
            continue
            
        endpoint = url.split('/')[-1].split('?')[0]
        res_text = res.get('content', {}).get('text', '')
        
        if not res_text or len(res_text) < 100:
            continue
            
        out_file = os.path.join(out_dir, f"{endpoint}.html")
        with open(out_file, 'w', encoding='utf-8') as out_f:
            out_f.write(res_text)
        print(f"Saved {len(res_text)} characters to {out_file}")

if __name__ == '__main__':
    extract_html('c:/Users/TUMMA/OneDrive/Desktop/InboundAIVoice-main/hiii')

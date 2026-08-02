import os
import re
import json

def extract_table_schema(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Look specifically for thead and then th
    thead_match = re.search(r'<thead.*?>(.*?)</thead>', html, flags=re.IGNORECASE | re.DOTALL)
    headers = []
    if thead_match:
        th_pattern = r'<th[^>]*>(.*?)</th>'
        raw_headers = re.findall(th_pattern, thead_match.group(1), flags=re.IGNORECASE | re.DOTALL)
        for h in raw_headers:
            cleaned = re.sub(r'<[^>]+>', '', h).strip()
            cleaned = re.sub(r'\s+', ' ', cleaned)
            if cleaned and cleaned not in ["Actions", "Action", "⋮", ""]:
                headers.append(cleaned)
    
    # Try getting first row of data from tbody
    tbody_match = re.search(r'<tbody.*?>(.*?)</tbody>', html, flags=re.IGNORECASE | re.DOTALL)
    first_row_data = []
    if tbody_match:
        tr_pattern = r'<tr[^>]*>(.*?)</tr>'
        rows = re.findall(tr_pattern, tbody_match.group(1), flags=re.IGNORECASE | re.DOTALL)
        if rows:
            td_pattern = r'<td[^>]*>(.*?)</td>'
            tds = re.findall(td_pattern, rows[0], flags=re.IGNORECASE | re.DOTALL)
            for td in tds:
                cleaned = re.sub(r'<[^>]+>', '', td).strip()
                cleaned = re.sub(r'\s+', ' ', cleaned)
                first_row_data.append(cleaned)
                
    return headers, first_row_data

def main():
    directory = 'extracted_html'
    out_file = 'db_schema.txt'
    if not os.path.exists(directory):
        print("Directory not found")
        return
        
    with open(out_file, 'w', encoding='utf-8') as out:
        for filename in os.listdir(directory):
            if filename.endswith('.html'):
                path = os.path.join(directory, filename)
                headers, first_row = extract_table_schema(path)
                
                out.write(f"=== {filename.replace('.html', '').upper()} ===\n")
                out.write(f"Columns ({len(headers)}): {', '.join(headers)}\n")
                
                # Zip headers with mock data
                schema_dict = {}
                for i, h in enumerate(headers):
                    val = first_row[i] if i < len(first_row) else 'N/A'
                    # truncate long noisy mock data like SVG paths or scripts
                    if len(val) > 100:
                        val = val[:100] + '...'
                    if val != '' and val != 'N/A':
                        schema_dict[h] = val
                    else:
                        schema_dict[h] = "string/number/etc"
                        
                out.write(json.dumps(schema_dict, indent=2, ensure_ascii=False) + "\n\n")

if __name__ == '__main__':
    main()

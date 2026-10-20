#!/usr/bin/env python3
import json
import os
import glob

# Načítať aktuálnu databázu piesní
with open('songs.json', 'r', encoding='utf-8') as f:
    songs = json.load(f)

print(f"Aktuálny počet piesní: {len(songs)}")

# Najvyššie ID
max_id = max([int(s['id'][1:]) for s in songs])
print(f"Najvyššie ID: s{max_id}")

# Kategorizácia podľa názvu súboru
def get_category_from_file(filename):
    filename_lower = filename.lower()
    if 'prosby' in filename_lower or 'liturg' in filename_lower:
        return 'vseobecne'
    elif 'adoracia' in filename_lower:
        return 'adoracia'
    elif 'poboznosti' in filename_lower or 'pobožnosti' in filename_lower:
        return 'poboznosti'
    return 'vseobecne'

# Načítať všetky JSON súbory z priečinka Texty
added_count = 0
files = glob.glob('Texty/*.json')
print(f"\nNájdené súbory: {len(files)}")

for filepath in sorted(files):
    filename = os.path.basename(filepath)
    print(f"\nSpracovávam: {filename}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Overiť štruktúru
        if 'content' not in data:
            print(f"  CHYBA: Súbor nemá pole 'content'")
            continue
        
        category = get_category_from_file(filename)
        file_name = data.get('name', filename.replace('.json', ''))
        
        print(f"  Kategória: {category}")
        print(f"  Piesní v súbore: {len(data['content'])}")
        
        # Pridať každú pieseň z content
        for item in data['content']:
            max_id += 1
            
            # Spojiť strofy
            strophes = item.get('strophes', [])
            lyrics = '\n\n'.join(strophes) if strophes else ''
            
            # Vytvoriť objekt piesne
            song = {
                "id": f"s{max_id}",
                "title": item.get('name', 'Bez názvu'),
                "category": category,
                "lyrics": lyrics,
                "number": item.get('number', '') or ''
            }
            
            songs.append(song)
            added_count += 1
    
    except Exception as e:
        print(f"  CHYBA pri spracovaní: {e}")

print(f"\n{'='*50}")
print(f"Celkom pridaných piesní: {added_count}")
print(f"Nový celkový počet: {len(songs)}")

# Štatistiky kategórií
categories = {}
for song in songs:
    cat = song['category']
    categories[cat] = categories.get(cat, 0) + 1

print(f"\nRozdelenie podľa kategórií:")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count}")

# Uložiť späť do songs.json
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(songs, f, ensure_ascii=False, indent=2)

print(f"\nHotovo! Uložené do songs.json")

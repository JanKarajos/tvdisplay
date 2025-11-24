#!/usr/bin/env python3
import json
import re

# Načítať obsah JKS súboru
with open('1. JKS.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Použiť regex na extrakciu všetkých piesní
pattern = r'\{"name":"([^"]+)","number":"([^"]*)","strophes":\[(.*?)\]\}'
matches = re.findall(pattern, content, re.DOTALL)

print(f"Nájdených piesní v JKS: {len(matches)}")

# Kategorizácia piesní
def get_category(title, lyrics):
    title_lower = title.lower()
    lyrics_lower = lyrics.lower()
    
    # Mariánske piesne
    if any(word in title_lower for word in ['mária', 'matka', 'matička', 'panna', 'kráľovná']):
        return 'marianske'
    if any(word in lyrics_lower for word in ['mária', 'matka božia', 'panna']):
        return 'marianske'
    
    # Vianočné piesne
    if any(word in title_lower for word in ['betlehem', 'vianoce', 'ježiško', 'jasle', 'anjel', 'narodil']):
        return 'vianocne'
    if any(word in lyrics_lower for word in ['betlehem', 'dieťa v jasliach', 'pastier']):
        return 'vianocne'
    
    # Veľkonočné piesne
    if any(word in title_lower for word in ['vstal z mŕtvych', 'zmŕtvychvstanie', 'veľká noc', 'aleluja']):
        return 'velkonocne'
    if 'vstal z mŕtvych' in lyrics_lower or 'zmŕtvychvstanie' in lyrics_lower:
        return 'velkonocne'
    
    return 'vseobecne'

# Vytvorenie novej databázy len z JKS piesní
songs = []
song_titles = set()  # Pre detekciu duplikátov

for i, (name, number, strophes_str) in enumerate(matches, start=1):
    # Extrahovať strofy z JSON array
    strophes_parts = re.findall(r'"([^"]*(?:""[^"]*)*)"', strophes_str)
    strophes = [s.replace('""', '"') for s in strophes_parts]
    
    # Spojiť strofy
    lyrics = '\n\n'.join(strophes)
    
    # Kontrola duplikátov
    if name in song_titles:
        print(f"  DUPLIKÁT: {name} (č. {number})")
        continue
    
    song_titles.add(name)
    
    # Vytvorenie objektu piesne
    song = {
        "id": f"s{i}",
        "title": name,
        "category": get_category(name, lyrics),
        "lyrics": lyrics,
        "number": number if number else str(i)
    }
    
    songs.append(song)

print(f"\nPo odstránení duplikátov: {len(songs)} piesní")

# Kategórie
categories = {}
for song in songs:
    cat = song['category']
    categories[cat] = categories.get(cat, 0) + 1

print("\nRozdelenie podľa kategórií:")
for cat, count in sorted(categories.items()):
    print(f"  {cat}: {count}")

# Uložiť do songs.json
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(songs, f, ensure_ascii=False, indent=2)

print(f"\nHotovo! Uložených {len(songs)} piesní do songs.json")
print(f"Prvá: {songs[0]['title']} (č. {songs[0]['number']})")
print(f"Posledná: {songs[-1]['title']} (č. {songs[-1]['number']})")

#!/usr/bin/env python3
import json

# Načítať songs.json
with open('songs.json', 'r', encoding='utf-8') as f:
    songs = json.load(f)

print(f"Celkový počet piesní pred čistením: {len(songs)}")

# Filtrovať len piesne s reálnym textom (nie testové "Pieseň XX")
valid_songs = []
removed_count = 0

for song in songs:
    # Vymažeme piesne s názvom "Pieseň XX"
    if song['title'].startswith('Pieseň ') and song['title'].split()[-1].isdigit():
        removed_count += 1
        print(f"Mažem testovaciu pieseň: {song['id']} - {song['title']}")
        continue
    
    # Vymažeme piesne s generickým textom
    if 'Toto je pieseň číslo' in song.get('lyrics', ''):
        removed_count += 1
        print(f"Mažem generickú pieseň: {song['id']} - {song['title']}")
        continue
    
    valid_songs.append(song)

print(f"\nVymazaných testových piesní: {removed_count}")
print(f"Platných piesní: {len(valid_songs)}")

# Prečíslovať ID a pridať čísla pôvodným piesňam (ktoré nemajú pole number)
renumbered_songs = []
for i, song in enumerate(valid_songs, start=1):
    new_id = f"s{i}"
    
    # Ak pieseň nemá číslo (pôvodné piesne s1-s60), pridať jej číslo podľa nového poradia
    if 'number' not in song or not song['number']:
        song['number'] = str(i)
    
    song['id'] = new_id
    renumbered_songs.append(song)
    
    if i <= 5 or i > len(valid_songs) - 5:
        print(f"{new_id}: {song['title']} (číslo: {song.get('number', 'N/A')})")

# Uložiť čisté a prečíslované piesne
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(renumbered_songs, f, ensure_ascii=False, indent=2)

print(f"\nHotovo! Uložených {len(renumbered_songs)} piesní.")
print(f"Všetky piesne majú teraz pole 'number' a sú prečíslované od s1 do s{len(renumbered_songs)}")

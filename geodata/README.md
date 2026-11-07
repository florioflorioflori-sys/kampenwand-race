# Kampenwand – Geländedaten & Streckenvorschlag

- strecke.html – Reliefkarte + interaktives Höhenprofil (auch als Artifact veröffentlicht)
- downhill_linie.geojson – Streckenlinie, Punkte alle ~10 m mit Höhe (lon, lat, z), WGS84
- downhill_gefaelle.geojson – dieselbe Linie in ~100-m-Abschnitten mit Gefälle in %
- hoehenprofil.csv / hoehenprofil.png – Distanz, Koordinaten, Höhe
- kampenwand_dem_terrarium.tif – Höhenmodell (GeoTIFF, EPSG:4326) für Felt/QGIS
- heightmap_4km_2049px_16bit.png / .r16 – Platzhalter-Heightmap 4×4 km für Godot (Terrain3D/HTerrain), Metadaten in heightmap_info.json

Strecke: Bergstation Kampenwandbahn (1461 m) → Talstation Aschau (620 m), 2,91 km, 813 Hm, Ø 28 %.
Quelle jetzt: AWS Terrain Tiles (grob, Gipfel ~1600 statt 1669 m). Ziel: DGM1 Bayern (1 m, CC BY 4.0) + OSM-Wege.

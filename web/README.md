# Browser-Vorabversion (Three.js)

Spielbare Vorschau des Kampenwand-Rennens im Browser: eine einzelne HTML-Datei, die das Höhenmodell und die Downhill-Linie eingebettet mitbringt.

- `src/game.html` – Spielcode (Three.js 0.160 über jsDelivr), mit Platzhaltern für die Daten
- `build.py` – bettet Heightmap und Strecke ein: `python3 web/build.py <ordner-mit-geodaten>`
- `dist/kampenwand-downhill.html` – fertige Datei, direkt im Browser öffnen

Inhalt: Gelände aus der 4×4-km-Heightmap (auf 2 m Raster, Strecke eingefräst mit Anliegern und 12 Kickern), Bike-Physik mit Haftgrenze, Bunny Hop, Sprüngen und Stürzen, 5 KI-Fahrer, Wald mit Herbstlaub, Seilbahn Bergstation–Talstation, Absperrband, Zuschauer, Minikarte und Höhenprofil. Steuerung: Tastatur, Gamepad oder Touch.

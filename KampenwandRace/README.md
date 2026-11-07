# Kampenwand Downhill – Unreal Engine 5

Mountainbike-Rennen von der Bergstation der Kampenwandbahn (1437 m) hinunter nach Aschau (624 m)
gegen fünf KI-Fahrer. Gelände, Strecke, Sprünge und Gondelbahn kommen aus den echten Geodaten.

## Was drin ist

| Bereich | Umsetzung |
|---|---|
| Gelände | 4 × 4 km Kampenwand-Heightmap als UE-Landscape (2017 × 2017 Punkte, ~2 m Raster), Trail ins Gelände eingearbeitet |
| Strecke | 2,8 km Downhill-Linie als Spline, rot-weißes Absperrband, 11 Holz-Kicker, Start- und Zielbogen |
| Bike-Physik | Chaos-Starrkörper (92 kg), Gabel + Dämpfer je 200 mm mit Progression und Durchschlagpuffer, Reifen mit Schlupf und Reibungskreis, Roll- und Luftwiderstand, Schräglage aus Tempo und Kurvenradius |
| Fahrer | Hüfte als Masse-Feder-System: Beine strecken sich in der Luft und federn Landungen sichtbar ab, angetrieben von den echten Beschleunigungen des Rahmens. Beine/Arme per IK an Pedalen und Lenker, Kurbel dreht beim Treten |
| Luft | Vor/zurück lehnen, Whip, Airtime- und 360-Anzeige, Stürze bei harter/querer Landung oder Baumkontakt |
| Gondelbahn | Kampenwandbahn mit Berg-/Talstation, 10 Stützen und umlaufenden Kabinen. Die Stützen sind so berechnet, dass das durchhängende Seil überall mindestens 12 m über dem Gelände bleibt – keine Kabine fährt mehr in die Wand |
| Welt | ~45 000 Bäume (Fichten bis zur Waldgrenze, Buchen im Tal), Zuschauer an Start, Ziel und entlang der Strecke, Sonne, Himmel, Wolken, Nebel mit Lumen-Licht |
| Rennen | Countdown, Zeitnahme, Platzierung, Höhenprofil mit allen Fahrern, Ergebnisliste |

Bike, Fahrer und Bäume sind vorerst aus Grundformen gebaut, damit das Projekt ohne fremde Assets läuft.
Sie lassen sich später durch Modelle aus Fab (z. B. kostenlose Megascans-Bäume) ersetzen.

## Einrichten (einmalig, Windows)

Voraussetzung: Epic Games Launcher mit **Unreal Engine 5.4 oder neuer** und **Visual Studio 2022**
mit den Workloads „Spieleentwicklung mit C++“ und „Desktopentwicklung mit C++“.

1. **Projekt holen:** Ordner `KampenwandRace` in einen kurzen Pfad ohne Umlaute legen, z. B. `C:\Spiele\KampenwandRace`.
2. **Bauen:** Doppelklick auf `KampenwandRace.uproject`.
   - Fragt UE nach der Engine-Version: die installierte wählen.
   - Bei „Module fehlen … jetzt neu erstellen?“ auf **Ja**. Das erste Kompilieren dauert ein paar Minuten.
   - Klappt das nicht: Rechtsklick auf die `.uproject` → *Weitere Optionen* → **Generate Visual Studio project files**,
     dann `KampenwandRace.sln` öffnen und oben **Erstellen → Projektmappe erstellen** (Konfiguration *Development Editor*).
3. **Leeres Level:** *Datei → Neues Level → Leeres Level* (nicht „Open World“).
4. **Gelände importieren:** Landschaftsmodus (`Umschalt+2`) → *Verwalten → Neu* → **Aus Datei importieren**
   - Heightmap-Datei: `RawData/Kampenwand_Heightmap_2017.png`
   - Position: **X 0, Y 0, Z 50040,3**
   - Skalierung: **X 198,4127, Y 198,4127, Z 194,2981**
   - Abschnitts- und Komponentengröße so lassen, wie UE sie aus der Datei vorschlägt (2017 × 2017), dann **Importieren**.
5. **Material und Ausrichtung:** *Werkzeuge → Python-Skript ausführen…* → `Content/Python/kampenwand_setup.py`.
   Das Skript baut das Geländematerial (Wiese, Alm, Fels, Erdtrail) und setzt die Landscape exakt auf die Position,
   auf die Strecke, Bäume und Gondelbahn berechnet sind.
6. **Speichern:** `Strg+S` → `Content/Maps/` → Name **Kampenwand**.
7. **Losfahren:** `Alt+P` (oder grüner Play-Knopf).

Licht, Himmel, Wolken und Nebel setzt das Spiel selbst, wenn das Level keine hat.

## Steuerung

| Aktion | Tastatur | Gamepad |
|---|---|---|
| Treten / in der Luft nach vorn lehnen | W / ↑ | RT / Stick hoch |
| Bremsen / in der Luft zurücklehnen | S / ↓ | LT / Stick runter |
| Lenken / in der Luft whippen | A D / ← → | linker Stick |
| Tief gehen, loslassen = abdrücken (Bunny-Hop, Pop am Kicker) | Leertaste | A |
| Zurück auf die Strecke | R | Y |
| Kamera (Verfolger / Helm) | C | B |
| Neues Rennen | Enter | Start |

## Aufbau

```
KampenwandRace/
  KampenwandRace.uproject
  Config/                     Lumen, Virtual Shadow Maps, DX12, GameMode
  Content/KampenwandData/     world.json: Strecke, Sprünge, Gondelstützen, Bäume, Zuschauer
  Content/Python/             kampenwand_setup.py (Editor-Skript)
  RawData/                    Heightmap + Trail-Maske für den Import
  Source/KampenwandRace/
    KWBike         Fahrphysik, Federung, Reifen, Fahrer-Masse-Feder, IK, KI
    KWTrack        Spline, Absperrband, Kicker, Start/Ziel
    KWGondolaLift  Kampenwandbahn mit Stützen und Kabinen
    KWForest       Wald und Zuschauer
    KWGameMode     Weltaufbau, Start, Zeitnahme, Platzierungen
    KWHUD          Anzeige
    KWPlayerController  Tastatur/Gamepad
../Tools/prepare_ue_data.py   erzeugt world.json und die Heightmap aus ../geodata
```

Die Daten neu erzeugen (z. B. wenn DGM1 Bayern als bessere Heightmap vorliegt):
`python Tools/prepare_ue_data.py` (braucht `numpy` und `Pillow`). Die neuen Import-Werte stehen danach in der Ausgabe
und in `world.json` unter `landscape`.

## Bekannte Grenzen

- Geländedaten sind noch die groben AWS-Terrain-Tiles (Gipfel ~1600 statt 1669 m). Mit DGM1 Bayern (1 m) wird es deutlich genauer.
- Die Lage der Gondelbahn-Stationen ist aus Start und Ziel der Strecke abgeleitet, nicht vermessen.
- Grafik der Fahrer/Bikes/Bäume ist Platzhalter aus Grundformen.

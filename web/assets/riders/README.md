# Fahrer und Bike (eigene Modelle)

`rider.glb` und `bike.glb` sind komplett per Skript in Blender gebaut:
`web/assets/blender/rider.py` und `web/assets/blender/bike.py`.

Neu erzeugen (Blender als Python-Modul, `pip install bpy`):

    python web/assets/blender/rider.py rider_raw.glb [vorschau.png]
    python web/assets/blender/bike.py bike_raw.glb [vorschau.png]

Danach mit glTF-Transform verdichten (weld, quantize). Die Materialnamen
(Jersey, Pants, Helmet, Paint …) färbt das Spiel je Fahrer ein.

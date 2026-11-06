#!/bin/bash
# usage: hprev.sh glb out  -> 3 Frisuren je vorn/hinten
G=$1; O=$2; B=HatBeanie,Pompom,HatCap,HatTyrol,TyrolBand,Feather,Scarf,Backpack,Glasses,Beard
EY=${EY:-1.71}
for st in Short Long Pony; do
  H=$B; for o in Short Long Pony; do [ $o != $st ] && H=$H,Hair$o,Hair${o}C; done
  HIDE=$H LOOK=0,-0.02,$EY POS=0.32,-0.55,$(python3 -c "print($EY+0.08)") ./venv/bin/python preview.py -- shots/_a$st.png $G >/dev/null 2>&1 &
  HIDE=$H LOOK=0,0.0,$(python3 -c "print($EY-0.04)") POS=-0.3,0.55,$(python3 -c "print($EY+0.1)") ./venv/bin/python preview.py -- shots/_b$st.png $G >/dev/null 2>&1 &
done; wait
python3 -c "
from PIL import Image
c=Image.new('RGB',(2700,1800))
for i,st in enumerate(['Short','Long','Pony']):
  c.paste(Image.open('shots/_a'+st+'.png'),(i*900,0)); c.paste(Image.open('shots/_b'+st+'.png'),(i*900,900))
c.resize((1350,900)).save('$O')"

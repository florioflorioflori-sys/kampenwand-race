# Zweiter Durchgang: K -> C mit geglätteten Boxen je Frame (boxes.json)
import sys, json, glob, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1920, 1080
FONT = glob.glob('/usr/share/fonts/**/LiberationSerif-Regular.ttf', recursive=True)[0]
BOX = {int(k): v for k, v in json.load(open('boxes.json')).items()}
log = open('k2.log', 'w')
fi = 0
while True:
    buf = sys.stdin.buffer.read(W * H * 3)
    if len(buf) < W * H * 3: break
    fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
    if fi in BOX:
        x0, x1, y0, y1 = BOX[fi]
        hgt = y1 - y0; pad = 6
        X0, X1 = int(np.floor(x0)) - pad, int(np.ceil(x1)) + pad
        A0, A1 = int(np.floor(y0)) - pad, int(np.ceil(y1)) + pad
        n = A1 - A0
        reg = fr[A0:A1, X0:X1].astype(np.float32)
        top = fr[A0 - 2:A0, X0:X1].astype(np.float32).mean(axis=0); bot = fr[A1:A1 + 2, X0:X1].astype(np.float32).mean(axis=0)
        w = (np.arange(n) + 0.5)[:, None, None] / n
        fill = top[None] * (1 - w) + bot[None] * w
        diff = (reg - fill).mean(axis=2)
        amp = max(0.0, float(np.percentile(diff, 99.0)))
        sel = diff > amp * 0.6
        # Schriftfarbe als Differenz zum Hintergrund (funktioniert auch beim Ein-/Ausblenden)
        dcol = (reg - fill)[sel].mean(axis=0) if sel.sum() > 5 and amp > 2 else np.zeros(3, np.float32)
        soft = ((diff > amp * 0.15) & (diff < amp * 0.6)).sum() / max(1, sel.sum())
        S = 4
        im = Image.new('L', ((X1 - X0) * S, n * S), 0); dr = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT, 200); bb = dr.textbbox((0, 0), 'C', font=f)
        size = int(200 * hgt * S / (bb[3] - bb[1]))
        f = ImageFont.truetype(FONT, size); bb = dr.textbbox((0, 0), 'C', font=f); gw = bb[2] - bb[0]
        cx = ((x0 + x1) / 2 - X0) * S
        dr.text((cx - gw / 2 - bb[0], (y0 - A0) * S - bb[1]), 'C', font=f, fill=255)
        im = im.resize((X1 - X0, n), Image.LANCZOS)
        if soft > 1.0: im = im.filter(ImageFilter.GaussianBlur(float(min(2.5, (soft - 1.0) * 0.9))))
        a = np.asarray(im, np.float32)[:, :, None] / 255.0
        out = fill + a * dcol[None, None] * 1.06
        # weicher Rand, damit keine Kante zum Original sichtbar wird
        e = np.ones((n, X1 - X0, 1), np.float32)
        for i in range(3):
            e[i, :] = e[-1 - i, :] = (i + 1) / 4; e[:, i] = np.minimum(e[:, i], (i + 1) / 4); e[:, -1 - i] = np.minimum(e[:, -1 - i], (i + 1) / 4)
        res = reg * (1 - e) + out * e
        fr[A0:A1, X0:X1] = np.clip(res, 0, 255).astype(np.uint8)
        log.write(f'{fi} amp{amp:.0f} soft{soft:.2f} dcol{np.round(dcol).tolist()}\n')
    sys.stdout.buffer.write(fr.tobytes())
    fi += 1

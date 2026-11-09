# Ersetzt im Oischi-Intro das K von PRODUKTION durch ein C (PRODUCTION).
# Liest rohe RGB-Frames von stdin, schreibt korrigierte Frames nach stdout.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1920, 1080
Y0, Y1 = 665, 860          # Band, in dem der Untertitel liegt
FONT = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'
import glob
fs = glob.glob('/usr/share/fonts/**/LiberationSerif-Regular.ttf', recursive=True)
FONT = fs[0]
log = open(sys.argv[1], 'w') if len(sys.argv) > 1 else sys.stderr

def blur1d(a, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    return np.convolve(np.pad(a, r, mode='edge'), k, mode='valid')

def boxblur2(img, r):
    # einfache Trennbare Box-Unschärfe (2D) für Hintergrundschätzung
    out = img.copy()
    c = np.cumsum(np.pad(out, ((0, 0), (r + 1, r)), mode='edge'), axis=1); out = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    c = np.cumsum(np.pad(out, ((r + 1, r), (0, 0)), mode='edge'), axis=0); out = (c[2 * r + 1:, :] - c[:-2 * r - 1, :]) / (2 * r + 1)
    return out

prev = None
fi = 0
while True:
    buf = sys.stdin.buffer.read(W * H * 3)
    if len(buf) < W * H * 3: break
    fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
    band = fr[Y0:Y1].astype(np.float32)
    lum = band.mean(axis=2)
    d = lum - boxblur2(lum, 14)
    mx = d.max()
    done = False
    if mx > 10:
        m = d > max(6.0, mx * 0.3)
        rows = np.where(m.sum(axis=1) > 3)[0]
        if len(rows):
            # Zeilenblock mit den meisten Treffern (Untertitel)
            prof = m.sum(axis=1).astype(float); prof = blur1d(prof, 6)
            cy = int(np.argmax(prof))
            r0 = max(0, cy - 40); r1 = min(Y1 - Y0, cy + 40)
            cols = m[r0:r1].sum(axis=0) > 0
            segs = []; x = 0
            while x < W:
                if cols[x]:
                    s = x
                    while x < W and cols[x]: x += 1
                    segs.append([s, x])
                else: x += 1
            # kleine Lücken schließen (K besteht aus zwei Teilen)
            mg = []
            for s in segs:
                if mg and s[0] - mg[-1][1] <= 3: mg[-1][1] = s[1]
                else: mg.append(s)
            letters = [s for s in mg if 8 <= s[1] - s[0] <= 90]
            cen = np.array([(a + b) / 2 for a, b in letters]); gaps = np.diff(cen) if len(cen) > 1 else np.array([0.0])
            if len(letters) == 10 and gaps.mean() > 30 and gaps.std() / gaps.mean() < 0.25:
                ks, ke = letters[5]
                ty = np.where(m[r0:r1, ks:ke].any(axis=1))[0]
                ky0, ky1 = r0 + ty[0], r0 + ty[-1] + 1
                if ky1 - ky0 >= 16:
                    us, ue = letters[4]
                    prev = (ks, ke, ky0, ky1, us, ue)
                    done = True
    if done:
        ks, ke, ky0, ky1, us, ue = prev
        hgt = ky1 - ky0
        pad = max(3, hgt // 6)
        X0, X1 = ks - pad, ke + pad + 2
        A0, A1 = Y0 + ky0 - pad, Y0 + ky1 + pad
        # Hintergrund: senkrecht zwischen Zeile darüber und darunter interpolieren
        top = fr[A0 - 2:A0].astype(np.float32).mean(axis=0); bot = fr[A1:A1 + 2].astype(np.float32).mean(axis=0)
        n = A1 - A0
        w = (np.arange(n) + 0.5)[:, None, None] / n
        fill = top[None, X0:X1] * (1 - w) + bot[None, X0:X1] * w
        # Farbe/Deckkraft der Schrift aus dem U
        ureg = fr[A0:A1, us:ue].astype(np.float32)
        ubg = (fr[A0 - 2:A0, us:ue].astype(np.float32).mean(axis=0)[None] * (1 - w) + fr[A1:A1 + 2, us:ue].astype(np.float32).mean(axis=0)[None] * w)
        diff = (ureg - ubg).mean(axis=2)
        amp = np.percentile(diff, 99.3)
        sel = diff > amp * 0.6
        col = (ureg[sel].mean(axis=0) if sel.any() else np.array([200, 210, 225], np.float32))
        # Unschärfe abschätzen: Anteil halbheller Pixel im U
        soft = ((diff > amp * 0.15) & (diff < amp * 0.6)).sum() / max(1, sel.sum())
        # C zeichnen (Großbuchstabe, Höhe = Versalhöhe)
        S = 4; cw = (X1 - X0) * S; ch = n * S
        im = Image.new('L', (cw, ch), 0); dr = ImageDraw.Draw(im)
        size = int(hgt * S / 0.66)
        f = ImageFont.truetype(FONT, size)
        bb = dr.textbbox((0, 0), 'C', font=f)
        gw, gh = bb[2] - bb[0], bb[3] - bb[1]
        sc = hgt * S / gh
        f = ImageFont.truetype(FONT, max(4, int(size * sc)))
        bb = dr.textbbox((0, 0), 'C', font=f); gw, gh = bb[2] - bb[0], bb[3] - bb[1]
        cxm = ((ks + ke) / 2 - X0) * S
        dr.text((cxm - gw / 2 - bb[0], pad * S - bb[1]), 'C', font=f, fill=255)
        im = im.resize((X1 - X0, n), Image.LANCZOS)
        if soft > 1.2: im = im.filter(ImageFilter.GaussianBlur(float(min(3, (soft - 1.2) * 0.8))))
        a = np.asarray(im, np.float32)[:, :, None] / 255.0
        # Deckkraft: gemessene Helligkeitsdifferenz relativ zur Schriftfarbe
        bgm = fill.mean(axis=(0, 1)); op = np.clip(amp / max(1.0, (col.mean() - bgm.mean())), 0, 1)
        out = fill * (1 - a * op) + col[None, None] * (a * op)
        fr[A0:A1, X0:X1] = np.clip(out, 0, 255).astype(np.uint8)
        log.write(f'{fi} K {ks}-{ke} y{ky0+Y0}-{ky1+Y0} amp{amp:.0f} soft{soft:.2f} op{op:.2f}\n')
    else:
        log.write(f'{fi} - mx{mx:.0f}\n')
    sys.stdout.buffer.write(fr.tobytes())
    fi += 1

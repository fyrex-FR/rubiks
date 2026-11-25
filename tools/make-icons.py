# Fabrique les icônes de l'app (écran d'accueil de l'iPad) : python3 tools/make-icons.py
from PIL import Image, ImageDraw, ImageFilter
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'icons')
COLORS = {'W': '#f7f7f2', 'Y': '#ffd21f', 'R': '#e3262f', 'O': '#ff8a1c', 'B': '#1f63e6', 'G': '#16a94a'}
FACE = ['Y', 'W', 'R', 'G', 'Y', 'O', 'B', 'W', 'Y']  # le même cube que le logo du site
S = 1024  # on dessine en grand, puis on réduit (bords nets)


def gradient(size):
    top, mid, bot = (0x3a, 0x5d, 0x9c), (0x1d, 0x2f, 0x57), (0x12, 0x1f, 0x3d)
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y) / (size * 1.35)
            a, b, u = (top, mid, t / 0.6) if t < 0.6 else (mid, bot, (t - 0.6) / 0.4)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))
    return img


def draw(cube_frac):
    bg = gradient(256).resize((S, S), Image.BICUBIC).convert('RGBA')
    # le cube : un carré noir arrondi avec 9 autocollants, un peu penché
    n = int(S * cube_frac)
    cube = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(cube)
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.14), fill='#15171a')
    pad, gap = n * 0.06, n * 0.035
    cell = (n - 2 * pad - 2 * gap) / 3
    for i, c in enumerate(FACE):
        r, k = divmod(i, 3)
        x0, y0 = pad + k * (cell + gap), pad + r * (cell + gap)
        d.rounded_rectangle([x0, y0, x0 + cell, y0 + cell], radius=int(cell * 0.18), fill=COLORS[c])
    cube = cube.rotate(8, resample=Image.BICUBIC, expand=True)
    shadow = Image.new('RGBA', cube.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 140), mask=cube.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.02))
    ox, oy = (S - cube.size[0]) // 2, (S - cube.size[1]) // 2
    bg.alpha_composite(shadow, (ox, oy + int(S * 0.025)))
    bg.alpha_composite(cube, (ox, oy))
    return bg.convert('RGB')


normal = draw(0.62)
maskable = draw(0.50)  # marge plus grande : Android/iPad peuvent rogner en rond
for name, img, size in [('icon-512.png', normal, 512), ('icon-192.png', normal, 192),
                        ('apple-touch-icon.png', normal, 180), ('icon-maskable-512.png', maskable, 512)]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, name), optimize=True)
    print(name)

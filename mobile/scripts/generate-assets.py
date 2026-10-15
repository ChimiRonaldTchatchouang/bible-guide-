"""
Génère l'icône, les icônes adaptatives Android et l'écran de démarrage de Guide du chrétien.
Usage : python3 scripts/generate-assets.py   (depuis le dossier mobile/)
Nécessite Pillow et la police Lora (@expo-google-fonts/lora).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf"
FONT_ITALIC = ROOT / "node_modules/@expo-google-fonts/lora/400Regular_Italic/Lora_400Regular_Italic.ttf"

NAVY = (30, 43, 71)
NAVY_DEEP = (19, 28, 48)
GOLD = (214, 168, 79)
GOLD_LIGHT = (240, 207, 140)
CREAM = (251, 247, 239)
SS = 4  # suréchantillonnage pour des bords lisses


def emblem(size: int, color=GOLD, light=GOLD_LIGHT, glow=True) -> Image.Image:
    """Livre ouvert surmonté d'une croix, centré, sur fond transparent."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = S / 100  # unité : 1 % de la taille

    if glow:
        halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        hd.ellipse([30 * u, 8 * u, 70 * u, 48 * u], fill=(*light, 90))
        halo = halo.filter(ImageFilter.GaussianBlur(9 * u))
        img.alpha_composite(halo)

    # Croix
    cw = 5.2 * u
    cx = 50 * u
    d.rounded_rectangle([cx - cw / 2, 12 * u, cx + cw / 2, 50 * u], radius=1.2 * u, fill=light)
    d.rounded_rectangle([38 * u, 22 * u, 62 * u, 22 * u + cw], radius=1.2 * u, fill=light)

    # Livre ouvert : deux pages incurvées
    def page(side: int):
        pts = []
        steps = 40
        for i in range(steps + 1):
            t = i / steps
            x = 50 * u + side * (t * 38 * u)
            y_top = 56 * u - (1 - (2 * t - 1) ** 2) * 4 * u + t * 2 * u
            pts.append((x, y_top))
        for i in range(steps, -1, -1):
            t = i / steps
            x = 50 * u + side * (t * 38 * u)
            y_bot = 84 * u - (1 - (2 * t - 1) ** 2) * 3 * u + t * 1 * u
            pts.append((x, y_bot))
        d.polygon(pts, fill=color)

    page(-1)
    page(1)
    # Pli central et lignes de texte
    d.line([(50 * u, 54 * u), (50 * u, 85 * u)], fill=NAVY_DEEP + (255,), width=int(1.4 * u))
    for side in (-1, 1):
        for k in range(4):
            y = 63 * u + k * 5.2 * u
            x1 = 50 * u + side * 7 * u
            x2 = 50 * u + side * (31 - k * 1.5) * u
            d.line([(min(x1, x2), y), (max(x1, x2), y)], fill=NAVY_DEEP + (150,), width=int(1.1 * u))

    return img.resize((size, size), Image.LANCZOS)


def gradient_bg(size: int) -> Image.Image:
    bg = Image.new("RGB", (size, size), NAVY)
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / size
        c = tuple(int(NAVY[i] * (1 - t) + NAVY_DEEP[i] * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return bg


def main():
    ASSETS.mkdir(exist_ok=True)

    # Icône principale (iOS / générique) : pleine surface
    icon = gradient_bg(1024).convert("RGBA")
    mark = emblem(820)
    icon.alpha_composite(mark, ((1024 - 820) // 2, (1024 - 820) // 2 + 10))
    icon.convert("RGB").save(ASSETS / "icon.png")

    # Android adaptatif : premier plan dans la zone sûre (≈ 66 %)
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg.alpha_composite(emblem(600), (212, 220))
    fg.save(ASSETS / "android-icon-foreground.png")
    gradient_bg(1024).save(ASSETS / "android-icon-background.png")
    mono = emblem(600, color=(255, 255, 255), light=(255, 255, 255), glow=False)
    mono_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mono_canvas.alpha_composite(mono, (212, 220))
    # Les lignes du livre doivent rester des « trous » dans l'icône monochrome
    alpha = mono_canvas.split()[3]
    white = Image.new("RGBA", (1024, 1024), (255, 255, 255, 255))
    white.putalpha(alpha)
    white.save(ASSETS / "android-icon-monochrome.png")

    # Écran de démarrage : emblème + nom de l'app (fond géré par expo-splash-screen)
    W = 1200
    splash = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    splash.alpha_composite(emblem(640), ((W - 640) // 2, 40))
    d = ImageDraw.Draw(splash)
    title_font = ImageFont.truetype(str(FONT), 112)
    sub_font = ImageFont.truetype(str(FONT_ITALIC), 52)
    title = "Guide du chrétien"
    tw = d.textlength(title, font=title_font)
    d.text(((W - tw) / 2, 720), title, font=title_font, fill=CREAM)
    sub = "La Parole pour chaque saison de la vie"
    sw = d.textlength(sub, font=sub_font)
    d.text(((W - sw) / 2, 880), sub, font=sub_font, fill=GOLD_LIGHT)
    splash.save(ASSETS / "splash-icon.png")

    # Favicon web
    icon.resize((48, 48), Image.LANCZOS).convert("RGB").save(ASSETS / "favicon.png")

    # Aperçu (non utilisé par l'app) pour vérifier le rendu du splash
    preview = Image.new("RGBA", (1080, 2340), NAVY + (255,))
    s = splash.resize((760, 760), Image.LANCZOS)
    preview.alpha_composite(s, ((1080 - 760) // 2, (2340 - 760) // 2))
    preview.convert("RGB").save(ROOT / "scripts" / "splash-preview.png")
    print("✔ Visuels générés dans assets/")


if __name__ == "__main__":
    main()

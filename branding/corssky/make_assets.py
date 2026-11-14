#!/usr/bin/env python3
"""Draws the Corssky brand assets (app icons, store/social image, Android/iOS icon layers and splash screens).
Needs rsvg-convert (librsvg). Output: ./svg (sources) and ./png (everything the build copies).
Run:  python3 make_assets.py"""
import math
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SVG, PNG = os.path.join(HERE, 'svg'), os.path.join(HERE, 'png')

DEFS = '''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d3d63"/><stop offset=".55" stop-color="#0d2038"/><stop offset="1" stop-color="#06101d"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="48%" r="52%"><stop offset="0" stop-color="#ffa31a" stop-opacity=".38"/><stop offset=".6" stop-color="#ff8a00" stop-opacity=".08"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></radialGradient>
<linearGradient id="face" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#ffcb66"/><stop offset=".55" stop-color="#ffa31a"/><stop offset="1" stop-color="#f08a00"/></linearGradient>
<radialGradient id="hole" cx="42%" cy="36%" r="72%"><stop offset="0" stop-color="#1f3a5c"/><stop offset="1" stop-color="#071223"/></radialGradient>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>'''


def mark(cx, cy, s):
    """The mark: a hex nut with a white "C" in its hole."""
    R = 318 * s
    pts = [(cx + R * math.cos(math.radians(-90 + 60 * i)), cy + R * math.sin(math.radians(-90 + 60 * i))) for i in range(6)]
    shades = ['#ffb43a', '#f39400', '#d77800', '#c66c00', '#e88c00', '#ffc65c']
    out = ''.join('<path d="M%.1f %.1fL%.1f %.1fL%.1f %.1fZ" fill="%s"/>' % (cx, cy, pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], shades[i]) for i in range(6))
    top = ' '.join('%.1f,%.1f' % (cx + R * .82 * math.cos(math.radians(-90 + 60 * i)), cy + R * .82 * math.sin(math.radians(-90 + 60 * i))) for i in range(6))
    out += '<polygon points="%s" fill="url(#face)"/><polygon points="%s" fill="none" stroke="#fff3d6" stroke-opacity=".38" stroke-width="%.1f"/>' % (top, top, 3.8 * s)
    out += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#fff" opacity=".15" transform="rotate(-24 %.1f %.1f)"/>' % (cx - 78 * s, cy - 150 * s, 120 * s, 40 * s, cx - 78 * s, cy - 150 * s)
    out += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#9a4f00"/><circle cx="%.1f" cy="%.1f" r="%.1f" fill="url(#hole)"/>' % (cx, cy, 164 * s, cx, cy, 150 * s)
    r, a0, a1 = 92 * s, 42, 318
    x0, y0 = cx + r * math.cos(math.radians(a0)), cy - r * math.sin(math.radians(a0))
    x1, y1 = cx + r * math.cos(math.radians(a1)), cy - r * math.sin(math.radians(a1))
    out += '<path d="M%.1f %.1fA%.1f %.1f 0 1 0 %.1f %.1f" fill="none" stroke="#fff" stroke-width="%.1f" stroke-linecap="round"/>' % (x0, y0, r, r, x1, y1, 54 * s)
    out += '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#ffa31a"/>' % (cx + r * .98, cy, 13 * s)
    return out


def backdrop(w, h, gx, gy, gr):
    lines = ''.join('<path d="M%d %dL%d 0" stroke="#fff" stroke-opacity=".035" stroke-width="%d"/>' % (x, h, x + int(h * .41), max(18, w // 40)) for x in range(-h, w + h, max(90, w // 9)))
    return '<rect width="%d" height="%d" fill="url(#bg)"/>%s<circle cx="%d" cy="%d" r="%d" fill="url(#glow)"/>' % (w, h, lines, gx, gy, gr)


def svg(w, h, body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">%s%s</svg>' % (w, h, w, h, DEFS, body)


shadow = '<ellipse cx="530" cy="842" rx="300" ry="48" fill="#000" opacity=".5" filter="url(#sh)"/>'
FILES = {
    # rounded app icon (web, favicon, Windows)
    'icon': svg(1024, 1024, '<clipPath id="r"><rect width="1024" height="1024" rx="232"/></clipPath><g clip-path="url(#r)">' + backdrop(1024, 1024, 512, 500, 470) + shadow + mark(512, 500, 1.0) + '</g>'),
    # square, full-bleed (iOS and "maskable" Android icons crop it themselves)
    'icon-full': svg(1024, 1024, backdrop(1024, 1024, 512, 500, 470) + shadow.replace('842', '800') + mark(512, 500, .78)),
    # Android adaptive icon layers
    'icon-foreground': svg(1024, 1024, mark(512, 512, .9)),
    'icon-background': svg(1024, 1024, backdrop(1024, 1024, 512, 512, 470)),
    # splash screens
    'splash': svg(2732, 2732, backdrop(2732, 2732, 1366, 1290, 1100) + mark(1366, 1250, 1.25) +
                  '<text x="1366" y="1860" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="190" fill="#fff" letter-spacing="4">Corssky</text>'),
    # social / store banner
    'og': svg(1200, 630, backdrop(1200, 630, 290, 315, 330) + mark(290, 305, .62) +
              '<text x="1110" y="250" text-anchor="end" font-family="Poppins" font-weight="700" font-size="104" fill="#fff" letter-spacing="2">Corssky</text>'
              '<text x="1110" y="345" text-anchor="end" font-family="DejaVu Sans" font-weight="700" font-size="44" fill="#ffa31a">قطع غيار الكوري والياباني</text>'
              '<text x="1110" y="415" text-anchor="end" font-family="Poppins" font-weight="500" font-size="34" fill="#c9d6e6">Korean &amp; Japanese car parts</text>'
              '<rect x="610" y="470" width="500" height="6" rx="3" fill="#ffa31a" opacity=".85"/>'),
}
# png name -> (svg source, width, height)
RENDERS = {
    'icon-1024.png': ('icon', 1024, 1024), 'icon-512.png': ('icon', 512, 512), 'icon-192.png': ('icon', 192, 192),
    'favicon-64.png': ('icon', 64, 64), 'favicon-32.png': ('icon', 32, 32),
    'apple-touch-icon.png': ('icon-full', 180, 180), 'icon-ios-1024.png': ('icon-full', 1024, 1024),
    'maskable-1024.png': ('icon-full', 1024, 1024), 'maskable-512.png': ('icon-full', 512, 512), 'og.png': ('og', 1200, 630),
    'app-icon-only.png': ('icon-full', 1024, 1024), 'app-icon-foreground.png': ('icon-foreground', 1024, 1024),
    'app-icon-background.png': ('icon-background', 1024, 1024), 'app-splash.png': ('splash', 2732, 2732), 'app-splash-dark.png': ('splash', 2732, 2732),
}

if __name__ == '__main__':
    os.makedirs(SVG, exist_ok=True)
    os.makedirs(PNG, exist_ok=True)
    for name, text in FILES.items():
        with open(os.path.join(SVG, name + '.svg'), 'w', encoding='utf-8') as f:
            f.write(text)
    for out, (src, w, h) in RENDERS.items():
        subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), os.path.join(SVG, src + '.svg'), '-o', os.path.join(PNG, out)], check=True)
    print('wrote', len(FILES), 'svg and', len(RENDERS), 'png files')

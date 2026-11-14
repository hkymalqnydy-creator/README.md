#!/usr/bin/env python3
"""Draws the CROSSKY brand assets from the company's wordmark: app icons, the link-preview image, Android/iOS
icon layers and splash screens, plus the wordmark in white (for the blue bar) and in royal blue (for paper).
The look follows the CROSSKY box: royal blue, the white wordmark, a silver panel cut by a thin red stripe.
svg/wordmark.svg was traced from a photo of the company's box (white on transparent).
Needs rsvg-convert (librsvg).  Run:  python3 make_assets.py"""
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
SVG, PNG = os.path.join(HERE, 'svg'), os.path.join(HERE, 'png')
ROYAL, ROYAL_HI, ROYAL_LO = '#2F54E6', '#3B62F2', '#2343D2'
RED, SILVER, SILVER_LO, NAVY = '#E8362F', '#E3E7EF', '#C9D0DD', '#0B1435'

_src = open(os.path.join(SVG, 'wordmark.svg'), encoding='utf-8').read()
WM_W, WM_H = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', _src).groups())
WM_D = re.search(r' d="([^"]+)"', _src).group(1)
# the two linked S of the wordmark, on their own, for icons too small for the whole name
LINKS = ''.join(s for s in re.findall(r'M[^MZ]+Z', WM_D) if 300 < float(s[1:].split()[0]) < 540)
LINKS_BOX = (312.0, 19.0, 214.0, 135.0)

DEFS = f'''<defs>
<linearGradient id="royal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{ROYAL_HI}"/><stop offset="1" stop-color="{ROYAL_LO}"/></linearGradient>
<linearGradient id="silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{SILVER}"/><stop offset="1" stop-color="{SILVER_LO}"/></linearGradient>
</defs>'''


def wordmark(cx, cy, width, fill='#fff'):
    s = width / WM_W
    return f'<path fill-rule="evenodd" fill="{fill}" transform="translate({cx - width / 2:.1f} {cy - WM_H * s / 2:.1f}) scale({s:.5f})" d="{WM_D}"/>'


def links(cx, cy, width, fill='#fff'):
    x, y, w, h = LINKS_BOX
    s = width / w
    return f'<path fill-rule="evenodd" fill="{fill}" transform="translate({cx - width / 2:.1f} {cy - h * s / 2:.1f}) scale({s:.5f}) translate({-x} {-y})" d="{LINKS}"/>'


def panel(w, h, y_left, y_right, stroke):
    """The box's corner: a silver panel below a slanted edge, with the thin red stripe on that edge."""
    return (f'<path d="M0 {y_left} L{w} {y_right} L{w} {h} L0 {h}Z" fill="url(#silver)"/>'
            f'<path d="M0 {y_left} L{w} {y_right}" stroke="{RED}" stroke-width="{stroke}"/>')


def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{body}</svg>\n'


SOURCES = {
    # the wordmark itself, for the app bar (white) and for paper and light screens (royal blue)
    'wordmark-white': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WM_W} {WM_H}"><path fill-rule="evenodd" fill="#fff" d="{WM_D}"/></svg>\n',
    'wordmark-ink': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WM_W} {WM_H}"><path fill-rule="evenodd" fill="{ROYAL}" d="{WM_D}"/></svg>\n',
    # app icon with rounded corners (web), and full-bleed (iOS, maskable, Android)
    'icon': svg(1024, 1024, '<clipPath id="r"><rect width="1024" height="1024" rx="232"/></clipPath><g clip-path="url(#r)">'
                '<rect width="1024" height="1024" fill="url(#royal)"/>' + panel(1024, 1024, 860, 700, 18) + wordmark(512, 452, 800) + '</g>'),
    'icon-full': svg(1024, 1024, '<rect width="1024" height="1024" fill="url(#royal)"/>' + panel(1024, 1024, 840, 690, 18) + wordmark(512, 448, 760)),
    'icon-small': svg(64, 64, '<rect width="64" height="64" rx="14" fill="url(#royal)"/>' + links(32, 32, 50)),
    'icon-foreground': svg(1024, 1024, wordmark(512, 512, 620)),
    'icon-background': svg(1024, 1024, '<rect width="1024" height="1024" fill="url(#royal)"/>' + panel(1024, 1024, 830, 700, 16)),
    'og': svg(1200, 630, '<rect width="1200" height="630" fill="url(#royal)"/>' + panel(1200, 630, 560, 420, 14) + wordmark(600, 250, 820)),
    'splash': svg(2732, 2732, '<rect width="2732" height="2732" fill="url(#royal)"/>' + wordmark(1366, 1366, 1180)),
    'splash-dark': svg(2732, 2732, f'<rect width="2732" height="2732" fill="{NAVY}"/>' + wordmark(1366, 1366, 1180)),
}
OUT = {
    'icon-1024.png': ('icon', 1024, 1024), 'icon-512.png': ('icon', 512, 512), 'icon-192.png': ('icon', 192, 192),
    'favicon-64.png': ('icon-small', 64, 64), 'favicon-32.png': ('icon-small', 32, 32),
    'apple-touch-icon.png': ('icon-full', 180, 180), 'icon-ios-1024.png': ('icon-full', 1024, 1024),
    'maskable-1024.png': ('icon-full', 1024, 1024), 'maskable-512.png': ('icon-full', 512, 512), 'og.png': ('og', 1200, 630),
    'app-icon-only.png': ('icon-full', 1024, 1024), 'app-icon-foreground.png': ('icon-foreground', 1024, 1024),
    'app-icon-background.png': ('icon-background', 1024, 1024), 'app-splash.png': ('splash', 2732, 2732), 'app-splash-dark.png': ('splash-dark', 2732, 2732),
}

if __name__ == '__main__':
    os.makedirs(PNG, exist_ok=True)
    for name, body in SOURCES.items():
        with open(os.path.join(SVG, name + '.svg'), 'w', encoding='utf-8') as f:
            f.write(body)
    # icon.svg is what the web app links as its scalable icon
    with open(os.path.join(SVG, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(SOURCES['icon'])
    for out, (src, w, h) in OUT.items():
        subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), os.path.join(SVG, src + '.svg'), '-o', os.path.join(PNG, out)], check=True)
    print('wrote %d sources and %d images' % (len(SOURCES) + 1, len(OUT)))

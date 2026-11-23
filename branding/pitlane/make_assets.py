#!/usr/bin/env python3
"""Draws the brand of PITLANE (بِت لين), the burgundy store: the mark, the wordmark, the app icons, the link-preview
image, the Android/iOS icon layers and splash screens, and the hero car in the brand's warm greys.

The mark is a hex nut (the parts) filled with a chequered flag (the pit lane, where racing cars get their parts).
The wordmark is the mark before the name in bold oblique capitals, like a racing number. Burgundy and white, with a
thin rose stripe on the slanted edge, like the app's hero. The name is turned into outlines by rsvg-convert, so the
files need no font. Needs rsvg-convert (librsvg).  Run:  python3 make_assets.py"""
import os
import re
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SVG, PNG = os.path.join(HERE, 'svg'), os.path.join(HERE, 'png')
BURG, BURG_HI, BURG_LO = '#7A1C32', '#8E2640', '#5E1424'
ROSE, MIST, MIST_LO, WINE, PALE = '#C24863', '#F6F0F1', '#E4D3D8', '#2A0912', '#F6D9E0'
NAME, FONT = 'PITLANE', 'DejaVu Sans'

# the mark in a 100 × 92 box: the nut's rim, and a 4 × 4 chequered flag inside it
MARK_W, MARK_H = 100.0, 92.0
_C = (50.0, 46.0)
_OUT = [(25, 0), (75, 0), (100, 46), (75, 92), (25, 92), (0, 46)]
_IN = [(_C[0] + (x - _C[0]) * 0.76, _C[1] + (y - _C[1]) * 0.76) for x, y in _OUT]
# the flag runs on a little under the rim, so no hairline shows where a dark square meets it
_FLAG = [(_C[0] + (x - _C[0]) * 0.80, _C[1] + (y - _C[1]) * 0.80) for x, y in _OUT]


def _poly(pts):
    return 'M' + ' L'.join('%.2f %.2f' % p for p in pts) + ' Z'


def _checks():
    """The dark squares of a 4 × 4 flag laid on the hole of the nut; the outer ones run on under the rim."""
    x0, x1 = min(p[0] for p in _IN), max(p[0] for p in _IN)
    y0, y1 = min(p[1] for p in _IN), max(p[1] for p in _IN)
    w, h, m = (x1 - x0) / 4, (y1 - y0) / 4, 4.0
    sq = []
    for i in range(4):
        for j in range(4):
            if (i + j) % 2:
                continue
            a, b = x0 + i * w - (m if i == 0 else 0), x0 + (i + 1) * w + (m if i == 3 else 0)
            c, d = y0 + j * h - (m if j == 0 else 0), y0 + (j + 1) * h + (m if j == 3 else 0)
            sq.append('M%.2f %.2f H%.2f V%.2f H%.2f Z' % (a, c, b, d, a))
    return ' '.join(sq)


def mark(x, y, width, fill='#fff', uid='m'):
    s = width / MARK_W
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.5f})"><clipPath id="{uid}"><path d="{_poly(_FLAG)}"/></clipPath>'
            f'<path fill-rule="evenodd" fill="{fill}" d="{_poly(_OUT)} {_poly(_IN)}"/><path fill="{fill}" clip-path="url(#{uid})" d="{_checks()}"/></g>')


def outlines(text, size=100, weight='bold', style='normal', spacing=0):
    """A line of text as outlines and its box (x0, y0, x1, y1)."""
    src = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size * 14}" height="{size * 3}"><text x="{size * 7}" y="{size * 2}" font-family="{FONT}" '
           f'font-weight="{weight}" font-style="{style}" letter-spacing="{spacing}" font-size="{size}" text-anchor="middle">{text}</text></svg>')
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.svg'), os.path.join(d, 'b.svg')
        with open(a, 'w', encoding='utf-8') as f:
            f.write(src)
        subprocess.run(['rsvg-convert', '-f', 'svg', a, '-o', b], check=True)
        out = open(b, encoding='utf-8').read()
    path = ' '.join(re.findall(r' d="([^"]+)"', out))
    nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', path)]
    return path, (min(nums[0::2]), min(nums[1::2]), max(nums[0::2]), max(nums[1::2]))


NAME_D, NAME_BOX = outlines(NAME, style='oblique', spacing=4)
TAG_D, TAG_BOX = outlines('قطع غيار السيارات', weight='normal')
AR_D, AR_BOX = outlines('بِت لين')


def text(d, box, x, y, height, fill='#fff'):
    """Draw outlines so their box starts at (x, y) and is `height` tall; returns the drawing and its width."""
    x0, y0, x1, y1 = box
    s = height / (y1 - y0)
    return f'<path fill="{fill}" transform="translate({x:.2f} {y:.2f}) scale({s:.5f}) translate({-x0:.2f} {-y0:.2f})" d="{d}"/>', (x1 - x0) * s


# the wordmark: the mark first (as the name is read, left to right), then the name in capitals as tall as two thirds of the mark
GAP, NAME_H = 22.0, 58.0
_name_w = (NAME_BOX[2] - NAME_BOX[0]) * NAME_H / (NAME_BOX[3] - NAME_BOX[1])
WM_W, WM_H = round(MARK_W + GAP + _name_w + 2, 1), MARK_H   # 2 to spare for the slant of the last letter


def wordmark_body(fill, uid):
    return mark(0, 0, MARK_W, fill, uid) + text(NAME_D, NAME_BOX, MARK_W + GAP, (WM_H - NAME_H) / 2, NAME_H, fill)[0]


def wordmark(cx, cy, width, fill='#fff', uid='w'):
    s = width / WM_W
    return f'<g transform="translate({cx - width / 2:.2f} {cy - WM_H * s / 2:.2f}) scale({s:.5f})">{wordmark_body(fill, uid)}</g>'


def centred(d, box, cx, y, height, fill):
    w = (box[2] - box[0]) * height / (box[3] - box[1])
    return text(d, box, cx - w / 2, y, height, fill)[0]


DEFS = f'''<defs>
<linearGradient id="burg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BURG_HI}"/><stop offset="1" stop-color="{BURG_LO}"/></linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{MIST}"/><stop offset="1" stop-color="{MIST_LO}"/></linearGradient>
</defs>'''


def panel(w, h, y_left, y_right, stroke):
    """The light panel below a slanted edge, with the thin rose stripe on that edge (the app's hero ends the same way)."""
    return (f'<path d="M0 {y_left} L{w} {y_right} L{w} {h} L0 {h}Z" fill="url(#mist)"/>'
            f'<path d="M0 {y_left} L{w} {y_right}" stroke="{ROSE}" stroke-width="{stroke}"/>')


def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{body}</svg>\n'


def centred_mark(cx, cy, width, fill='#fff', uid='c'):
    return mark(cx - width / 2, cy - width * MARK_H / MARK_W / 2, width, fill, uid)


SOURCES = {
    # the wordmark, for the bar (white) and for paper and light screens (burgundy)
    'wordmark-white': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WM_W} {WM_H}">{wordmark_body("#fff", "a")}</svg>\n',
    'wordmark-ink': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WM_W} {WM_H}">{wordmark_body(BURG, "a")}</svg>\n',
    'mark': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK_W} {MARK_H}">{mark(0, 0, MARK_W, BURG)}</svg>\n',
    # app icon with rounded corners (web), and full-bleed (iOS, maskable, Android)
    'icon': svg(1024, 1024, '<clipPath id="r"><rect width="1024" height="1024" rx="232"/></clipPath><g clip-path="url(#r)">'
                '<rect width="1024" height="1024" fill="url(#burg)"/>' + panel(1024, 1024, 880, 740, 18) + centred_mark(512, 440, 540) + '</g>'),
    'icon-full': svg(1024, 1024, '<rect width="1024" height="1024" fill="url(#burg)"/>' + panel(1024, 1024, 860, 730, 18) + centred_mark(512, 436, 500)),
    'icon-small': svg(64, 64, '<rect width="64" height="64" rx="14" fill="url(#burg)"/>' + centred_mark(32, 32, 48)),
    'icon-foreground': svg(1024, 1024, centred_mark(512, 512, 430)),
    'icon-background': svg(1024, 1024, '<rect width="1024" height="1024" fill="url(#burg)"/>' + panel(1024, 1024, 850, 730, 16)),
    'og': svg(1200, 630, '<rect width="1200" height="630" fill="url(#burg)"/>' + panel(1200, 630, 560, 440, 14) + wordmark(600, 200, 820)
               + centred(TAG_D, TAG_BOX, 600, 300, 50, PALE)),
    'splash': svg(2732, 2732, '<rect width="2732" height="2732" fill="url(#burg)"/>' + wordmark(1366, 1366, 1500)),
    'splash-dark': svg(2732, 2732, f'<rect width="2732" height="2732" fill="{WINE}"/>' + wordmark(1366, 1366, 1500)),
    # the name in Arabic letters, for what is written in Arabic about the shop
    'name-ar': f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {(AR_BOX[2] - AR_BOX[0]):.1f} {(AR_BOX[3] - AR_BOX[1]):.1f}">'
               + text(AR_D, AR_BOX, 0, 0, AR_BOX[3] - AR_BOX[1], BURG)[0] + '</svg>\n',
}
OUT = {
    'icon-1024.png': ('icon', 1024, 1024), 'icon-512.png': ('icon', 512, 512), 'icon-192.png': ('icon', 192, 192),
    'favicon-64.png': ('icon-small', 64, 64), 'favicon-32.png': ('icon-small', 32, 32),
    'apple-touch-icon.png': ('icon-full', 180, 180), 'icon-ios-1024.png': ('icon-full', 1024, 1024),
    'maskable-1024.png': ('icon-full', 1024, 1024), 'maskable-512.png': ('icon-full', 512, 512), 'og.png': ('og', 1200, 630),
    'app-icon-only.png': ('icon-full', 1024, 1024), 'app-icon-foreground.png': ('icon-foreground', 1024, 1024),
    'app-icon-background.png': ('icon-background', 1024, 1024), 'app-splash.png': ('splash', 2732, 2732), 'app-splash-dark.png': ('splash-dark', 2732, 2732),
}

# the hero car: the generic SUV drawn for the CROSSKY edition, its blue-grey shades turned to the brand's warm greys
CAR = {'#020a2e': '#14070b', '#0b1122': '#130c0f', '#0e1322': '#141012', '#11151e': '#151214', '#141a26': '#19151a', '#141d33': '#20151a',
       '#1a2130': '#1f1a1d', '#1b2232': '#211b1f', '#1c2232': '#221b1f', '#252c3b': '#2b2427', '#2c3b5e': '#4a2e37', '#3a4560': '#4d3c43',
       '#5b6679': '#6b6266', '#7d889b': '#8f8589', '#9aa6bd': '#ada3a7', '#9aa7c0': '#aea3a8', '#a7b3ca': '#b9aeb2', '#aab4c7': '#bdb5b8',
       '#b9c6de': '#cdbfc4', '#c3ccd9': '#d3cacd', '#c4cddd': '#d4cacd', '#cfe0ff': '#f7dfe5', '#d5ddeb': '#e6dcdf', '#d6dde8': '#e5dee0',
       '#e6eefc': '#f5eaed', '#f3f6fb': '#f8f4f5', '#f4f7fb': '#f8f4f5'}

if __name__ == '__main__':
    os.makedirs(SVG, exist_ok=True)
    os.makedirs(PNG, exist_ok=True)
    for name, body in SOURCES.items():
        with open(os.path.join(SVG, name + '.svg'), 'w', encoding='utf-8') as f:
            f.write(body)
    # icon.svg is what the web app links as its scalable icon
    with open(os.path.join(SVG, 'icon.svg'), 'w', encoding='utf-8') as f:
        f.write(SOURCES['icon'])
    for out, (src, w, h) in OUT.items():
        subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), os.path.join(SVG, src + '.svg'), '-o', os.path.join(PNG, out)], check=True)
    car = open(os.path.join(HERE, '..', 'crossky', 'svg', 'hero-car.svg'), encoding='utf-8').read()
    car = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: CAR.get(m.group(0).lower(), m.group(0)), car)
    car = car.replace('Made for the blue hero of the CROSSKY edition', 'Made for the CROSSKY edition, here in the warm greys of PITLANE')
    with open(os.path.join(SVG, 'hero-car.svg'), 'w', encoding='utf-8') as f:
        f.write(car)
    print('wrote %d sources, the hero car and %d images' % (len(SOURCES) + 1, len(OUT)))

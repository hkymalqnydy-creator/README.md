#!/usr/bin/env python3
"""Studio pictures of car parts for the demo catalog (img/parts), rendered from 3D models in parts.html.
  CHROME=/path/to/chrome node render.js preview          # 480x360 previews in out/ (about 4 s each)
  CHROME=/path/to/chrome node render.js final 0 1 2 ...   # 1800x1350 in out/ (about a minute each)
  python3 finish.py                                        # scales them to 900x675 JPEG into ../../img/parts
The demo maps its parts to these pictures in js/demo.js (PART_IMG)."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ['brake-pads', 'oil-filter', 'rear-shocks', 'front-strut', 'radiator', 'headlight', 'tail-lamp', 'ac-compressor',
         'clutch-kit', 'spark-plugs', 'engine-oil', 'battery']
OUT = os.path.join(HERE, '..', '..', 'img', 'parts')
os.makedirs(OUT, exist_ok=True)
for i, n in enumerate(NAMES):
    src = os.path.join(HERE, 'out', 'full-%d.png' % i)
    if os.path.exists(src):
        Image.open(src).convert('RGB').resize((900, 675), Image.LANCZOS).save(os.path.join(OUT, n + '.jpg'), quality=84, optimize=True, progressive=True)
        print('wrote', n)

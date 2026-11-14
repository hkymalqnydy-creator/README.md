#!/usr/bin/env python3
"""Builds the in-app page edition of a built app folder: the same app as a page that opens inside the Claude app
(a claude.ai artifact). That page frame reaches no outside server and has no camera or service worker, so the copy
runs the demo, reads invoice photos with Claude (js/embed.js), and saves files through the Claude app.

  python3 tools/build_artifact.py corssky /tmp/corssky-page        # a company edition built by build_company.py
  python3 tools/build_artifact.py . /tmp/sparat-page               # the marketplace edition

Publish every file of the output folder as one artifact, then declare its capabilities:
{"sample": {"images": true}, "downloads": true}."""
import os
import shutil
import sys

WEB_DIRS = ['css', 'js']
ICONS = ['icon.svg', 'favicon-64.png', 'apple-touch-icon.png']
PAGE_CONFIG = """
/* In-app page edition (tools/build_artifact.py): the Claude app's page frame reaches no outside server,
   so the demo runs, invoice photos are read by Claude and files are saved through the Claude app (js/embed.js). */
Object.assign(window.SPARAT_CONFIG, { embedded: true, noServiceWorker: true, aiScan: false, demo: true, supabaseUrl: '', supabaseKey: '' });
"""


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    for need in ['index.html', 'config.js', 'js/embed.js']:
        if not os.path.exists(os.path.join(src, need)):
            raise SystemExit('missing %s in %s' % (need, src))
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'icons'))
    for d in WEB_DIRS:
        shutil.copytree(os.path.join(src, d), os.path.join(out, d))
    for f in ICONS:
        p = os.path.join(src, 'icons', f)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(out, 'icons', f))
    with open(os.path.join(src, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    # no installing from inside the Claude app, and no request for a file the page does not ship
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
    with open(os.path.join(out, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    with open(os.path.join(src, 'config.js'), encoding='utf-8') as f:
        cfg = f.read()
    with open(os.path.join(out, 'config.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(cfg.rstrip() + '\n' + PAGE_CONFIG)
    files = sorted(os.path.relpath(os.path.join(r, n), out) for r, _, ns in os.walk(out) for n in ns)
    print('built the in-app page edition in %s (%d files)' % (out, len(files)))


if __name__ == '__main__':
    main()

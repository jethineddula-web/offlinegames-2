#!/usr/bin/env python3
"""Inline CSS, JS and base64 images into a single self-contained index.html."""
import base64, glob, io, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))

def shrink(path, max_w=560, quality=72):
    im = Image.open(path).convert('RGB')
    if im.width > max_w:
        h = round(im.height * max_w / im.width)
        im = im.resize((max_w, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()

def json_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

# --- images -> JS array ---
imgs = sorted(glob.glob(os.path.join(ROOT, 'img', '*.jpg')))
names = ['Emerald Forest', 'Coral Reef', 'Alpine Dawn', 'Cosmic Nebula', 'Autumn Fox',
         'Curious Kitten', 'Neon Tokyo', 'Rainbow Meadow', 'Golden Dunes', 'Fairy Castle']
entries = []
total_b = 0
for i, p in enumerate(imgs):
    raw = shrink(p)
    total_b += len(raw) + 512
    b64 = base64.b64encode(raw).decode()
    entries.append('{t:%s,s:"data:image/jpeg;base64,%s"}' % (json_str(names[i % 10]), b64))
imgs_js = ',\n'.join(entries)

html = open(os.path.join(ROOT, 'index.template.html')).read()
css = open(os.path.join(ROOT, 'style.css')).read()
js = open(os.path.join(ROOT, 'game.js')).read()

html = html.replace('/*INLINE_CSS*/', css)
html = html.replace('/*__JS__*/', js)
html = html.replace('/*__IMAGES__*/', imgs_js)

out = os.path.join(ROOT, 'index.html')
open(out, 'w').write(html)
print('images:', len(imgs), 'image bytes ~', round(total_b / 1024), 'KB')
print('index.html bytes:', round(len(html) / 1024), 'KB')

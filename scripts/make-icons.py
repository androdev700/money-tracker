#!/usr/bin/env python3
"""Regenerate the app icons in web/public from code. Needs macOS (uses `sips` to rasterise).

    python3 scripts/make-icons.py
"""
import os
import subprocess
import tempfile

GLYPH = '''<path d="M170 132 H342"/><path d="M170 202 H342"/><path d="M170 132 H240 A70 70 0 0 1 240 272 H182 L326 388"/>'''

def svg(rx, inset=1.0):
    s = inset; t = 256 * (1 - s)
    # Soft shadow without filters (renderers differ on feGaussianBlur): stacked, offset, widening strokes.
    shadow = ''.join(
        f'<g transform="translate(0 {3 + i * 1.6:.1f})" stroke="#061444" stroke-opacity="{0.045 - i * 0.0022:.4f}" stroke-width="{44 + i * 2.6:.1f}">{GLYPH}</g>'
        for i in range(18)
    )
    rim = f'<rect x="1.5" y="1.5" width="509" height="509" rx="{max(rx - 1.5, 0)}" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="3"/>' if rx else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4a97f3"/>
      <stop offset="0.5" stop-color="#2463c9"/>
      <stop offset="1" stop-color="#112a7c"/>
    </linearGradient>
    <radialGradient id="sheen" cx="150" cy="80" r="380" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="256" cy="290" r="340" gradientUnits="userSpaceOnUse">
      <stop offset="0.6" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="110" x2="0" y2="410" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#d3e2ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="{rx}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="{rx}" fill="url(#vignette)"/>
  <rect width="512" height="512" rx="{rx}" fill="url(#sheen)"/>
  {rim}
  <g transform="translate({t:.1f} {t:.1f}) scale({s})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    {shadow}
    <g stroke="url(#ink)" stroke-width="44">{GLYPH}</g>
  </g>
</svg>
'''

PUBLIC = os.path.join(os.path.dirname(__file__), '..', 'web', 'public')
# purpose "any": rounded. iOS and Android maskable apply their own corner mask, so those are full-bleed.
VARIANTS = [
    ('icon.svg', svg(112), None),
    ('icon-192.png', svg(112), 192),
    ('icon-512.png', svg(112), 512),
    ('apple-touch-icon.png', svg(0), 180),
    ('icon-maskable-512.png', svg(0, 0.8), 512),
]

with tempfile.TemporaryDirectory() as tmp:
    for name, content, size in VARIANTS:
        target = os.path.join(PUBLIC, name)
        if size is None:
            open(target, 'w').write(content)
            continue
        source = os.path.join(tmp, name + '.svg')
        open(source, 'w').write(content)
        subprocess.run(['sips', '-s', 'format', 'png', '-z', str(size), str(size), source, '--out', target], check=True, capture_output=True)
        print('wrote', name)

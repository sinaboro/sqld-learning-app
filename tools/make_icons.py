"""
SQLD 첫걸음 앱 아이콘 만들기 도구

파란 바탕에 노란 'SQL'과 흰 'D' 글자가 들어간 아이콘을 docs/icons/ 에 만든다.

사용법 (저장소 맨 위 폴더에서, 윈도우 PC):
    pip install pillow
    python tools/make_icons.py
아이콘을 바꾼 뒤에는 docs/sw.js 의 VERSION 도 올려야 폰에 반영된다.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'icons')
MONO = 'C:/Windows/Fonts/consolab.ttf'
NAVY, WHITE, SUN = '#0e5a8a', '#ffffff', '#f6c343'


def make(size, pad=0.0):
    S = 1024
    im = Image.new('RGB', (S, S), NAVY)
    d = ImageDraw.Draw(im)
    k, o = 1 - pad * 2, S * pad
    P = lambda x, y: (o + x * k, o + y * k)
    d.text(P(512, 380), 'SQL', font=ImageFont.truetype(MONO, int(300 * k)), fill=SUN, anchor='mm')
    d.text(P(512, 690), 'D', font=ImageFont.truetype(MONO, int(360 * k)), fill=WHITE, anchor='mm')
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, pad in [('icon-192.png', 192, 0), ('icon-512.png', 512, 0),
                            ('apple-touch-icon.png', 180, 0), ('icon-maskable-512.png', 512, 0.1)]:
        make(size, pad).save(os.path.join(OUT, name))
        print('docs/icons/' + name)


if __name__ == '__main__':
    main()

"""
SQLD 교안 PDF 만들기: guide/*.md → SQLD_학습교안.pdf (ReportLab)

사용법 (저장소 맨 위 폴더에서):
    pip install reportlab
    python tools/build_pdf.py
SQL 예제는 예제 DB(guide/sample_db.sql)에서 실제로 실행해 결과 표를 넣는다 (sql_lib.load_all).
코드 글꼴 D2Coding 은 처음 실행할 때 tools/.cache 에 내려받는다 (SIL OFL).
"""
import os
import re
import sys
import urllib.request
import zipfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sql_lib import ROOT, load_all, check, text_table  # noqa: E402

OUT = os.path.join(ROOT, 'SQLD_학습교안.pdf')
CACHE = os.path.join(ROOT, 'tools', '.cache')
D2_URL = 'https://github.com/naver/d2codingfont/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip'
TITLE = 'SQLD 학습 교안'
N_EX = N_Q = 0
APP_URL = 'https://sinaboro.github.io/sqld-learning-app-/'

# ───────── 글꼴 ─────────
def fonts():
    d2 = os.path.join(CACHE, 'D2Coding.ttf')
    if not os.path.exists(d2):
        os.makedirs(CACHE, exist_ok=True)
        print('D2Coding 글꼴 내려받는 중...')
        zp = os.path.join(CACHE, 'd2.zip')
        urllib.request.urlretrieve(D2_URL, zp)
        z = zipfile.ZipFile(zp)
        for n in z.namelist():
            if n.endswith('D2Coding/D2Coding-Ver1.3.2-20180524.ttf'):
                open(d2, 'wb').write(z.read(n))
            if n.endswith('D2Coding/D2CodingBold-Ver1.3.2-20180524.ttf'):
                open(os.path.join(CACHE, 'D2CodingBold.ttf'), 'wb').write(z.read(n))
    pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
    pdfmetrics.registerFont(TTFont('MalgunB', 'C:/Windows/Fonts/malgunbd.ttf'))
    pdfmetrics.registerFont(TTFont('D2', d2))
    pdfmetrics.registerFont(TTFont('D2B', os.path.join(CACHE, 'D2CodingBold.ttf')))
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    registerFontFamily('Malgun', normal='Malgun', bold='MalgunB', italic='Malgun', boldItalic='MalgunB')
    registerFontFamily('D2', normal='D2', bold='D2B', italic='D2', boldItalic='D2B')


# ───────── 색과 글자 모양 ─────────
NAVY = colors.HexColor('#1f3b73'); ORANGE = colors.HexColor('#e8740c'); BLUE = colors.HexColor('#2f6fdb')
GRAY = colors.HexColor('#5b6475'); LINE = colors.HexColor('#d5dae4')
CODE_BG = colors.HexColor('#f4f6fa'); OUT_BG = colors.HexColor('#fff8ec')
TIP_BG = colors.HexColor('#eaf2ff'); WARN_BG = colors.HexColor('#fdecea')

def S(name, **kw):
    base = dict(fontName='Malgun', fontSize=10, leading=16, wordWrap='CJK', textColor=colors.HexColor('#1b2033'))
    base.update(kw)
    return ParagraphStyle(name, **base)

ST = {
    'p': S('p', spaceAfter=5),
    'li': S('li', leftIndent=12, bulletIndent=2, spaceAfter=2),
    'h1': S('h1', fontName='MalgunB', fontSize=22, leading=30, textColor=NAVY, spaceAfter=4),
    'h1no': S('h1no', fontName='MalgunB', fontSize=12, leading=16, textColor=ORANGE),
    'h2': S('h2', fontName='MalgunB', fontSize=14.5, leading=21, textColor=NAVY, spaceBefore=12, spaceAfter=6),
    'h3': S('h3', fontName='MalgunB', fontSize=11.5, leading=17, textColor=BLUE, spaceBefore=7, spaceAfter=3),
    'code': S('code', fontName='D2', fontSize=8.4, leading=11.6, textColor=colors.HexColor('#1e2a44')),
    'label': S('label', fontName='MalgunB', fontSize=7.5, leading=10, textColor=GRAY),
    'cell': S('cell', fontSize=8.8, leading=12.5),
    'cellh': S('cellh', fontName='MalgunB', fontSize=8.8, leading=12.5, textColor=NAVY),
    'box': S('box', fontSize=9.5, leading=15),
    'q': S('q', fontName='MalgunB', fontSize=10, leading=15, spaceBefore=6, spaceAfter=2),
    'opt': S('opt', fontSize=9.5, leading=14, leftIndent=12),
    'toc0': S('toc0', fontName='MalgunB', fontSize=11, leading=19),
    'toc1': S('toc1', fontSize=9.5, leading=15, leftIndent=14, textColor=GRAY),
}

# ───────── 글 다듬기 ─────────
EMOJI = re.compile('[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE0F]')
def clean(t):
    t = EMOJI.sub('', t).replace('\u2212', '-').replace('≈', '≒')
    return t.strip()

def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def inline(t):
    """**굵게**, `코드` 를 ReportLab 표시로 바꾼다."""
    t = esc(clean(t))
    codes = []                                   # `코드` 안의 ** 가 굵게로 바뀌지 않도록 먼저 빼 둔다
    t = re.sub(r'`([^`]+)`', lambda m: codes.append(m.group(1)) or f'\x00{len(codes) - 1}\x00', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    return re.sub('\x00(\\d+)\x00', lambda m: f'<font face="D2" color="#b4441b">{codes[int(m.group(1))]}</font>', t)

def code_para(line, style):
    s = esc(line.replace('\t', '    ')).replace(' ', '&nbsp;')
    return Paragraph(s or '&nbsp;', style)


# ───────── 블록 → 흐름 요소 ─────────
W = A4[0] - 36 * mm

def box_lines(lines, bg, label, border):
    """코드·결과 상자. 줄마다 행을 나눠 페이지 넘김이 자연스럽게 되게 한다."""
    rows = [[Paragraph(label, ST['label'])]] + [[code_para(l, ST['code'])] for l in lines]
    t = Table(rows, colWidths=[W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg), ('LINEBEFORE', (0, 0), (0, -1), 2.2, border),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 0.4), ('BOTTOMPADDING', (0, 0), (-1, -1), 0.4),
        ('TOPPADDING', (0, 0), (-1, 0), 4), ('BOTTOMPADDING', (0, -1), (-1, -1), 5),
    ]))
    t.spaceAfter = 6
    # 짧은 상자는 쪼개지지 않게 (제목만 쪽 끝에 남는 것 방지), 긴 상자는 줄 단위로 넘긴다
    return KeepTogether([t]) if len(lines) <= 22 else t

def note(text, bg, title, color):
    gap = '' if title.endswith('<br/>') else '&nbsp;&nbsp;'      # 제목 다음 줄부터 쓰면 앞 공백 없이
    p = Paragraph(f'<font face="MalgunB" color="{color}">{title}</font>{gap}' + inline(text).replace('\n', '<br/>'), ST['box'])
    t = Table([[p]], colWidths=[W])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg), ('LEFTPADDING', (0, 0), (-1, -1), 9),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 6),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    t.spaceAfter = 7
    return t

def table(rows):
    n = max(len(r) for r in rows)
    rows = [r + [''] * (n - len(r)) for r in rows]
    lens = [max(len(clean(r[c])) for r in rows) + 2 for c in range(n)]
    tot = sum(lens)
    widths = [max(W * 0.1, W * l / tot) for l in lens]
    k = W / sum(widths); widths = [w * k for w in widths]
    data = [[Paragraph(inline(c), ST['cellh'] if i == 0 else ST['cell']) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8edf7')), ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    t.spaceAfter = 8
    return t

def blocks(bl):
    out = []
    for b in bl:
        t = b['t']
        if t == 'p':
            out.append(Paragraph(inline(b['text']), ST['p']))
        elif t == 'h3':
            out.append(Paragraph(inline(b['text']), ST['h3']))
        elif t in ('ul', 'ol'):
            for k, it in enumerate(b['items'], 1):
                out.append(Paragraph(inline(it), ST['li'], bulletText=f'{k}.' if t == 'ol' else '•'))
            out.append(Spacer(1, 4))
        elif t == 'tip':
            out.append(note(b['text'], TIP_BG, 'TIP', '#2f6fdb'))
        elif t == 'warn':
            out.append(note(b['text'], WARN_BG, '주의', '#c0392b'))
        elif t == 'table':
            out.append(table(b['rows']))
        elif t == 'code':
            if b['lang'] == 'sql':
                label = 'SQL (오라클 문법 · 예제 DB 에서 실행하지 않음)' if b.get('norun') else ('SQL (오류가 나는 것이 정상인 예)' if b.get('error') else 'SQL')
                out.append(box_lines(b['code'].split('\n'), CODE_BG, label, BLUE))
                if b.get('res'):
                    txt = '\n\n'.join(text_table(r) for r in b['res'])
                    out.append(box_lines(txt.split('\n'), OUT_BG, '실행 결과', ORANGE))
            else:
                out.append(box_lines(b['code'].split('\n'), colors.HexColor('#eef0f3'), '화면', GRAY))
    return out

def quiz_block(quiz, title, start=1):
    out = [Paragraph(title, ST['h3'])]
    for k, q in enumerate(quiz, start):
        items = [Paragraph(f'Q{k}. {inline(q["q"])}', ST['q'])]
        if q.get('code'):
            items.append(box_lines(q['code'].split('\n'), CODE_BG, 'SQL', BLUE))
        items += [Paragraph(f'{"①②③④⑤"[j]} {inline(o)}', ST['opt']) for j, o in enumerate(q['o'])]
        out.append(KeepTogether(items))
    return out


# ───────── 문서 틀 (목차·책갈피·쪽 번호) ─────────
class Doc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=17 * mm,
                         title=TITLE, author='김대철')
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('cover', [frame], onPage=lambda c, d: None),
                               PageTemplate('body', [frame], onPage=self.deco)])

    def deco(self, c, d):
        c.saveState(); c.setFont('Malgun', 8); c.setFillColor(GRAY)
        c.drawString(18 * mm, 10 * mm, TITLE)
        c.drawRightString(A4[0] - 18 * mm, 10 * mm, str(d.page))
        c.setStrokeColor(LINE); c.line(18 * mm, 13.5 * mm, A4[0] - 18 * mm, 13.5 * mm)
        c.restoreState()

    def afterFlowable(self, f):
        lv = getattr(f, 'toc_level', None)
        if lv is None:
            return
        key = f'k{id(f)}'
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(f.toc_text, key, level=lv, closed=lv == 0)
        self.notify('TOCEntry', (lv, f.toc_text, self.page, key))

def heading(text, style, level, toc_text=None):
    p = Paragraph(inline(text), style)
    p.toc_level, p.toc_text = level, clean(toc_text or text)
    return p


def cover():
    big = S('cv', fontName='MalgunB', fontSize=34, leading=44, textColor=NAVY, alignment=TA_CENTER)
    sub = S('cvs', fontSize=13, leading=20, textColor=GRAY, alignment=TA_CENTER)
    badge = Table([[Paragraph('<font color="white"><b>학습 교안</b></font>', S('b', alignment=TA_CENTER, fontSize=12))]],
                  colWidths=[34 * mm], style=[('BACKGROUND', (0, 0), (-1, -1), ORANGE), ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)])
    return [Spacer(1, 55 * mm), badge, Spacer(1, 10 * mm), Paragraph('SQLD', big), Paragraph('SQL 개발자 자격 대비', S('c2', fontName='MalgunB', fontSize=18, leading=26, textColor=BLUE, alignment=TA_CENTER)),
            Spacer(1, 8 * mm), Paragraph(f'1과목 데이터 모델링의 이해 · 2과목 SQL 기본 및 활용<br/>이론 30개 절 · SQL 예제 {N_EX}개 (실제 실행 결과) · 문제 {N_Q}개 · SQL 실습 15문제', sub),
            Spacer(1, 60 * mm), Paragraph('강사 김대철', S('a', fontName='MalgunB', fontSize=13, alignment=TA_CENTER)),
            Spacer(1, 3 * mm), Paragraph(f'학습 앱: {APP_URL}', S('u', fontSize=10, textColor=BLUE, alignment=TA_CENTER)), PageBreak()]


def intro():
    rows = [['표시', '뜻'], ['SQL', '예제 DB 에서 실행해 볼 SQL (파란 줄)'], ['실행 결과', '그 SQL 을 실제로 실행한 결과 표 (주황 줄)'],
            ['SQL (오라클 문법)', 'ROLLUP, CONNECT BY, PIVOT 처럼 오라클 전용 문법. 바로 아래에 같은 결과를 내는 표준 SQL 을 함께 실었어요'],
            ['TIP / 주의', '알아 두면 좋은 내용 / 자주 하는 실수·시험 함정'], ['확인 문제', '절 끝의 문제. 정답과 해설은 맨 뒤에 있어요']]
    return [heading('이 교안의 사용법', ST['h2'], 0),
            Paragraph('이 교안은 SQLD(SQL 개발자) 시험을 처음 준비하는 사람을 위해 만들었어요. 이론서(1~5장)는 <b>학습 목표 → 설명과 SQL 예제 → 확인 문제</b>, 기출공략집(6장)은 대표 유형 30선과 변형문제 2회, 보너스(7장)는 고난이도 문제와 SQL 실습 문제로 되어 있어요. SQL 예제는 모두 예제 DB(EMP·DEPT·SALGRADE, 부록)에서 실제로 실행한 결과예요.', ST['p']),
            table(rows),
            note(f'교안과 똑같은 내용의 학습 앱이 있어요. {APP_URL} 을 열면 SQL 을 고쳐 가며 바로 실행하고, 문제를 풀고, <b>실전 모의고사 01~05회</b>(50문항·90분·과락 채점)와 SQL 실습 채점을 할 수 있어요. 카카오톡으로 링크를 받아 홈 화면에 설치하면 앱처럼 쓸 수 있습니다.', TIP_BG, '학습 앱', '#2f6fdb'),
            Paragraph('공부 순서 추천', ST['h3']),
            Paragraph('① 이론을 읽고 → ② SQL 결과를 <b>먼저 예상한 뒤</b> 실행 결과와 비교하고 → ③ 절 끝 확인 문제를 풀고 → ④ 6장 대표 유형·변형문제 → ⑤ 앱의 실전 모의고사로 마무리하세요. 결과 행 수를 묻는 문제가 많으니 부록의 예제 DB 데이터를 옆에 두고 공부하면 좋아요.', ST['p']),
            PageBreak()]


def answers(chs):
    out = [heading('정답과 해설', ST['h1'], 0)]          # 앞 장 끝에 이미 PageBreak 가 있다
    for ch in chs:
        for sec in ch['sections']:
            if not sec['quiz']:
                continue
            out.append(Paragraph(f'{sec["no"]} {sec["title"]}', ST['h3']))
            rows = [['번호', '정답', '해설']] + [[f'Q{k}', '①②③④⑤'[q['a']], q['e']] for k, q in enumerate(sec['quiz'], 1)]
            t = table(rows)
            t._argW[0], t._argW[1], t._argW[2] = W * 0.08, W * 0.08, W * 0.84
            out.append(t)
    return out


def tasks_answers(chs):
    out = []
    for ch in chs:
        for sec in ch['sections']:
            if sec['tasks']:
                out.append(heading('SQL 실습 문제 정답', ST['h1'], 0))
                for t in sec['tasks']:
                    out.append(Paragraph(inline(t['title']), ST['h3']))
                    out.append(box_lines(t['answer'].split('\n'), CODE_BG, '정답 SQL', BLUE))
                    out.append(box_lines('\n\n'.join(text_table(r) for r in t['res']).split('\n'), OUT_BG, '실행 결과', ORANGE))
                out.append(PageBreak())
    return out


def sample_db():
    from sql_lib import connect, run_sql
    db = connect()
    out = [heading('부록  예제 데이터베이스', ST['h1'], 0),
           Paragraph('교안의 모든 SQL 예제와 앱의 실습 문제가 쓰는 데이터예요. 결과 행 수를 묻는 문제를 풀 때 이 표를 보며 직접 세어 보세요. 테이블을 만드는 SQL 은 저장소의 guide/sample_db.sql 에 있어요.', ST['p'])]
    for name in ('DEPT', 'EMP', 'SALGRADE'):
        out.append(Paragraph(name, ST['h3']))
        r = run_sql(db, f'SELECT * FROM {name}')[0]
        out.append(table([r['cols']] + r['rows']))
    out.append(PageBreak())
    return out


def main():
    sys.stdout.reconfigure(errors='replace')
    fonts()
    global N_EX, N_Q
    chs = load_all()
    N_EX = sum(1 for c in chs for s in c['sections'] for b in s['blocks'] if b['t'] == 'code' and b['lang'] == 'sql')
    N_Q = sum(len(s['quiz']) for c in chs for s in c['sections'])
    errs = check(chs)
    if errs:
        sys.exit('원고 오류:\n' + '\n'.join(errs))
    story = cover()
    from reportlab.platypus import NextPageTemplate
    story.insert(0, NextPageTemplate('body'))
    story += intro()
    toc = TableOfContents(levelStyles=[ST['toc0'], ST['toc1']], dotsMinLevel=0)
    story += [Paragraph('목차', ST['h1']), Spacer(1, 4), toc, PageBreak()]
    for ch in chs:
        story.append(Paragraph(f'CHAPTER {ch["no"]}', ST['h1no']))
        story.append(heading(ch['title'], ST['h1'], 0, f'{ch["no"]}장  {ch["title"]}'))
        if ch['goals']:
            gl = '\n'.join(f'• {g}' for g in ch['goals'])        # note() 가 줄바꿈을 <br/> 로 바꾼다
            story.append(note(gl, colors.HexColor('#fff3e6'), '학습 목표<br/>', '#e8740c'))
        for sec in ch['sections']:
            if sec['title'] != '들어가며':
                story.append(heading(f'{sec["no"]} {sec["title"]}', ST['h2'], 1))
            story += blocks(sec['blocks'])
            if sec['quiz']:
                story += quiz_block(sec['quiz'], '문제' if ch['no'] in ('06', '07') else '확인 문제')
            for k, t in enumerate(sec['tasks'], 1):
                story.append(Paragraph(inline(t['title']), ST['h3']))
                story.append(Paragraph(inline(t['prompt']), ST['p']))
        story.append(PageBreak())
    story += tasks_answers(chs)
    story += sample_db()
    story += answers(chs)
    doc = Doc(OUT)
    doc.multiBuild(story)
    print('저장:', OUT, f'({doc.page}쪽)')


if __name__ == '__main__':
    main()

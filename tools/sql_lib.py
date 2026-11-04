"""
SQLD 교안 원고(guide/chNN.md)를 읽고, SQL 예제를 예제 DB(guide/sample_db.sql)에서 실제로 실행해 결과를 붙이는 공통 모듈.
build_pdf.py(교안 PDF), build_app.py(앱 데이터)가 함께 쓴다.

원고 문법
  # 01 | 장 제목            @subject 1   (이 장 퀴즈의 과목: 1 또는 2)
  ## 01.1 | 절 제목         ### 소제목
  문단 **굵게** `코드`, - 목록, 1. 번호, > 팁, !> 주의, | 표 |
  ```sql             예제 DB에서 실행해 결과를 붙임 (절마다 새 DB, 절 안에서는 이어짐)
  ```sql norun       실행하지 않음 (오라클 전용 문법 등)
  ```sql error       실행하되 오류가 나는 것이 정상인 예제
  ```text            그냥 글 상자 (결과 표, 그림 등)
  @quiz [s=1|2] [제목] ... @end    절에 붙는 문제. ? 질문 / - 오답 / + 정답 / = 해설
  @task 제목 ... @end              SQL 실습 문제: 설명 문단 + ```sql 정답``` (앱이 결과를 비교해 채점)

SQLite 에 없는 오라클 함수(NVL, DECODE, LPAD, TRUNC, REGEXP_* 등)는 같은 동작의 함수를 등록해 쓴다.
앱(docs/app.js)에도 같은 함수가 등록되어 있다.
"""
import decimal
import json
import math
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDE = os.path.join(ROOT, 'guide')
BUILD = os.path.join(ROOT, 'build')
SAMPLE = open(os.path.join(GUIDE, 'sample_db.sql'), encoding='utf-8').read()


# ───────── 오라클 함수 흉내 ─────────
def _null(f):
    def g(*a):
        return None if any(x is None for x in a) else f(*a)
    return g

def _round(x, n=0, trunc=False):
    if x is None or n is None:
        return None
    q = decimal.Decimal(1).scaleb(-int(n))
    d = decimal.Decimal(str(x)).quantize(q, rounding=decimal.ROUND_DOWN if trunc else decimal.ROUND_HALF_UP)
    return int(d) if d == d.to_integral_value() else float(d)

def _decode(*a):
    expr, rest = a[0], list(a[1:])
    while len(rest) >= 2:
        s, r = rest.pop(0), rest.pop(0)
        if expr == s or (expr is None and s is None):    # DECODE 는 NULL 끼리도 같다고 본다
            return r
    return rest[0] if rest else None

def _pad(left):
    def f(s, n, p=' '):
        if s is None or n is None:
            return None
        s, n = str(s), int(n)
        if len(s) >= n:
            return s[:n]
        fill = (p * n)[:n - len(s)]
        return fill + s if left else s + fill
    return f

FUNCS = [
    ('NVL', 2, lambda a, b: b if a is None else a),
    ('NVL2', 3, lambda a, b, c: c if a is None else b),
    ('DECODE', -1, _decode),
    ('INITCAP', 1, _null(lambda s: re.sub(r'[A-Za-z]+', lambda m: m.group(0).capitalize(), str(s)))),
    ('LPAD', 2, _pad(True)), ('LPAD', 3, _pad(True)), ('RPAD', 2, _pad(False)), ('RPAD', 3, _pad(False)),
    ('CONCAT', 2, lambda a, b: ('' if a is None else str(a)) + ('' if b is None else str(b))),
    ('MOD', 2, _null(lambda a, b: a if b == 0 else a - b * math.trunc(a / b))),
    ('ROUND', 1, lambda x: _round(x)), ('ROUND', 2, lambda x, n: _round(x, n)),
    ('TRUNC', 1, lambda x: _round(x, 0, True)), ('TRUNC', 2, lambda x, n: _round(x, n, True)),
    ('CEIL', 1, _null(lambda x: math.ceil(x))), ('FLOOR', 1, _null(lambda x: math.floor(x))),
    ('POWER', 2, _null(lambda a, b: a ** b)), ('SQRT', 1, _null(lambda x: math.sqrt(x))),
    ('SIGN', 1, _null(lambda x: (x > 0) - (x < 0))),
    ('REGEXP_LIKE', 2, _null(lambda s, p: 1 if re.search(p, str(s)) else 0)),
    ('REGEXP_SUBSTR', 2, _null(lambda s, p: (lambda m: m.group(0) if m else None)(re.search(p, str(s))))),
    ('REGEXP_REPLACE', 3, _null(lambda s, p, r: re.sub(p, r, str(s)))),
    ('REGEXP_INSTR', 2, _null(lambda s, p: (lambda m: m.start() + 1 if m else 0)(re.search(p, str(s))))),
    ('REGEXP_COUNT', 2, _null(lambda s, p: len(re.findall(p, str(s))))),
    ('REGEXP', 2, _null(lambda p, s: 1 if re.search(p, str(s)) else 0)),     # X REGEXP 'p' 연산자
]

def connect():
    db = sqlite3.connect(':memory:', isolation_level=None)     # 자동 커밋 (BEGIN/COMMIT 은 원고에서 직접)
    for name, n, f in FUNCS:
        db.create_function(name, n, f)
    db.executescript(SAMPLE)
    return db


# ───────── SQL 실행 ─────────
def split_sql(code):
    """문장 단위로 나눈다 (작은따옴표 안의 ; 는 무시). 주석만 있는 조각은 버린다."""
    out, buf = [], ''
    for line in code.split('\n'):
        buf += line + '\n'
        if sqlite3.complete_statement(buf):
            out.append(buf.strip()); buf = ''
    if buf.strip():
        out.append(buf.strip())
    return [s for s in out if re.sub(r'--.*', '', s).strip().strip(';').strip()]

def fmt(v):
    if v is None:
        return 'NULL'
    if isinstance(v, float):
        return str(int(v)) if v == int(v) else f'{v:.4f}'.rstrip('0').rstrip('.')
    return str(v)

def run_sql(db, code):
    """실행 결과 목록: {'cols','rows'} 또는 {'msg'} 또는 {'err'}"""
    res = []
    for st in split_sql(code):
        try:
            cur = db.execute(st)
            if cur.description:
                rows = cur.fetchall()
                res.append({'cols': [d[0] for d in cur.description], 'rows': [[fmt(v) for v in r] for r in rows]})
            else:
                head = re.sub(r'--.*', '', st).strip().split()[0].upper().rstrip(';')
                if head in ('INSERT', 'UPDATE', 'DELETE', 'MERGE') and cur.rowcount >= 0:
                    res.append({'msg': f'{cur.rowcount}개 행이 {"삽입" if head == "INSERT" else "수정" if head == "UPDATE" else "삭제" if head == "DELETE" else "병합"}되었습니다.'})
                else:
                    res.append({'msg': {'CREATE': '생성되었습니다.', 'DROP': '삭제되었습니다.', 'ALTER': '변경되었습니다.', 'BEGIN': '트랜잭션을 시작합니다.',
                                        'COMMIT': '커밋되었습니다.', 'ROLLBACK': '롤백되었습니다.', 'SAVEPOINT': '저장점이 만들어졌습니다.',
                                        'RELEASE': '저장점을 해제했습니다.'}.get(head, '완료되었습니다.')})
        except sqlite3.Error as e:
            res.append({'err': f'오류: {e}'})
    return res

def text_table(r):
    """결과 하나를 글자 표로 (PDF·실습코드용). 한글은 두 칸으로 계산해 줄을 맞춘다."""
    if 'msg' in r:
        return r['msg']
    if 'err' in r:
        return r['err']
    w = lambda s: sum(2 if ord(ch) > 0x2E80 else 1 for ch in s)
    cols, rows = r['cols'], r['rows']
    widths = [max([w(c)] + [w(row[i]) for row in rows]) for i, c in enumerate(cols)]
    pad = lambda s, n: s + ' ' * (n - w(s))
    line = lambda vals: ' | '.join(pad(v, widths[i]) for i, v in enumerate(vals)).rstrip()
    out = [line(cols), '-+-'.join('-' * n for n in widths)] + [line(row) for row in rows]
    out.append(f'({len(rows)}개 행)')
    return '\n'.join(out)


# ───────── 원고 읽기 ─────────
def parse_file(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    ch = {'no': '', 'title': '', 'subject': 2, 'goals': [], 'sections': []}
    sec = None
    i = 0

    def cur():
        nonlocal sec
        if sec is None:
            sec = {'no': ch['no'] + '.0', 'title': '들어가며', 'blocks': [], 'quiz': [], 'tasks': []}
            ch['sections'].append(sec)
        return sec

    def read_code(start):
        info = lines[start].strip()[3:].strip()
        lang = info.split()[0] if info else 'text'
        body, j = [], start + 1
        while not lines[j].strip().startswith('```'):
            body.append(lines[j]); j += 1
        return {'t': 'code', 'lang': lang, 'code': '\n'.join(body).rstrip('\n'), 'norun': 'norun' in info,
                'error': 'error' in info.split()}, j          # error: 일부러 오류를 보여 주는 예제

    while i < len(lines):
        s = lines[i].strip()
        if s.startswith('# ') and not s.startswith('## '):
            ch['no'], ch['title'] = [x.strip() for x in s[2:].split('|', 1)]
        elif s.startswith('@subject'):
            ch['subject'] = int(s.split()[1])
        elif s == '@goals':
            i += 1
            while lines[i].strip() != '@end':
                if lines[i].strip().startswith('- '):
                    ch['goals'].append(lines[i].strip()[2:])
                i += 1
        elif s.startswith('@quiz'):
            m = re.search(r's=(\d)', s)
            subj = int(m.group(1)) if m else ch['subject']
            i += 1; q = None
            while lines[i].strip() != '@end':
                t = lines[i].strip()
                if t.startswith('? '):
                    q = {'q': t[2:], 'o': [], 'a': -1, 'e': '', 's': subj, 'code': None}
                    cur()['quiz'].append(q)
                elif t.startswith('```'):                    # 문제 안의 SQL 보기
                    b, i = read_code(i); q['code'] = b['code']
                elif t.startswith('+ '):
                    q['a'] = len(q['o']); q['o'].append(t[2:])
                elif t.startswith('- '):
                    q['o'].append(t[2:])
                elif t.startswith('= '):
                    q['e'] = t[2:]
                i += 1
        elif s.startswith('@task'):
            task = {'title': s[5:].strip(), 'prompt': '', 'answer': ''}
            i += 1
            while lines[i].strip() != '@end':
                t = lines[i].strip()
                if t.startswith('```'):
                    b, i = read_code(i); task['answer'] = b['code']
                elif t:
                    task['prompt'] += (' ' if task['prompt'] else '') + t
                i += 1
            cur()['tasks'].append(task)
        elif s.startswith('## '):
            no, title = [x.strip() for x in s[3:].split('|', 1)]
            sec = {'no': no, 'title': title, 'blocks': [], 'quiz': [], 'tasks': []}
            ch['sections'].append(sec)
        elif s.startswith('### '):
            cur()['blocks'].append({'t': 'h3', 'text': s[4:]})
        elif s.startswith('```'):
            b, i = read_code(i); cur()['blocks'].append(b)
        elif s.startswith('> ') or s.startswith('!> '):
            kind = 'warn' if s.startswith('!') else 'tip'
            cur()['blocks'].append({'t': kind, 'text': s.split('> ', 1)[1]})
        elif s.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                r = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c) for c in r):
                    rows.append(r)
                i += 1
            i -= 1
            cur()['blocks'].append({'t': 'table', 'rows': rows})
        elif re.match(r'^(- |\d+\. )', s):
            ordered = bool(re.match(r'^\d+\. ', s)); items = []
            while i < len(lines) and re.match(r'^(- |\d+\. )', lines[i].strip()):
                items.append(re.sub(r'^(- |\d+\. )', '', lines[i].strip())); i += 1
            i -= 1
            cur()['blocks'].append({'t': 'ol' if ordered else 'ul', 'items': items})
        elif s:
            text = s
            while i + 1 < len(lines) and lines[i + 1].strip() and not re.match(r'^(#|@|```|> |!> |\||- |\d+\. )', lines[i + 1].strip()):
                i += 1; text += ' ' + lines[i].strip()
            cur()['blocks'].append({'t': 'p', 'text': text})
        i += 1
    return ch


def load_all(run=True):
    files = sorted(f for f in os.listdir(GUIDE) if re.match(r'ch\d+\.md$', f))
    chapters = [parse_file(os.path.join(GUIDE, f)) for f in files]
    if run:
        for ch in chapters:
            for sec in ch['sections']:
                db = connect()                                   # 절마다 새 예제 DB
                for b in sec['blocks']:
                    if b['t'] == 'code' and b['lang'] == 'sql' and not b['norun']:
                        b['res'] = run_sql(db, b['code'])
                for t in sec['tasks']:
                    t['res'] = run_sql(connect(), t['answer'])
    return chapters


def check(chapters):
    errs = []
    for ch in chapters:
        for sec in ch['sections']:
            for b in sec['blocks']:
                for r in b.get('res', []):
                    if 'err' in r and not b.get('error'):
                        errs.append(f"{sec['no']} 예제 오류: {r['err']} ← {b['code'][:60]}")
            for k, q in enumerate(sec['quiz'], 1):
                if q['a'] < 0 or not q['e'] or len(q['o']) < 2:
                    errs.append(f"{sec['no']} 문제 {k}: 정답/해설/보기 확인 ({q['q'][:30]})")
            for t in sec['tasks']:
                if not t.get('res') or 'err' in t['res'][-1]:
                    errs.append(f"{sec['no']} 실습 '{t['title']}' 정답 SQL 오류")
    return errs


if __name__ == '__main__':
    sys.stdout.reconfigure(errors='replace')
    chs = load_all()
    os.makedirs(BUILD, exist_ok=True)
    json.dump(chs, open(os.path.join(BUILD, 'guide.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for ch in chs:
        nq = sum(len(s['quiz']) for s in ch['sections'])
        nc = sum(1 for s in ch['sections'] for b in s['blocks'] if b['t'] == 'code')
        nt = sum(len(s['tasks']) for s in ch['sections'])
        print(f"{ch['no']} {ch['title']}: 절 {len(ch['sections'])} · 예제 {nc} · 문제 {nq} · 실습 {nt}")
    for e in check(chs):
        print('  [오류]', e)

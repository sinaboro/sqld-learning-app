// SQLD 첫걸음 — 화면 이동, 진도, SQL 실행(sql.js), 확인 문제, 실전 모의고사, SQL 실습 채점, 앱 설치
// 화면 주소: #/ 홈 · #/c/장 · #/c/장/절 · #/exam 모의고사 목록 · #/exam/번호 시험 · #/play SQL 실습 · #/help 사용법

const $ = s => document.querySelector(s);
const view = $('#view');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let tt;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2200); }
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// ───────── 진도 ─────────
// 절 읽음 "장/절", 절 문제 완료 "q/장/절" 로 저장 → 내용을 추가해도 기록이 유지된다
const PK = 'sqld-progress-v1';
let prog = load(PK, {});
const saveProg = () => save(PK, prog);
const skey = (c, s) => `${c.no}/${s.no}`;
const unitsOf = c => c.sections.reduce((a, s) => a + 1 + (s.quiz.length ? 1 : 0), 0);
const doneOf = c => c.sections.reduce((a, s) => a + (prog[skey(c, s)] ? 1 : 0) + (s.quiz.length && prog['q/' + skey(c, s)] ? 1 : 0), 0);
const TOTAL = CH.reduce((a, c) => a + unitsOf(c), 0);
function nextSection() {
  for (const c of CH) for (const s of c.sections) if (!prog[skey(c, s)] || (s.quiz.length && !prog['q/' + skey(c, s)])) return { c, s };
  return null;
}

// ───────── 화면 이동 ─────────
let cleanup = [];
function route() {
  cleanup.forEach(f => f()); cleanup = [];
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const tab = ['exam', 'play', 'help'].includes(p[0]) ? p[0] : 'home';
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const back = $('#back');
  back.hidden = !(p[0] === 'c' || (p[0] === 'exam' && p[1]));
  if (p[0] === 'c') {
    const c = CH.find(x => x.no === p[1]); if (!c) return go('#/');
    const s = p[2] && c.sections.find(x => x.no === p[2]);
    back.onclick = () => go(s ? `#/c/${c.no}` : '#/');
    s ? renderSection(c, s) : renderChapter(c);
  } else if (tab === 'exam') { back.onclick = () => go('#/exam'); p[1] ? renderExam(+p[1]) : renderExamList(); }
  else if (tab === 'play') renderPlay();
  else if (tab === 'help') renderHelp();
  else renderHome();
  window.scrollTo(0, 0);
}
const go = h => { location.hash = h; };
addEventListener('hashchange', route);

// ───────── 홈 · 장 ─────────
function renderHome() {
  $('#title').textContent = 'SQLD 첫걸음';
  const done = CH.reduce((a, c) => a + doneOf(c), 0), n = nextSection();
  const best = Object.values(load('sqld-exams-v1', {})).reduce((m, r) => Math.max(m, r.total), 0);
  view.innerHTML = `<div class="stack">
    <div class="hero"><h2>SQLD 첫걸음 🗄️</h2>
      <p>이론 → SQL 직접 실행 → 확인 문제 → 기출 유형 → 실전 모의고사까지 한 앱에서!</p>
      <div class="bar"><i style="width:${done / TOTAL * 100}%"></i></div>
      <p style="margin-top:6px;font-size:13px">진도 ${done} / ${TOTAL} (절 읽기 + 문제) ${best ? `· 모의고사 최고 ${best}점` : ''}</p>
      <button class="cont" id="cont">${n ? `▶ ${done ? '이어서 학습하기' : '첫 장 시작하기'}<br><small style="font-weight:600">${n.c.no}장 · ${n.s.no} ${n.s.title}</small>` : '🎉 모두 완료! 모의고사로 실력 점검'}</button>
    </div>
    ${CH.map(c => `<button class="chap ${doneOf(c) === unitsOf(c) ? 'done' : ''}" data-c="${c.no}">
      <span class="no">${doneOf(c) === unitsOf(c) ? '✓' : +c.no}</span>
      <span class="ct"><b>${c.title}</b><small>${c.sections.length}개 절 · 문제 ${c.sections.reduce((a, s) => a + s.quiz.length, 0)}개 · 진도 ${doneOf(c)}/${unitsOf(c)}</small>
      <span class="bar"><i style="width:${doneOf(c) / unitsOf(c) * 100}%"></i></span></span></button>`).join('')}
  </div>`;
  $('#cont').onclick = () => { const x = nextSection(); x ? go(`#/c/${x.c.no}/${x.s.no}`) : go('#/exam'); };
  view.querySelectorAll('[data-c]').forEach(b => b.onclick = () => go(`#/c/${b.dataset.c}`));
}

function renderChapter(c) {
  $('#title').textContent = `${c.no}장 ${c.title}`;
  view.innerHTML = `<div class="stack">
    <div class="lhead"><span class="k">CHAPTER ${c.no}</span><h2>${c.title}</h2></div>
    ${c.goals.length ? `<div class="goals"><h3>🎯 학습 목표</h3><ul>${c.goals.map(g => `<li>${g}</li>`).join('')}</ul></div>` : ''}
    ${c.sections.map(s => `<button class="sec" data-s="${s.no}"><span class="k">${s.no}</span><span class="t">${s.title}${s.quiz.length ? `<br><small class="muted">문제 ${s.quiz.length}개${prog['q/' + skey(c, s)] ? ' · 완료' : ''}</small>` : ''}${s.tasks.length ? `<br><small class="muted">SQL 실습 ${s.tasks.length}문제</small>` : ''}</span><span class="ck">${prog[skey(c, s)] ? '✓' : '›'}</span></button>`).join('')}
    ${c.no === '06' ? '<button class="qbtn" id="toExam">📝 실전 모의고사 01~05회 풀기</button>' : ''}
  </div>`;
  view.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go(`#/c/${c.no}/${b.dataset.s}`));
  const te = $('#toExam'); if (te) te.onclick = () => go('#/exam');
}

// ───────── 절: 본문 + SQL 실행 + 확인 문제 ─────────
function renderSection(c, s) {
  const i = c.sections.indexOf(s), prev = c.sections[i - 1], next = c.sections[i + 1], nextCh = CH[CH.indexOf(c) + 1];
  $('#title').textContent = `${s.no} ${s.title}`;
  const dbKey = skey(c, s);
  view.innerHTML = `<div class="stack">
    <div class="lhead"><span class="k">${c.no}장 ${c.title} · ${i + 1} / ${c.sections.length}</span><h2>${s.no} ${s.title}</h2></div>
    <div class="card body">${s.html}
      ${s.tasks.length ? `<p><b>실습 문제 ${s.tasks.length}개</b>는 아래 <b>SQL 실습</b> 탭에서 직접 풀고 채점할 수 있어요.</p><button class="qbtn" id="toPlay">💻 SQL 실습 문제 풀러 가기</button>` : ''}
    </div>
    ${s.quiz.length ? `<div class="card quiz" id="qz"></div>` : ''}
    <div class="nav2">
      ${prev ? `<button data-go="#/c/${c.no}/${prev.no}">‹ 이전</button>` : `<button data-go="#/c/${c.no}">‹ 목차</button>`}
      ${next ? `<button class="pri" data-go="#/c/${c.no}/${next.no}">다음 ›</button>` : nextCh ? `<button class="pri" data-go="#/c/${nextCh.no}">다음 장 ›</button>` : `<button class="pri" data-go="#/exam">모의고사 ›</button>`}
    </div></div>`;
  view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const tp = $('#toPlay'); if (tp) tp.onclick = () => go('#/play');
  DBS.delete(dbKey);                                            // 절을 열 때마다 예제 DB 를 새로
  view.querySelectorAll('.cb[data-c]').forEach(el => codeBox(el, CODE[+el.dataset.c], dbKey));
  if (s.quiz.length) quizBox($('#qz'), s.quiz, `📝 ${c.no === '06' || c.no === '07' ? '문제' : '확인 문제'} ${s.quiz.length}개`, () => { prog['q/' + dbKey] = Date.now(); saveProg(); toast('🎉 모두 맞혔어요!'); });
  if (!prog[dbKey]) { prog[dbKey] = Date.now(); saveProg(); }
}

// SQL 상자: 고쳐서 실행, 원래대로, 복사, DB 초기화
function codeBox(el, ex, dbKey, opts = {}) {
  const label = ex.norun ? 'SQL · 오라클 문법 (이 앱의 SQLite 에서는 실행되지 않을 수 있어요)' : ex.error ? 'SQL · 오류가 나는 것이 정상인 예' : 'SQL';
  el.innerHTML = `<div class="hd"><span>${label}</span><button class="run">▶ 실행</button><button class="rs" title="원래 코드">↺</button><button class="cp">복사</button></div>
    <textarea spellcheck="false" autocapitalize="off" autocomplete="off"></textarea><div class="rt" hidden></div>`;
  const ta = el.querySelector('textarea'), out = el.querySelector('.rt');
  const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.value = ex.code; requestAnimationFrame(fit);
  ta.addEventListener('input', fit);
  const show = (res, lb) => { out.hidden = false; out.innerHTML = `<span class="lb">${lb}</span>${resultHTML(res)}`; };
  if (ex.res && !opts.blank) show(ex.res, '실행 결과 (교안과 같은 결과)');
  el.querySelector('.run').onclick = async () => {
    const b = el.querySelector('.run'); b.disabled = true; b.textContent = '⏳';
    try { const db = await getDB(dbKey); show(runSQL(db, ta.value), '실행 결과'); }
    catch (e) { show([{ err: String(e.message || e) }], '실행 준비 실패'); }
    b.disabled = false; b.textContent = '▶ 실행';
  };
  el.querySelector('.rs').onclick = () => { ta.value = ex.code; fit(); DBS.delete(dbKey); toast('원래 SQL 로 되돌리고 예제 DB 를 처음 상태로 돌렸어요'); };
  el.querySelector('.cp').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('복사했어요'); } catch (e) { ta.select(); } };
  return ta;
}
function resultHTML(res) {
  return (res || []).map(r => {
    if (r.err) return `<div class="err">${esc(r.err)}</div>`;
    if (r.msg) return `<div class="msg">${esc(r.msg)}</div>`;
    return `<table><tr>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${r.rows.map(row => `<tr>${row.map(v => v === 'NULL' ? '<td class="nl">NULL</td>' : `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table><small>${r.rows.length}개 행</small>`;
  }).join('') || '<div class="msg">(결과 없음)</div>';
}

// ───────── SQL 실행 (sql.js: 브라우저 안의 SQLite) ─────────
// 처음 실행할 때 한 번 내려받고(약 1MB), 이후에는 폰에 저장된 것을 써서 인터넷 없이도 실행된다.
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';
let SQLlib = null;
const DBS = new Map();                                           // 절마다 따로 쓰는 예제 DB
function loadSQL() {
  if (SQLlib) return SQLlib;
  SQLlib = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = SQLJS + 'sql-wasm.js';
    s.onload = () => initSqlJs({ locateFile: f => SQLJS + f }).then(res, e => { SQLlib = null; rej(e); });
    s.onerror = () => { SQLlib = null; rej(new Error('SQL 실행기를 내려받지 못했어요. 처음 한 번은 인터넷 연결이 필요해요.')); };
    document.head.appendChild(s);
  });
  return SQLlib;
}
async function getDB(key) {
  if (DBS.has(key)) return DBS.get(key);
  const SQL = await loadSQL();
  const db = new SQL.Database();
  addFunctions(db);
  db.exec(SAMPLE_SQL);
  DBS.set(key, db);
  return db;
}
// 오라클 함수 흉내 (tools/sql_lib.py 와 같은 동작)
function addFunctions(db) {
  const nul = f => (...a) => a.some(x => x === null || x === undefined) ? null : f(...a);
  const fixed = (f, n) => { Object.defineProperty(f, 'length', { value: n }); return f; };
  const rnd = (x, n = 0, trunc = false) => {
    if (x === null || n === null) return null;
    const f = Math.pow(10, n), v = Number((Math.abs(x) * f).toPrecision(15));
    return Math.sign(x) * (trunc ? Math.trunc(v) : Math.round(v)) / f;
  };
  const pad = left => (s, n, p = ' ') => {
    if (s === null || n === null) return null;
    s = String(s); n = Math.trunc(n);
    if (s.length >= n) return s.slice(0, n);
    const fill = p.repeat(n).slice(0, n - s.length);
    return left ? fill + s : s + fill;
  };
  const decode = (...a) => {
    const e = a[0], r = a.slice(1);
    while (r.length >= 2) { const s = r.shift(), v = r.shift(); if (e === s || (e === null && s === null)) return v; }
    return r.length ? r[0] : null;
  };
  const F = [
    ['NVL', fixed((a, b) => a === null ? b : a, 2)], ['NVL2', fixed((a, b, c) => a === null ? c : b, 3)],
    ['INITCAP', fixed(nul(s => String(s).replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())), 1)],
    ['LPAD', fixed((s, n) => pad(true)(s, n), 2)], ['LPAD', fixed((s, n, p) => pad(true)(s, n, p), 3)],
    ['RPAD', fixed((s, n) => pad(false)(s, n), 2)], ['RPAD', fixed((s, n, p) => pad(false)(s, n, p), 3)],
    ['CONCAT', fixed((a, b) => (a ?? '') + '' + (b ?? ''), 2)],
    ['MOD', fixed(nul((a, b) => b === 0 ? a : a - b * Math.trunc(a / b)), 2)],
    ['ROUND', fixed(x => rnd(x), 1)], ['ROUND', fixed((x, n) => rnd(x, n), 2)],
    ['TRUNC', fixed(x => rnd(x, 0, true), 1)], ['TRUNC', fixed((x, n) => rnd(x, n, true), 2)],
    ['CEIL', fixed(nul(Math.ceil), 1)], ['FLOOR', fixed(nul(Math.floor), 1)], ['POWER', fixed(nul(Math.pow), 2)],
    ['SQRT', fixed(nul(Math.sqrt), 1)], ['SIGN', fixed(nul(Math.sign), 1)],
    ['REGEXP_LIKE', fixed(nul((s, p) => new RegExp(p).test(String(s)) ? 1 : 0), 2)],
    ['REGEXP_SUBSTR', fixed(nul((s, p) => { const m = String(s).match(new RegExp(p)); return m ? m[0] : null; }), 2)],
    ['REGEXP_REPLACE', fixed(nul((s, p, r) => String(s).replace(new RegExp(p, 'g'), r.replace(/\\(\d)/g, '$$$1'))), 3)],
    ['REGEXP_INSTR', fixed(nul((s, p) => { const m = String(s).match(new RegExp(p)); return m ? m.index + 1 : 0; }), 2)],
    ['REGEXP_COUNT', fixed(nul((s, p) => (String(s).match(new RegExp(p, 'g')) || []).length), 2)],
    ['REGEXP', fixed(nul((p, s) => new RegExp(p).test(String(s)) ? 1 : 0), 2)],
  ];
  for (let n = 3; n <= 15; n++) F.push(['DECODE', fixed((...a) => decode(...a), n)]);
  for (const [name, f] of F) db.create_function(name, f);
}
const fmtV = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')) : String(v);
const MSG = { CREATE: '생성되었습니다.', DROP: '삭제되었습니다.', ALTER: '변경되었습니다.', BEGIN: '트랜잭션을 시작합니다.', COMMIT: '커밋되었습니다.', ROLLBACK: '롤백되었습니다.', SAVEPOINT: '저장점이 만들어졌습니다.', RELEASE: '저장점을 해제했습니다.' };
function runSQL(db, sql) {
  const res = [];
  try {
    for (const st of db.iterateStatements(sql)) {
      const text = st.getSQL().replace(/--.*$/gm, '').trim();
      const head = (text.split(/\s+/)[0] || '').toUpperCase().replace(/;$/, '');
      const cols = st.getColumnNames();
      if (cols.length) {
        const rows = []; while (st.step()) rows.push(st.get().map(fmtV));
        res.push({ cols, rows });
      } else {
        st.step();
        const n = db.getRowsModified();
        res.push({ msg: ['INSERT', 'UPDATE', 'DELETE'].includes(head) ? `${n}개 행이 ${{ INSERT: '삽입', UPDATE: '수정', DELETE: '삭제' }[head]}되었습니다.` : (MSG[head] || '완료되었습니다.') });
      }
      st.free();
    }
  } catch (e) { res.push({ err: '오류: ' + e.message }); }
  return res;
}

// ───────── 문제 상자 (절 확인 문제·기출) ─────────
function quizBox(box, quiz, title, onAllRight) {
  const picked = quiz.map(() => null);
  const draw = () => {
    const answered = picked.every(p => p !== null), right = picked.filter((p, k) => p === quiz[k].a).length;
    box.innerHTML = `<h3>${title}</h3>` + quiz.map((q, k) => `<div class="qq"><p>Q${k + 1}. ${q.q}</p>${q.code ? `<pre class="scr">${esc(q.code)}</pre>` : ''}<div class="qo">${q.o.map((o, j) => {
      let cls = ''; if (picked[k] !== null) { if (j === q.a) cls = 'right'; else if (j === picked[k]) cls = 'wrong'; }
      return `<button data-q="${k}" data-o="${j}" class="${cls}" ${picked[k] !== null ? 'disabled' : ''}>${'①②③④'[j] || ''} ${o}</button>`;
    }).join('')}</div>${picked[k] !== null ? `<div class="qe ${picked[k] === q.a ? 'ok' : 'no'}">${picked[k] === q.a ? '⭕ 정답!' : '❌ 아쉬워요.'} ${q.e}</div>` : ''}</div>`).join('') +
      (answered ? `<div class="qres">${right === quiz.length ? '🎉 모두 맞혔어요!' : `${right} / ${quiz.length} 정답`}</div>${right === quiz.length ? '' : '<div style="margin-top:8px"><button class="btnw" id="retry">↺ 틀린 문제 다시 풀기</button></div>'}` : '');
    box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      picked[+b.dataset.q] = +b.dataset.o; draw();
      if (picked.every((p, k) => p === quiz[k].a)) onAllRight && onAllRight();
    });
    const r = box.querySelector('#retry'); if (r) r.onclick = () => { picked.forEach((p, k) => { if (p !== quiz[k].a) picked[k] = null; }); draw(); };
  };
  draw();
}

// ───────── 실전 모의고사 ─────────
// 전체 문제 은행에서 과목 비율대로 50문항(1과목 10 + 2과목 40)을 회차마다 정해진 순서로 뽑는다.
const EXAMS = [1, 2, 3, 4, 5], EK = 'sqld-exams-v1', CUR = 'sqld-exam-current';
const BANK = CH.flatMap(c => c.sections.flatMap(s => s.quiz.map((q, k) => ({ ...q, from: `${s.no} ${s.title}`, id: `${s.no}#${k}` }))));
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function examSet(no) {
  const r = seeded(no * 7919 + 13);
  const pick = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  return [...pick(BANK.filter(q => q.s === 1), 10), ...pick(BANK.filter(q => q.s === 2), 40)];
}
function renderExamList() {
  $('#title').textContent = '실전 모의고사';
  const rs = load(EK, {}), cur = load(CUR, null);
  view.innerHTML = `<div class="stack">
    <div class="card"><b>시험과 같은 형식</b><br><span class="muted" style="font-size:14px">50문항 (1과목 10 · 2과목 40) · 90분 · 문항당 2점<br>합격: 총점 60점 이상 + 과목별 40% 이상 (1과목 4문항, 2과목 16문항 이상)</span></div>
    ${EXAMS.map(n => { const r = rs[n]; return `<button class="chap ${r && r.pass ? 'done' : ''}" data-e="${n}"><span class="no">${String(n).padStart(2, '0')}</span>
      <span class="ct"><b>실전 모의고사 ${String(n).padStart(2, '0')}회</b><small>${r ? `최근 ${r.total}점 (1과목 ${r.s1}/10 · 2과목 ${r.s2}/40) · ${r.pass ? '합격 ✅' : '불합격'}` : cur && cur.no === n ? '풀던 시험이 있어요 · 이어서 풀기' : '아직 안 풀었어요'}</small></span><span>›</span></button>`; }).join('')}
    <p class="muted" style="font-size:12.5px;margin:0">문제는 교안의 확인 문제·기출공략집·고난이도 문제 ${BANK.length}개에서 회차마다 다르게 뽑아요. 회차끼리 일부 문제가 겹칠 수 있어요.</p>
  </div>`;
  view.querySelectorAll('[data-e]').forEach(b => b.onclick = () => go(`#/exam/${b.dataset.e}`));
}
function renderExam(no) {
  if (!EXAMS.includes(no)) return go('#/exam');
  const qs = examSet(no);
  let st = load(CUR, null);
  if (!st || st.no !== no) st = { no, ans: Array(50).fill(null), end: Date.now() + 90 * 60000, done: false };
  let idx = 0;
  $('#title').textContent = `모의고사 ${String(no).padStart(2, '0')}회`;
  const persist = () => { if (!st.done) save(CUR, st); };
  const draw = () => {
    if (st.done) return result();
    const q = qs[idx];
    view.innerHTML = `<div class="stack">
      <div class="exam-top"><span class="tm" id="tm"></span><span class="pg">${idx + 1} / 50 · ${q.s}과목 · 푼 문제 ${st.ans.filter(a => a !== null).length}</span><button class="btnw" style="width:auto;padding:6px 12px" id="submit">제출</button></div>
      <div class="card quiz"><div class="qq"><p>${idx + 1}. ${q.q}</p>${q.code ? `<pre class="scr">${esc(q.code)}</pre>` : ''}<div class="qo">${q.o.map((o, j) => `<button data-o="${j}" class="${st.ans[idx] === j ? 'right' : ''}">${'①②③④'[j]} ${o}</button>`).join('')}</div></div></div>
      <div class="nav2"><button id="pv" ${idx ? '' : 'disabled'}>‹ 이전</button><button class="pri" id="nx">${idx < 49 ? '다음 ›' : '제출하기'}</button></div>
      <div class="card"><div class="qnav">${qs.map((_, k) => `<button data-k="${k}" class="${st.ans[k] !== null ? 'done' : ''}" ${k === idx ? 'style="outline:2px solid var(--accent2)"' : ''}>${k + 1}</button>`).join('')}</div></div>
    </div>`;
    view.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { st.ans[idx] = +b.dataset.o; persist(); if (idx < 49) { idx++; } draw(); });
    $('#pv').onclick = () => { idx--; draw(); };
    $('#nx').onclick = () => { if (idx < 49) { idx++; draw(); } else submit(); };
    $('#submit').onclick = submit;
    view.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { idx = +b.dataset.k; draw(); });
    tick();
  };
  const tick = () => {
    const el = $('#tm'); if (!el) return;
    const left = Math.max(0, st.end - Date.now());
    el.textContent = `⏱ ${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    if (left <= 0) { toast('시간이 끝나 자동으로 제출했어요'); return finish(); }
  };
  const timer = setInterval(tick, 1000); cleanup.push(() => clearInterval(timer));
  const submit = () => {
    const blank = st.ans.filter(a => a === null).length;
    if (confirm(blank ? `안 푼 문제가 ${blank}개 있어요. 제출할까요?` : '제출할까요?')) finish();
  };
  const finish = () => {
    st.done = true;
    const s1 = qs.filter((q, k) => q.s === 1 && st.ans[k] === q.a).length, s2 = qs.filter((q, k) => q.s === 2 && st.ans[k] === q.a).length;
    const total = (s1 + s2) * 2, pass = total >= 60 && s1 >= 4 && s2 >= 16;
    const rs = load(EK, {}); rs[no] = { total, s1, s2, pass, at: Date.now() }; save(EK, rs);
    try { localStorage.removeItem(CUR); } catch (e) {}
    st.result = { s1, s2, total, pass }; result();
  };
  const result = () => {
    const r = st.result;
    view.innerHTML = `<div class="stack">
      <div class="pass ${r.pass ? 'ok' : 'no'}">${r.pass ? '🎉 합격!' : '😢 불합격'} ${r.total}점</div>
      <div class="score"><div>총점<b>${r.total}</b></div><div>1과목<b>${r.s1}/10</b>${r.s1 < 4 ? '<small style="color:var(--err)">과락</small>' : ''}</div><div>2과목<b>${r.s2}/40</b>${r.s2 < 16 ? '<small style="color:var(--err)">과락</small>' : ''}</div></div>
      <div class="card"><h3 style="margin:0 0 8px;font-size:15px">문항별 결과 (눌러서 해설 보기)</h3><div class="qnav">${qs.map((q, k) => `<button data-k="${k}" class="${st.ans[k] === q.a ? 'right' : 'wrong'}">${k + 1}</button>`).join('')}</div></div>
      <div id="rv"></div>
      <div class="nav2"><button id="again">↺ 다시 풀기</button><button class="pri" id="list">모의고사 목록</button></div></div>`;
    const showQ = k => {
      const q = qs[k], a = st.ans[k];
      $('#rv').innerHTML = `<div class="card quiz"><div class="qq"><p>${k + 1}. ${q.q}</p>${q.code ? `<pre class="scr">${esc(q.code)}</pre>` : ''}<div class="qo">${q.o.map((o, j) => `<button disabled class="${j === q.a ? 'right' : j === a ? 'wrong' : ''}">${'①②③④'[j]} ${o}</button>`).join('')}</div>
        <div class="qe ${a === q.a ? 'ok' : 'no'}">${a === q.a ? '⭕ 정답' : a === null ? '⚪ 안 푼 문제' : '❌ 오답'} · ${q.e}<br><small class="muted">출처: ${q.from}</small></div></div></div>`;
      $('#rv').scrollIntoView({ behavior: 'smooth' });
    };
    view.querySelectorAll('[data-k]').forEach(b => b.onclick = () => showQ(+b.dataset.k));
    const firstWrong = qs.findIndex((q, k) => st.ans[k] !== q.a); if (firstWrong >= 0) showQ(firstWrong);
    $('#again').onclick = () => { try { localStorage.removeItem(CUR); } catch (e) {} st = { no, ans: Array(50).fill(null), end: Date.now() + 90 * 60000, done: false }; idx = 0; window.scrollTo(0, 0); draw(); };
    $('#list').onclick = () => go('#/exam');
    window.scrollTo(0, 0);
  };
  draw();
}

// ───────── SQL 실습: 문제 고르기 → 작성 → 채점 ─────────
const TASKS = CH.flatMap(c => c.sections.flatMap(s => s.tasks));
const TK = 'sqld-tasks-v1';
let taskIdx = 0;
function sameResult(user, ans, ordered) {
  const u = user.filter(r => r.cols).pop(), a = ans.filter(r => r.cols).pop();
  if (!u) return '조회 결과(SELECT)가 없어요.';
  if (u.cols.length !== a.cols.length) return `칼럼 수가 달라요 (내 결과 ${u.cols.length}개, 정답 ${a.cols.length}개).`;
  if (u.rows.length !== a.rows.length) return `행 수가 달라요 (내 결과 ${u.rows.length}행, 정답 ${a.rows.length}행).`;
  const key = r => JSON.stringify(r);
  const ur = u.rows.map(key), ar = a.rows.map(key);
  if (ordered) return ur.every((v, i) => v === ar[i]) ? '' : '값이나 정렬 순서가 정답과 달라요.';
  return ur.slice().sort().every((v, i) => v === ar.slice().sort()[i]) ? '' : '행의 값이 정답과 달라요.';
}
function renderPlay() {
  $('#title').textContent = 'SQL 실습';
  const solved = load(TK, {}), t = TASKS[taskIdx];
  const draft = load('sqld-task-draft', {});
  view.innerHTML = `<div class="stack">
    <p class="muted" style="margin:0;font-size:14px">예제 DB(EMP·DEPT·SALGRADE)로 SQL 을 직접 써 보세요. <b>채점</b>은 정답 SQL 의 결과와 비교해요. 해결 ${Object.keys(solved).length} / ${TASKS.length}</p>
    <div class="taskh">${TASKS.map((x, k) => `<button data-t="${k}" class="${k === taskIdx ? 'on' : ''} ${solved[x.title] ? 'ok' : ''}">${k + 1}</button>`).join('')}</div>
    <div class="card"><b>${esc(t.title)}</b><p style="margin:6px 0 0">${t.prompt}</p></div>
    <div class="cb" id="ed"></div>
    <div class="nav2"><button id="ans">정답 보기</button><button class="pri" id="grade">✔ 채점</button></div>
    <div id="fb"></div>
    <details class="card"><summary><b>예제 DB 표 보기</b></summary><div class="cb" id="db"></div></details>
  </div>`;
  view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { taskIdx = +b.dataset.t; renderPlay(); });
  const ta = codeBox($('#ed'), { code: draft[t.title] || '-- 여기에 SQL 을 쓰세요\nSELECT ', res: null }, 'play', { blank: true });
  ta.addEventListener('input', () => { const d = load('sqld-task-draft', {}); d[t.title] = ta.value; save('sqld-task-draft', d); });
  $('#ed .rs').onclick = () => { ta.value = '-- 여기에 SQL 을 쓰세요\nSELECT '; ta.dispatchEvent(new Event('input')); DBS.delete('play'); };
  codeBox($('#db'), { code: 'SELECT * FROM EMP;\nSELECT * FROM DEPT;\nSELECT * FROM SALGRADE;', res: null }, 'dbview', { blank: true });
  $('#ans').onclick = () => { $('#fb').innerHTML = `<div class="cb"><div class="hd"><span>정답 SQL (다른 방법도 결과가 같으면 정답)</span></div><pre class="scr" style="margin:0;border-radius:0">${esc(t.answer)}</pre><div class="rt"><span class="lb">정답 결과</span>${resultHTML(t.res)}</div></div>`; };
  $('#grade').onclick = async () => {
    try {
      DBS.delete('grade');
      const db = await getDB('grade'), mine = runSQL(db, ta.value);
      const err = mine.find(r => r.err);
      const why = err ? err.err : sameResult(mine, t.res, /ORDER\s+BY/i.test(t.answer));
      if (!why) { const s = load(TK, {}); s[t.title] = Date.now(); save(TK, s); }
      $('#fb').innerHTML = `<div class="qe ${why ? 'no' : 'ok'}" style="font-size:15px">${why ? '❌ ' + esc(why) : '⭕ 정답이에요! 다음 문제에 도전해 보세요.'}</div><div class="cb" style="margin-top:8px"><div class="rt"><span class="lb">내 결과</span>${resultHTML(mine)}</div></div>`;
      if (!why) view.querySelector(`[data-t="${taskIdx}"]`).classList.add('ok');
    } catch (e) { $('#fb').innerHTML = `<div class="qe no">${esc(e.message || e)}</div>`; }
  };
}

// ───────── 사용법 ─────────
function renderHelp() {
  $('#title').textContent = '사용법';
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const sec = (t, b) => `<div class="card help"><h3>${t}</h3>${b}</div>`;
  view.innerHTML = `<div class="stack">
    ${sec('📚 이렇게 공부해요', `<ol><li><b>학습</b> 탭에서 1장(데이터 모델링)부터 차례로 읽고, 절 끝 <b>확인 문제</b>를 풀어요.</li>
      <li>6장 <b>기출공략집</b>(대표 유형 30선, 변형문제 2회) → <b>모의고사</b> 탭의 실전 모의고사 01~05회로 마무리해요.</li>
      <li>7장 고난이도 문제와 <b>SQL 실습</b> 탭의 15문제로 실력을 다져요.</li></ol>`)}
    ${sec('▶ SQL 실행하기', `<ul><li>검은 SQL 상자는 <b>고쳐서 ▶ 실행</b>할 수 있어요. 예제 DB(EMP·DEPT·SALGRADE)가 들어 있어요.</li>
      <li>처음 실행할 때 SQL 실행기를 내려받고(약 1MB), 그다음엔 <b>인터넷 없이도</b> 실행돼요.</li>
      <li>절마다 예제 DB 가 따로 있고, <b>↺</b> 를 누르면 원래 SQL 과 처음 DB 상태로 돌아가요.</li>
      <li>앱은 <b>SQLite</b> 로 실행해요. NVL·DECODE·LPAD·TRUNC·REGEXP_ 함수는 오라클처럼 동작하게 넣어 두었지만, ROLLUP·CONNECT BY·PIVOT·MERGE·ROWNUM·(+) 같은 <b>오라클 전용 문법</b>은 실행되지 않아요. 그런 예제 옆에는 같은 결과를 내는 SQL 을 함께 실었어요.</li></ul>`)}
    ${sec('📝 실전 모의고사', '<ul><li>50문항(1과목 10, 2과목 40), 90분 타이머, 문항당 2점.</li><li>합격 기준: 60점 이상 + 과목별 40% 이상. 과락까지 채점해 줘요.</li><li>도중에 나가도 이어서 풀 수 있고, 제출 후 문항별 해설과 출처(교안 절)를 볼 수 있어요.</li></ul>')}
    ${sec('📲 앱으로 설치 · 오프라인', `<ul><li>${installed ? '✅ 지금 <b>앱으로 실행 중</b>이에요.' : 'Chrome: 위쪽 <b>[설치]</b> 안내 또는 <b>⋮ → 앱 설치</b> · 아이폰 Safari: <b>공유 → 홈 화면에 추가</b>'}</li>
      <li>카카오톡에서 링크를 열면 자동으로 Chrome(아이폰은 Safari)으로 넘어가요.</li><li>새 내용이 추가되면 인터넷이 될 때 앱을 열면 자동으로 업데이트돼요. 진도·모의고사 기록은 그대로 남아요.</li></ul>`)}
    ${sec('💾 기록', `<ul><li>진도, 모의고사 점수, 실습 결과는 이 폰의 이 브라우저에만 저장돼요.</li></ul><div style="margin-top:10px"><button class="btnw" id="reset">모든 기록 지우기</button></div>`)}
    <p class="muted" style="text-align:center;font-size:13px">7개 장 · SQL 예제 ${CODE.length}개 · 문제 ${BANK.length}개 · 실습 ${TASKS.length}문제<br><a href="https://github.com/sinaboro/sqld-learning-app-" target="_blank" rel="noopener">교안 PDF (GitHub)</a></p>
  </div>`;
  $('#reset').onclick = () => { if (confirm('진도·모의고사·실습 기록을 모두 지울까요?')) { ['sqld-progress-v1', EK, CUR, TK, 'sqld-task-draft'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); prog = {}; toast('기록을 지웠어요'); } };
}

// ───────── 앱 설치 · 오프라인 ─────────
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
(() => {
  const bar = $('#inst'), msg = $('#instMsg'), btn = $('#instGo');
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const kakao = /KAKAOTALK/i.test(ua), android = /Android/i.test(ua);
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = kakao || /NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
  const DISMISS = 'sqld-install-dismissed';
  const show = (text, label, onGo) => { msg.innerHTML = text; btn.hidden = !label; btn.textContent = label || ''; btn.onclick = onGo || null; bar.hidden = false; };
  const dismissed = () => { try { return localStorage.getItem(DISMISS) === '1'; } catch (e) { return false; } };
  $('#instX').onclick = () => { bar.hidden = true; try { localStorage.setItem(DISMISS, '1'); } catch (e) {} };
  if (standalone) return;
  const openOutside = () => {
    const url = location.href.split('#')[0];
    if (kakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    else if (android) location.href = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
  };
  if (inApp) {
    show(ios ? '📲 앱으로 설치하려면 <b>Safari</b>에서 열어야 해요.' : '📲 앱으로 설치하려면 <b>Chrome</b>에서 열어야 해요.', ios ? 'Safari로 열기' : 'Chrome으로 열기', openOutside);
    let jumped = false;
    try { jumped = sessionStorage.getItem('kakaoJump') === '1'; sessionStorage.setItem('kakaoJump', '1'); } catch (e) {}
    if (kakao && !jumped) setTimeout(openOutside, 300);
    return;
  }
  let deferred = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferred = e;
    if (dismissed()) return;
    show('📲 홈 화면에 <b>앱으로 설치</b>하면 인터넷 없이도 공부할 수 있어요.', '설치', async () => {
      deferred.prompt();
      const r = await deferred.userChoice.catch(() => ({}));
      deferred = null; bar.hidden = true;
      if (r.outcome === 'accepted') toast('설치했어요. 홈 화면의 SQLD 아이콘으로 여세요.');
    });
  });
  addEventListener('appinstalled', () => { bar.hidden = true; });
  if (ios && !dismissed()) show('📲 아래 <b>공유 버튼</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있어요.');
})();

route();

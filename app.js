(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEY = 'takken_normal_2026_v2';
  const FIELDS = ['宅建業法','権利関係','法令上の制限','税・その他'];
  const FIELD_TARGET = {'宅建業法':20,'権利関係':14,'法令上の制限':8,'税・その他':8};
  const PASS_LINE = APP_DATA.passLine || 35;
  const initialState = () => ({dailyAnswers:{},completedDays:{},reviewAnswers:{},examAttempts:[],lastStudy:null});
  const state = Object.assign(initialState(), JSON.parse(localStorage.getItem(KEY) || '{}'));
  state.dailyAnswers ||= {}; state.completedDays ||= {}; state.reviewAnswers ||= {}; state.examAttempts ||= [];
  let session = null;
  let examSession = null;
  let showAllExplanations = false;

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const questions = () => APP_DATA.questions;
  const qById = id => questions().find(q => q.id === id);
  const assetForTag = tag => {
    const hit = APP_DATA.questions.find(q => q.tag === tag) || APP_DATA.glossary.find(g => g.tag === tag);
    return hit && hit.asset ? `assets/${hit.asset}.svg` : 'assets/illust-default.svg';
  };
  const todayIndex = () => Math.min(14, Math.max(1, Object.keys(state.completedDays).length + 1));
  const pct = (ok,total) => total ? Math.round(ok / total * 100) : 0;
  const esc = str => String(str ?? '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const showToast = text => {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2300);
  };

  function allRecords(){
    const daily = Object.values(state.dailyAnswers || {});
    const review = Object.values(state.reviewAnswers || {});
    const latest = getLatestExam();
    const exam = latest ? latest.items : [];
    return [...daily, ...review, ...exam];
  }
  function getLatestExam(){ return state.examAttempts.length ? state.examAttempts[state.examAttempts.length - 1] : null; }

  function calc(){
    const recs = allRecords();
    const total = recs.length;
    const correct = recs.filter(r => r.correct).length;
    const acc = pct(correct,total);
    const done = Object.keys(state.completedDays).length;
    const latest = getLatestExam();
    const field = Object.fromEntries(FIELDS.map(f => [f,{ok:0,total:0,target:FIELD_TARGET[f]}]));
    recs.forEach(r => { if (!field[r.field]) field[r.field] = {ok:0,total:0,target:0}; field[r.field].total++; if (r.correct) field[r.field].ok++; });
    let pass;
    if (latest) {
      const examRate = latest.score / 50 * 100;
      const weakPenalty = Object.values(latest.fieldStats).filter(v => v.total && v.ok/v.total < .55).length * 3;
      pass = Math.round(Math.min(98, Math.max(2, examRate * 1.05 + Math.min(done,14) * 1.4 - weakPenalty)));
    } else {
      const coverage = Math.min(100, done / 14 * 100);
      const weakPenalty = Object.values(field).filter(v => v.total && v.ok/v.total < .55).length * 4;
      pass = Math.round(Math.min(92, Math.max(0, acc * .55 + coverage * .35 + Math.min(done,14) * 1.2 - weakPenalty)));
    }
    return {total, correct, acc, done, latest, field, pass};
  }

  function updateGlobal(){
    const c = calc();
    $('#passProb').textContent = `${c.pass}%`;
    $('#heroProb').textContent = `${c.pass}%`;
    $('#accuracy').textContent = `${c.acc}%`;
    $('#doneDays').textContent = `${c.done}/14`;
    $('#passMsg').textContent = c.pass >= 80 ? '合格圏。弱点だけ潰す段階' : c.pass >= 55 ? '射程圏。宅建業法を固める' : c.done ? '継続で伸びる段階' : 'まずは1日目を開始';
    if (c.latest) {
      $('#lastMockScore').textContent = `${c.latest.score}/50`;
      $('#lastMockStatus').textContent = c.latest.passed ? '合格判定' : '不合格判定・復習優先';
    } else {
      $('#lastMockScore').textContent = '未実施';
      $('#lastMockStatus').textContent = '50問形式';
    }
    $('#coachText').textContent = APP_DATA.encouragement[(c.done + c.correct) % APP_DATA.encouragement.length];
    renderToday(); renderRoadmap(); renderAnalytics();
  }

  function renderToday(){
    const d = APP_DATA.days[todayIndex() - 1];
    let desc = '今日の10問を解くと、分野別理解度と合格確率が更新されます。';
    let action = `<button class="primary" onclick="window.Takken.startDay(${d.day})">DAY ${d.day}を開始</button>`;
    if (d.review) { desc = '間違えた問題を中心に復習します。弱点タグを確認して、同じミスを1つずつ消します。'; action = `<button class="primary" onclick="window.Takken.startWeakReview()">弱点復習を開始</button>`; }
    if (d.mock || d.final) { desc = '50問を本試験配分で一括出題します。全問解答後に採点・合否・全問解説を表示します。'; action = `<button class="primary" onclick="window.Takken.go('mock');window.Takken.renderMockHome()">50問模試へ</button>`; }
    $('#todayCard').innerHTML = `<p class="eyebrow">DAY ${d.day}</p><div class="today-title">${esc(d.title)}</div><div class="focus-list">${d.focus.map(f => `<span>${esc(f)}</span>`).join('')}</div><p class="muted">${desc}</p>${action}`;
  }

  function renderRoadmap(){
    $('#roadmap').innerHTML = APP_DATA.days.map(d => {
      const cls = ['day', state.completedDays[d.day] ? 'done' : '', todayIndex() === d.day ? 'today' : '', (d.mock || d.final) ? 'mockday' : ''].join(' ');
      const click = d.mock || d.final ? `window.Takken.go('mock');window.Takken.renderMockHome()` : d.review ? `window.Takken.startWeakReview()` : `window.Takken.startDay(${d.day})`;
      return `<div class="${cls}" onclick="${click}"><b>DAY ${d.day}</b><small>${esc(d.title)}</small><div class="focus-list">${d.focus.slice(0,2).map(f=>`<span>${esc(f)}</span>`).join('')}</div></div>`;
    }).join('');
  }

  function startDay(day){
    const d = APP_DATA.days[day - 1];
    if (!d) return;
    if (d.mock || d.final) { go('mock'); renderMockHome(); return; }
    if (d.review) { startWeakReview(); return; }
    session = {type:'daily', day, qs:d.questions || [], i:0, score:0};
    go('study');
    $('#studyTitle').textContent = `DAY ${day}｜${d.title}`;
    $('#studyFocus').innerHTML = d.focus.map(f => `<span class="chip">${esc(f)}</span>`).join(' ');
    $('#qTotal').textContent = session.qs.length;
    renderQuestion();
  }

  function startWeakReview(){
    const wrongIds = new Set();
    Object.entries(state.dailyAnswers).forEach(([id,a]) => { if (!a.correct) wrongIds.add(id); });
    const latest = getLatestExam();
    if (latest) latest.items.forEach(item => { if (!item.correct) wrongIds.add(item.id); });
    let qs = [...wrongIds].map(qById).filter(Boolean);
    if (!qs.length) {
      const answered = new Set(Object.keys(state.dailyAnswers));
      qs = questions().filter(q => !answered.has(q.id)).slice(0,8);
    }
    if (!qs.length) qs = shuffle(questions()).slice(0,8);
    session = {type:'review', day:13, qs:shuffle(qs).slice(0,12), i:0, score:0};
    go('study');
    $('#studyTitle').textContent = '弱点復習｜間違えた問題だけ反復';
    $('#studyFocus').innerHTML = '<span class="chip warn">間違い直し</span><span class="chip">全問図解解説</span>';
    $('#qTotal').textContent = session.qs.length;
    renderQuestion();
  }

  function renderQuestion(){
    if (!session) return;
    const q = session.qs[session.i];
    $('#qIndex').textContent = Math.min(session.i + 1, session.qs.length);
    if (!q) { finishSession(); return; }
    const img = assetForTag(q.tag);
    $('#quizArea').innerHTML = `<div class="question-layout"><div class="question-visual"><img src="${img}" alt="${esc(q.tag)}の図解" onerror="this.src='assets/illust-default.svg'"><span class="tag-pill">${esc(q.field)} / ${esc(q.tag)}</span></div><div><div class="question-text">${esc(q.q)}</div><div class="choices">${q.choices.map((c,i)=>`<button class="choice" data-i="${i}"><span class="num">${i+1}</span><span>${esc(c)}</span></button>`).join('')}</div><div class="explain" id="explain"><div class="explain-grid"><img src="${img}" alt="解説図" onerror="this.src='assets/illust-default.svg'"><div><h3 id="resultTitle"></h3><p id="explainText"></p><p class="muted" id="memoryHook"></p></div></div><div class="next-row"><button class="secondary" onclick="window.Takken.startWeakReview()">弱点復習へ</button><button class="primary" id="nextQ">次へ進む</button></div></div></div></div>`;
    $$('.choice', $('#quizArea')).forEach(b => b.addEventListener('click', () => answerDaily(q, Number(b.dataset.i))));
  }

  function answerDaily(q, idx){
    if ($('#explain')?.classList.contains('show')) return;
    const ok = idx === q.answer;
    if (ok) session.score++;
    const rec = {id:q.id, correct:ok, selected:idx, answer:q.answer, field:q.field, tag:q.tag, ts:Date.now(), mode:session.type};
    if (session.type === 'daily') state.dailyAnswers[q.id] = rec;
    else state.reviewAnswers[`${q.id}_${Date.now()}`] = rec;
    state.lastStudy = new Date().toISOString().slice(0,10);
    save();
    $$('.choice', $('#quizArea')).forEach((b,i) => { if (i === q.answer) b.classList.add('correct'); if (i === idx && !ok) b.classList.add('wrong'); b.disabled = true; });
    $('#resultTitle').textContent = ok ? '正解です。ここは得点源にできます。' : '惜しいです。ここを押さえれば大丈夫。';
    $('#explainText').textContent = q.ex;
    $('#memoryHook').textContent = `記憶フック：${q.hook}`;
    $('#explain').classList.add('show');
    showToast(ok ? 'すばらしい！1点積み上がりました' : '今のミスは本番前の財産です');
    $('#nextQ').onclick = () => { session.i++; renderQuestion(); };
    updateGlobal();
  }

  function finishSession(){
    if (!session) return;
    if (session.type === 'daily') state.completedDays[session.day] = true;
    if (session.type === 'review') state.completedDays[13] = true;
    save();
    $('#quizArea').innerHTML = `<div class="empty-state"><h2>${session.type === 'daily' ? `DAY ${session.day}` : '弱点復習'} 完了</h2><p class="question-text">${session.score}/${session.qs.length}問 正解</p><p class="muted">学習効果ページで、弱点タグと得意分野を確認しましょう。</p><div class="hero-actions"><button class="primary" onclick="window.Takken.go('analytics')">学習効果を見る</button><button class="secondary" onclick="window.Takken.go('mock');window.Takken.renderMockHome()">50問模試へ</button></div></div>`;
    updateGlobal();
  }

  function renderAnalytics(){
    const area = $('#fieldBars');
    if (!area) return;
    const c = calc();
    $('#probBig').textContent = `${c.pass}%`;
    $('.prob-ring').style.setProperty('--p', `${c.pass}%`);
    area.innerHTML = FIELDS.map(f => {
      const v = c.field[f] || {ok:0,total:0,target:FIELD_TARGET[f]};
      const p = pct(v.ok,v.total);
      return `<div class="bar-row"><div class="bar-label"><span>${f}</span><b>${p}%</b></div><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><p class="muted">${v.ok}/${v.total}問 正解　<span class="chip">本試験配分 ${FIELD_TARGET[f]}問</span></p></div>`;
    }).join('');
    const latest = c.latest;
    $('#probFactors').innerHTML = `<li>総合正答率：${c.acc}%</li><li>完了日数：${c.done}/14日</li><li>直近模試：${latest ? `${latest.score}/50点` : '未実施'}</li><li>合格目安：${PASS_LINE}/50点</li>`;
    const tagStats = {};
    allRecords().forEach(a => { tagStats[a.tag] ||= {ok:0,total:0,field:a.field}; tagStats[a.tag].total++; if(a.correct) tagStats[a.tag].ok++; });
    const weak = Object.entries(tagStats).filter(([_,v]) => v.total && v.ok/v.total < .7).sort((a,b) => (a[1].ok/a[1].total) - (b[1].ok/b[1].total));
    $('#weakList').innerHTML = weak.length ? weak.map(([t,v]) => `<div class="weak-card"><b>${esc(t)}</b><p>${v.ok}/${v.total}問 正解</p><small>${esc(v.field)}｜${pct(v.ok,v.total)}%</small></div>`).join('') : '<p class="muted">まだ弱点は出ていません。まずは問題を解きましょう。</p>';
    const strong = Object.entries(tagStats).filter(([_,v]) => v.total >= 1 && v.ok/v.total >= .8).sort((a,b) => pct(b[1].ok,b[1].total)-pct(a[1].ok,a[1].total));
    $('#strongList').innerHTML = strong.length ? strong.map(([t,v]) => `<span class="chip good">${esc(t)} ${pct(v.ok,v.total)}%</span>`).join('') : '<p class="muted">得意タグは学習後に表示されます。</p>';
  }

  function renderGlossary(){
    $('#glossaryList').innerHTML = APP_DATA.glossary.map(g => `<div class="term-card"><img src="assets/${g.asset}.svg" alt="${esc(g.term)}" onerror="this.src='assets/illust-default.svg'"><div><small>第${g.rank}位</small><b>${esc(g.term)}</b><p>${esc(g.desc)}</p><p class="muted">${esc(g.tip)}</p></div></div>`).join('');
  }

  function renderMockHome(){
    const counts = [0,1,2,3].map(i => questions().filter(q => q.answer === i).length);
    const latest = getLatestExam();
    showAllExplanations = false;
    $('#mockArea').innerHTML = `<div class="exam-start"><div class="exam-info"><b>本試験配分</b>${FIELDS.map(f => `<p><span class="chip">${f}</span> ${FIELD_TARGET[f]}問</p>`).join('')}</div><div class="exam-info"><b>今回の修正ポイント</b><p>正解番号の分布：1番=${counts[0]}問、2番=${counts[1]}問、3番=${counts[2]}問、4番=${counts[3]}問</p><p>全問解答が終わるまで採点・解説は表示しません。</p></div></div><div class="hero-actions"><button class="primary" onclick="window.Takken.startMockExam()">50問模試を開始</button>${latest ? `<button class="secondary" onclick="window.Takken.showLatestExam()">前回結果を見る</button>` : ''}</div>`;
  }

  function startMockExam(){
    examSession = {qs: shuffle(questions()), i:0, selections:{}, startedAt:Date.now()};
    showAllExplanations = false;
    go('mock');
    renderMockQuestion();
  }

  function renderMockQuestion(){
    if (!examSession) { renderMockHome(); return; }
    const q = examSession.qs[examSession.i];
    const answered = Object.keys(examSession.selections).length;
    const remain = 50 - answered;
    const selected = examSession.selections[q.id];
    const progress = Math.round(answered / 50 * 100);
    $('#mockArea').innerHTML = `<div class="exam-progress"><span class="unanswered">残り ${remain}問</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><b>${answered}/50 解答済み</b></div><div class="exam-grid"><div class="qnav">${examSession.qs.map((qq,idx)=>`<button class="${examSession.selections[qq.id] !== undefined ? 'answered' : ''} ${idx === examSession.i ? 'current' : ''}" onclick="window.Takken.jumpMock(${idx})">${idx+1}</button>`).join('')}</div><div class="exam-question"><p class="eyebrow">QUESTION ${examSession.i+1}/50｜問題集 問${q.sourceNo || '-'}　${esc(q.field)} / ${esc(q.tag)}</p><div class="question-layout"><div class="question-visual"><img src="${assetForTag(q.tag)}" alt="${esc(q.tag)}の図解" onerror="this.src='assets/illust-default.svg'"><span class="tag-pill">本試験形式：解説は採点後</span></div><div><div class="question-text">${esc(q.q)}</div><div class="choices">${q.choices.map((c,i)=>`<button class="choice ${selected === i ? 'selected' : ''}" data-i="${i}"><span class="num">${i+1}</span><span>${esc(c)}</span></button>`).join('')}</div></div></div><div class="exam-controls"><button class="secondary" onclick="window.Takken.prevMock()">前の問題</button><div class="hero-actions"><button class="secondary" onclick="window.Takken.nextMock()">次の問題</button><button class="primary" ${remain ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''} onclick="window.Takken.finishMockExam()">採点する</button></div></div></div></div>`;
    $$('#mockArea .choice').forEach(btn => btn.addEventListener('click', () => { examSession.selections[q.id] = Number(btn.dataset.i); renderMockQuestion(); }));
  }

  function jumpMock(i){ if (!examSession) return; examSession.i = Math.max(0, Math.min(49, i)); renderMockQuestion(); }
  function prevMock(){ if (!examSession) return; examSession.i = Math.max(0, examSession.i - 1); renderMockQuestion(); }
  function nextMock(){ if (!examSession) return; examSession.i = Math.min(49, examSession.i + 1); renderMockQuestion(); }

  function finishMockExam(){
    if (!examSession) return;
    const answered = Object.keys(examSession.selections).length;
    if (answered < 50) { showToast(`未解答が${50 - answered}問あります。全問解答後に採点できます。`); return; }
    const items = examSession.qs.map(q => {
      const selected = examSession.selections[q.id];
      return {id:q.id, selected, answer:q.answer, correct:selected === q.answer, field:q.field, tag:q.tag, ts:Date.now(), mode:'mock'};
    });
    const score = items.filter(i => i.correct).length;
    const fieldStats = Object.fromEntries(FIELDS.map(f => [f,{ok:0,total:0,target:FIELD_TARGET[f]}]));
    items.forEach(i => { fieldStats[i.field].total++; if (i.correct) fieldStats[i.field].ok++; });
    const attempt = {id:`exam_${Date.now()}`, score, passed:score >= PASS_LINE, fieldStats, items, startedAt:examSession.startedAt, finishedAt:Date.now()};
    state.examAttempts.push(attempt);
    state.completedDays[12] = true;
    if (score >= PASS_LINE) state.completedDays[14] = true;
    save();
    examSession = null;
    showAllExplanations = true;
    showLatestExam();
    updateGlobal();
  }

  function showLatestExam(){
    const attempt = getLatestExam();
    if (!attempt) { renderMockHome(); return; }
    const weakFields = FIELDS.filter(f => attempt.fieldStats[f].total && attempt.fieldStats[f].ok / attempt.fieldStats[f].total < .7);
    const strongFields = FIELDS.filter(f => attempt.fieldStats[f].total && attempt.fieldStats[f].ok / attempt.fieldStats[f].total >= .8);
    $('#mockArea').innerHTML = `<div class="result-hero"><div class="result-main ${attempt.passed ? '' : 'fail'}"><h3>${attempt.passed ? '合格判定' : '不合格判定'}</h3><div class="score-big">${attempt.score}/50</div><p>合格目安 ${PASS_LINE}点。${attempt.passed ? '本番でもこの精度を維持し、弱点タグだけ最後に確認してください。' : '宅建業法と弱点分野を優先して復習すれば、まだ十分に伸ばせます。'}</p></div><div class="result-sub"><div class="mini-card"><b>弱点分野</b><p>${weakFields.length ? weakFields.map(f=>`<span class="chip warn">${f} ${pct(attempt.fieldStats[f].ok,attempt.fieldStats[f].total)}%</span>`).join(' ') : '<span class="chip good">大きな弱点なし</span>'}</p></div><div class="mini-card"><b>得意分野</b><p>${strongFields.length ? strongFields.map(f=>`<span class="chip good">${f} ${pct(attempt.fieldStats[f].ok,attempt.fieldStats[f].total)}%</span>`).join(' ') : '<span class="muted">まだ得意分野は固定化していません</span>'}</p></div><div class="hero-actions"><button class="primary" onclick="window.Takken.startExamWrongReview()">間違いだけ復習</button><button class="secondary" onclick="window.Takken.startMockExam()">もう一度50問模試</button></div></div></div><article class="card" style="margin-top:16px;box-shadow:none;background:#f8fbff"><h2>各問題の解説</h2><p class="muted">全問の正解・あなたの解答・解説・記憶フックを確認できます。</p><button class="secondary small" onclick="window.Takken.toggleExplanations()">${showAllExplanations ? '解説を閉じる' : '全問解説を開く'}</button><div id="examExplanations">${showAllExplanations ? renderExamExplanations(attempt) : ''}</div></article>`;
  }

  function renderExamExplanations(attempt){
    return `<div class="explanation-list">${attempt.items.map((item,idx) => {
      const q = qById(item.id);
      const img = assetForTag(q.tag);
      return `<div class="explanation-card ${item.correct ? 'good' : 'bad'}"><img src="${img}" alt="${esc(q.tag)}" onerror="this.src='assets/illust-default.svg'"><div><p class="eyebrow">問${idx+1}｜${esc(q.field)} / ${esc(q.tag)}</p><b>${esc(q.q)}</b><div class="answer-line"><span class="${item.correct ? 'ans-ok':'ans-ng'}">あなた：${item.selected + 1}. ${esc(q.choices[item.selected])}</span><span class="ans-ok">正解：${item.answer + 1}. ${esc(q.choices[item.answer])}</span></div><p>${esc(q.ex)}</p><p class="muted">記憶フック：${esc(q.hook)}</p></div></div>`;
    }).join('')}</div>`;
  }

  function toggleExplanations(){ showAllExplanations = !showAllExplanations; showLatestExam(); }

  function startExamWrongReview(){
    const latest = getLatestExam();
    if (!latest) { showToast('まだ模試結果がありません'); return; }
    const wrong = latest.items.filter(i => !i.correct).map(i => qById(i.id)).filter(Boolean);
    if (!wrong.length) { showToast('間違いはありません。全問正解レベルです。'); return; }
    session = {type:'review', day:13, qs:wrong, i:0, score:0};
    go('study');
    $('#studyTitle').textContent = '模試復習｜間違いだけ解き直し';
    $('#studyFocus').innerHTML = '<span class="chip warn">模試の間違い</span><span class="chip">全問図解</span>';
    $('#qTotal').textContent = session.qs.length;
    renderQuestion();
  }

  function go(id){
    $$('.page').forEach(p => p.classList.toggle('active', p.id === id));
    $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
    if (id === 'mock' && !examSession) renderMockHome();
    window.scrollTo({top:0, behavior:'smooth'});
  }


  // Mobile/PWA installation and connectivity
  let deferredInstallPrompt = null;
  function isIos(){ return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  function openInstallGuide(){
    const guide = $('#installGuide');
    const text = $('#installGuideText');
    const now = $('#installNowBtn');
    if (isIos()) {
      text.textContent = 'Safari下部の共有ボタンを押し、「ホーム画面に追加」を選択してください。追加後は全画面のアプリとして起動できます。';
      now.textContent = '手順を確認しました';
    } else {
      text.textContent = deferredInstallPrompt ? '「ホーム画面に追加」を押すと、通常のアプリのようにインストールできます。' : 'Chromeのメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。';
      now.textContent = deferredInstallPrompt ? 'ホーム画面に追加' : '閉じる';
    }
    guide.classList.add('show'); guide.setAttribute('aria-hidden','false');
  }
  function closeInstallGuide(){ const g=$('#installGuide'); g.classList.remove('show'); g.setAttribute('aria-hidden','true'); }
  async function requestInstall(){
    if (!deferredInstallPrompt) { closeInstallGuide(); return; }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(()=>null);
    deferredInstallPrompt = null;
    closeInstallGuide();
    $('#installBtn').hidden = true;
  }
  function updateConnectivity(){ $('#offlineBadge').hidden = navigator.onLine; }

  function boot(){
    $$('[data-nav]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.nav)));
    $('#resetBtn').addEventListener('click', () => { if (confirm('学習記録をリセットしますか？')) { localStorage.removeItem(KEY); location.reload(); } });
    $('#reviewWeakBtn').addEventListener('click', startWeakReview);
    renderGlossary();
    renderMockHome();
    updateGlobal();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    const installBtn = $('#installBtn');
    if (!isStandalone()) installBtn.hidden = false;
    installBtn.addEventListener('click', openInstallGuide);
    $('#closeInstallGuide').addEventListener('click', closeInstallGuide);
    $('#installNowBtn').addEventListener('click', requestInstall);
    $('#installGuide').addEventListener('click', e => { if (e.target.id === 'installGuide') closeInstallGuide(); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; installBtn.hidden = false; });
    window.addEventListener('appinstalled', () => { installBtn.hidden = true; closeInstallGuide(); showToast('ホーム画面に追加しました'); });
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    updateConnectivity();
    const answerCounts = [0,1,2,3].map(i => questions().filter(q => q.answer === i).length);
    const fieldCounts = Object.fromEntries(FIELDS.map(f => [f, questions().filter(q => q.field === f).length]));
    console.info('[TakKen MASTER self-check]', {questionCount:questions().length, answerCounts, fieldCounts, passLine:PASS_LINE});
  }

  window.Takken = {go,startDay,startWeakReview,renderMockHome,startMockExam,jumpMock,prevMock,nextMock,finishMockExam,showLatestExam,toggleExplanations,startExamWrongReview};
  boot();
})();

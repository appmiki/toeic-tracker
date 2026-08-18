import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

/* ---------------------------------------------------------
   平日だけで750点を目指す学習計画
--------------------------------------------------------- */

const START_DATE = new Date(2026, 7, 18); // 8/18 (ローカル時刻で生成、UTCパース起因のズレを防ぐ)
const END_DATE = new Date(2027, 0, 31); // 1/31
const START_SCORE = 450;
const TARGET_SCORE = 750;

const CAT_COLORS = {
  vocab: "#F2B84B",
  grammar: "#4FD1AE",
  reading: "#7FA8D9",
  listening: "#C792EA",
  mock: "#F27059",
  review: "#F27059",
  rest: "#8CA0BC",
};
const CAT_LABELS = {
  vocab: "単語", grammar: "文法", reading: "リーディング",
  listening: "リスニング", mock: "模試", review: "総復習", rest: "軽め復習",
};

const CAT_DETAIL = {
  vocab: "新出50語 + 前回分の復習20語(ターゲット1100)",
  grammar: "Part5形式の文法問題15問(文法特急、該当ユニット)",
  reading: "Part7の長文3passage分を時間を計って読む(世界一わかりやすい授業Part7読解)",
  listening: "公式問題集のPart3&4を1セット(会話・トーク3〜4つ)解き、スクリプトを見ながら聞き直す",
  review: "直近1週間で間違えた問題の解き直し + 単語の復習20分",
  rest: "単語・文法の軽い復習15〜20分(新しい範囲はやらない)",
};
// 木曜(リスニング)側に模試のリスニング区間を寄せているフェーズ
const LISTENING_MOCK_DETAIL = {
  p4: "公式問題集または精選模試でリスニングセクションを50問、時間を計って通し(模試代わり)",
  p5: "公式問題集でリスニングセクション(100問/約45分)を本番と同じ時間で通し",
  p6: "公式問題集でリスニングセクション(100問/約45分)を本番と同じ時間で通し、最終リハーサル",
};
// 金曜(模試)はリーディングのみに寄せている
const MOCK_DETAIL = {
  p1: "公式問題集でPart5(30問)を時間を計って解く。現状把握が目的",
  p2: "公式問題集でPart5+6(46問)を時間を計って解く",
  p3: "公式問題集でPart7を1セット、時間を計って解く",
  p4: "公式問題集または精選模試でリーディングを50問、時間を計って通しで",
  p5: "公式問題集でリーディングセクション(100問/約75分)を本番と同じ制限時間で通し",
  p6: "公式問題集でリーディングセクション(100問/約75分)を本番と同じ制限時間で通し、最終リハーサル",
};
function detailFor(cat, phaseId) {
  if (cat === "mock") return MOCK_DETAIL[phaseId];
  if (cat === "listening" && LISTENING_MOCK_DETAIL[phaseId]) return LISTENING_MOCK_DETAIL[phaseId];
  return CAT_DETAIL[cat];
}

// 各フェーズの月〜金の割り当て (0=月 ... 4=金)
const PHASES = [
  {
    id: "p1", title: "離陸準備", sub: "現在地の把握と土台づくり",
    start: "2026-08-18", end: "2026-08-31", targetScore: 480,
    week: ["vocab", "grammar", "reading", "listening", "mock"],
    vocabNote: "ターゲット1100 Chapter1(470点レベル)",
    focus: [
      "月・火で基礎文法とChapter1の単語をスタート",
      "金曜に模試を1セクション解いて弱点を把握する",
    ],
    minutes: "平日45〜60分",
  },
  {
    id: "p2", title: "基礎固め", sub: "文法・語彙の土台を固定する",
    start: "2026-09-01", end: "2026-09-30", targetScore: 550,
    week: ["vocab", "grammar", "reading", "listening", "review"],
    vocabNote: "ターゲット1100 Chapter2(600点レベル)",
    focus: [
      "文法問題集1冊・Chapter2の単語を1周",
      "金曜はその週の復習+ミニテスト",
    ],
    minutes: "平日60分",
  },
  {
    id: "p3", title: "加速", sub: "パート別演習で得点力に変える",
    start: "2026-10-01", end: "2026-10-31", targetScore: 600,
    week: ["vocab", "reading", "reading", "listening", "mock"],
    vocabNote: "ターゲット1100 Chapter3(730点レベル)",
    focus: [
      "火・水はPart5-6速習とPart7速読",
      "木はPart3-4のディクテーション、金は模試1パート",
    ],
    minutes: "平日60〜75分",
  },
  {
    id: "p4", title: "巡航", sub: "本番形式に慣れ、スピードを上げる",
    start: "2026-11-01", end: "2026-11-30", targetScore: 650,
    week: ["vocab", "grammar", "reading", "listening", "mock"],
    vocabNote: "ターゲット1100 Chapter4+熟語",
    focus: [
      "Part5-6のスピード演習(1問20秒目安)",
      "金曜は模試を通し、または半分で時間を計る",
    ],
    minutes: "平日75分",
  },
  {
    id: "p5", title: "最終進入", sub: "弱点をつぶし、時間配分を仕上げる",
    start: "2026-12-01", end: "2026-12-31", targetScore: 700,
    week: ["review", "grammar", "reading", "listening", "mock"],
    vocabNote: "ターゲット1100 全体反復(1〜4章)",
    focus: [
      "月は間違えた問題だけの復習ノートを整理",
      "金曜は模試+徹底復習を1セットで",
    ],
    minutes: "平日60分",
  },
  {
    id: "p6", title: "着陸", sub: "本番シミュレーションで仕上げる",
    start: "2027-01-01", end: "2027-01-31", targetScore: 750,
    week: ["rest", "rest", "mock", "review", "mock"],
    vocabNote: "ターゲット1100 総仕上げ(苦手語のみ)",
    focus: [
      "詰め込みすぎず、月・火は単語と文法を軽く",
      "水・金は本番と同じ制限時間で模試を実施",
    ],
    minutes: "平日45〜60分",
  },
];

/* ---------------------------------------------------------
   date helpers
--------------------------------------------------------- */
function fmt(d) {
  const y = d.getFullYear(), m = `${d.getMonth() + 1}`.padStart(2, "0"), day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayStr() { return fmt(new Date()); }
function isWeekday(d) { const w = d.getDay(); return w >= 1 && w <= 5; }
function inRange(d) { return d >= START_DATE && d <= END_DATE; }
function phaseForDate(d) {
  for (const p of PHASES) {
    if (d >= parseYMD(p.start) && d <= parseYMD(p.end)) return p;
  }
  return d < START_DATE ? PHASES[0] : PHASES[PHASES.length - 1];
}
function taskForDate(d) {
  if (!isWeekday(d) || !inRange(d)) return null;
  const p = phaseForDate(d);
  const idx = d.getDay() - 1; // 0=Mon..4=Fri
  const cat = p.week[idx];
  return { cat, label: CAT_LABELS[cat], color: CAT_COLORS[cat], phase: p, detail: detailFor(cat, p.id) };
}
function allWeekdaysInRange() {
  const arr = [];
  const cur = new Date(START_DATE);
  while (cur <= END_DATE) {
    if (isWeekday(cur)) arr.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}
const WEEKDAY_LIST = allWeekdaysInRange();
const MONTHS = [
  { y: 2026, m: 7 }, { y: 2026, m: 8 }, { y: 2026, m: 9 },
  { y: 2026, m: 10 }, { y: 2026, m: 11 }, { y: 2027, m: 0 },
];
const MONTH_LABEL = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

/* ---------------------------------------------------------
   storage helpers (localStorage版 — GitHub Pages等の単体公開用。
   Claudeアーティファクト内で使う場合は window.storage に戻してください)
--------------------------------------------------------- */
async function loadDone() {
  try {
    const raw = localStorage.getItem("toeic:done-dates");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
async function saveDone(done) {
  try { localStorage.setItem("toeic:done-dates", JSON.stringify(done)); } catch {}
}
async function loadScores() {
  try {
    const raw = localStorage.getItem("toeic:scores");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function saveScores(scores) {
  try { localStorage.setItem("toeic:scores", JSON.stringify(scores)); } catch {}
}

/* ---------------------------------------------------------
   Runway
--------------------------------------------------------- */
function Runway({ now }) {
  const total = Math.round((END_DATE - START_DATE) / 86400000);
  const elapsed = Math.min(Math.max(Math.round((now - START_DATE) / 86400000), 0), total);
  const pct = (elapsed / total) * 100;
  return (
    <div style={{ width: "100%", marginTop: 18 }}>
      <div style={{ position: "relative", height: 10, background: "#1E2C46", borderRadius: 6 }}>
        {PHASES.map(p => {
          const segStart = Math.round((parseYMD(p.start) - START_DATE) / 86400000);
          const left = (segStart / total) * 100;
          return (
            <div key={p.id} style={{ position: "absolute", left: `${left}%`, top: 0, bottom: 0, width: 1, background: "rgba(234,240,247,0.15)" }} />
          );
        })}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "linear-gradient(90deg,#4FD1AE,#F2B84B)", borderRadius: 6, transition: "width .6s ease" }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 9px)`, top: -11, fontSize: 18, transform: "rotate(90deg)", filter: "drop-shadow(0 0 4px rgba(242,184,75,.6))" }}>✈</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#8CA0BC", fontFamily: "'JetBrains Mono',monospace" }}>
        <span>8/18 出発</span><span>1/31 着陸</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Main App
--------------------------------------------------------- */
export default function App() {
  const [tab, setTab] = useState("today");
  const [done, setDone] = useState(null);
  const [scores, setScores] = useState(null);
  const [monthIdx, setMonthIdx] = useState(1); // default: 8月
  const [scoreDraft, setScoreDraft] = useState({ date: todayStr(), score: "" });

  const now = new Date();
  const phase = phaseForDate(now);
  const remainingDays = Math.max(Math.round((END_DATE - now) / 86400000), 0);
  const todayTask = taskForDate(now);

  useEffect(() => {
    (async () => {
      setDone(await loadDone());
      setScores(await loadScores());
    })();
  }, []);

  const toggleDone = useCallback(async (dateStr) => {
    const next = { ...(done || {}) };
    if (next[dateStr]) delete next[dateStr]; else next[dateStr] = true;
    setDone(next);
    await saveDone(next);
  }, [done]);

  const handleAddScore = useCallback(async () => {
    const val = Number(scoreDraft.score);
    if (!val || val < 10 || val > 990) return;
    const next = [...(scores || []).filter(s => s.date !== scoreDraft.date), { date: scoreDraft.date, score: val }]
      .sort((a, b) => a.date.localeCompare(b.date));
    setScores(next);
    await saveScores(next);
    setScoreDraft({ date: todayStr(), score: "" });
  }, [scoreDraft, scores]);

  const stats = useMemo(() => {
    if (!done) return { doneCount: 0, total: WEEKDAY_LIST.length, streak: 0 };
    const doneCount = WEEKDAY_LIST.filter(d => done[d]).length;
    // current streak counting back from most recent weekday <= today
    let streak = 0;
    const past = WEEKDAY_LIST.filter(d => parseYMD(d) <= now).reverse();
    for (const d of past) {
      if (done[d]) streak++; else break;
    }
    return { doneCount, total: WEEKDAY_LIST.length, streak };
  }, [done, now]);

  const chartData = useMemo(() => (scores || []).map(s => ({ date: s.date.slice(5), score: s.score })), [scores]);
  const latestScore = scores && scores.length ? scores[scores.length - 1].score : START_SCORE;
  const scoreProgress = Math.min(Math.max((latestScore - START_SCORE) / (TARGET_SCORE - START_SCORE), 0), 1);

  if (!done || !scores) {
    return (
      <div style={{ ...styles.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8CA0BC", fontFamily: "'Noto Sans JP',sans-serif" }}>読み込み中…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{FONT_IMPORT}</style>

      <div style={styles.hero}>
        <div style={styles.eyebrow}>TOEIC 450 → 750 ・ 平日だけプラン</div>
        <div style={styles.heroScore}>
          <span style={{ color: "#8CA0BC", fontSize: 20 }}>現在地 </span>
          {latestScore}
          <span style={{ color: "#4FD1AE", fontSize: 20 }}> → 目標 {TARGET_SCORE}</span>
        </div>
        <div style={styles.heroMeta}>
          残り <b style={{ color: "#F2B84B" }}>{remainingDays}</b> 日 ・ 「{phase.title}」フェーズ
        </div>
        <Runway now={now} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "#8CA0BC" }}>
          <span>平日の実施率</span><span>{stats.doneCount} / {stats.total} 日</span>
        </div>
        <div style={styles.scoreBarTrack}>
          <div style={{ ...styles.scoreBarFill, width: `${(stats.doneCount / stats.total) * 100}%` }} />
        </div>
      </div>

      <div style={styles.tabRow}>
        {[["today", "今日"], ["calendar", "カレンダー"], ["progress", "進捗"], ["plan", "計画"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...styles.tabBtn, ...(tab === key ? styles.tabBtnActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === "today" && (
          <TodayTab now={now} todayTask={todayTask} done={done} toggleDone={toggleDone} streak={stats.streak} />
        )}
        {tab === "calendar" && (
          <CalendarTab monthIdx={monthIdx} setMonthIdx={setMonthIdx} done={done} toggleDone={toggleDone} now={now} />
        )}
        {tab === "progress" && (
          <ProgressTab chartData={chartData} scoreDraft={scoreDraft} setScoreDraft={setScoreDraft}
            onAddScore={handleAddScore} scores={scores} done={done} />
        )}
        {tab === "plan" && <PlanTab phase={phase} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Today tab
--------------------------------------------------------- */
function TodayTab({ now, todayTask, done, toggleDone, streak }) {
  const ds = fmt(now);
  const w = now.getDay();
  const isWknd = w === 0 || w === 6;

  if (isWknd) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>今日は週末</div>
        <div style={{ color: "#8CA0BC", fontSize: 13, lineHeight: 1.7 }}>
          このプランは平日だけで組んであります。今日はしっかり休んで、月曜からまた再開しましょう。
        </div>
      </div>
    );
  }

  if (!todayTask) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>期間外です</div>
        <div style={{ color: "#8CA0BC", fontSize: 13 }}>計画期間(8/18〜1/31)の外側です。</div>
      </div>
    );
  }

  const isDone = !!done[ds];
  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>今日のタスク</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 6, background: todayTask.color, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Zen Kaku Gothic New',sans-serif" }}>{todayTask.label}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#8CA0BC", marginTop: 6 }}>{todayTask.phase.minutes} ・ {todayTask.phase.title}フェーズ</div>
        <div style={styles.detailBox}>{todayTask.detail}</div>
        {todayTask.cat === "vocab" && (
          <div style={styles.routineBox2}>📘 {todayTask.phase.vocabNote}</div>
        )}
        <button
          onClick={() => toggleDone(ds)}
          style={{ ...styles.saveBtn, background: isDone ? "#243352" : "linear-gradient(90deg,#4FD1AE,#3fc79e)", color: isDone ? "#4FD1AE" : "#0F1A2E", border: isDone ? "1px solid #4FD1AE" : "none" }}
        >
          {isDone ? "完了済み ✓ (タップで取消)" : "今日のタスクを完了にする"}
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>連続実施</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Zen Kaku Gothic New',sans-serif", color: "#F2B84B" }}>
          {streak}<span style={{ fontSize: 14, color: "#8CA0BC", fontWeight: 400 }}> 日</span>
        </div>
        <div style={{ fontSize: 12, color: "#8CA0BC", marginTop: 4 }}>平日を休まず続けられている日数です</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Calendar tab
--------------------------------------------------------- */
function CalendarTab({ monthIdx, setMonthIdx, done, toggleDone, now }) {
  const { y, m } = MONTHS[monthIdx];
  const first = new Date(y, m, 1);
  const startPad = first.getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));

  const nowStr = fmt(now);
  const [selected, setSelected] = useState(nowStr);
  const selectedDateObj = parseYMD(selected);
  const selectedTask = taskForDate(selectedDateObj);
  const selectedDone = !!done[selected];

  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button
            disabled={monthIdx === 0}
            onClick={() => setMonthIdx(i => Math.max(i - 1, 0))}
            style={{ ...styles.navBtn, opacity: monthIdx === 0 ? 0.3 : 1 }}
          >‹</button>
          <div style={{ fontFamily: "'Zen Kaku Gothic New',sans-serif", fontWeight: 700, fontSize: 16 }}>
            {y}年 {MONTH_LABEL[m]}
          </div>
          <button
            disabled={monthIdx === MONTHS.length - 1}
            onClick={() => setMonthIdx(i => Math.min(i + 1, MONTHS.length - 1))}
            style={{ ...styles.navBtn, opacity: monthIdx === MONTHS.length - 1 ? 0.3 : 1 }}
          >›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 10.5, color: "#8CA0BC", textAlign: "center", marginBottom: 6 }}>
          {["日", "月", "火", "水", "木", "金", "土"].map(w => <div key={w}>{w}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const task = taskForDate(d);
            const ds = fmt(d);
            const isDone = !!done[ds];
            const isToday = ds === nowStr;
            const isSelected = ds === selected;
            const clickable = !!task;
            return (
              <button
                key={i}
                disabled={!clickable}
                onClick={() => clickable && setSelected(ds)}
                style={{
                  ...styles.dayCell,
                  background: isSelected ? "rgba(242,184,75,0.14)" : isDone ? "rgba(79,209,174,0.18)" : task ? "#0F1A2E" : "transparent",
                  border: isSelected ? "1px solid #F2B84B" : isToday ? "1px solid #4FD1AE" : task ? "1px solid #1E2C46" : "1px solid transparent",
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                <span style={{ fontSize: 11, color: task ? "#EAF0F7" : "#3A4A66" }}>{d.getDate()}</span>
                {task && (
                  isDone
                    ? <span style={{ fontSize: 11, color: "#4FD1AE" }}>✓</span>
                    : <span style={{ width: 5, height: 5, borderRadius: 4, background: task.color, display: "inline-block" }} />
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 14 }}>
          {Object.entries(CAT_LABELS).map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#8CA0BC" }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: CAT_COLORS[k], display: "inline-block" }} />{label}
            </div>
          ))}
        </div>
      </div>

      {/* detail panel for the tapped day */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>{selected.slice(5).replace("-", "/")} のやること</div>
        {!selectedTask ? (
          <div style={{ color: "#8CA0BC", fontSize: 13 }}>この日は休みの日、または計画期間外です。</div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 6, background: selectedTask.color, display: "inline-block" }} />
              <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Zen Kaku Gothic New',sans-serif" }}>{selectedTask.label}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#8CA0BC", marginTop: 6 }}>{selectedTask.phase.minutes} ・ {selectedTask.phase.title}フェーズ</div>
            <div style={styles.detailBox}>{selectedTask.detail}</div>
            {selectedTask.cat === "vocab" && (
              <div style={styles.routineBox2}>📘 {selectedTask.phase.vocabNote}</div>
            )}
            <button
              onClick={() => toggleDone(selected)}
              style={{ ...styles.saveBtn, background: selectedDone ? "#243352" : "linear-gradient(90deg,#4FD1AE,#3fc79e)", color: selectedDone ? "#4FD1AE" : "#0F1A2E", border: selectedDone ? "1px solid #4FD1AE" : "none" }}
            >
              {selectedDone ? "完了済み ✓ (タップで取消)" : "この日を完了にする"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Progress tab
--------------------------------------------------------- */
function ProgressTab({ chartData, scoreDraft, setScoreDraft, onAddScore, scores, done }) {
  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>フェーズ別 実施状況</div>
        {PHASES.map(p => {
          const days = WEEKDAY_LIST.filter(d => d >= p.start && d <= p.end);
          const doneCount = days.filter(d => done[d]).length;
          const pct = days.length ? Math.round((doneCount / days.length) * 100) : 0;
          return (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span>{p.title}</span>
                <span style={{ color: "#8CA0BC" }}>{doneCount}/{days.length}</span>
              </div>
              <div style={styles.scoreBarTrack}>
                <div style={{ ...styles.scoreBarFill, width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>模試・本番スコアの記録</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={scoreDraft.date} onChange={e => setScoreDraft(d => ({ ...d, date: e.target.value }))} style={{ ...styles.dateInput, flex: 1 }} />
          <input type="number" min="10" max="990" placeholder="スコア" value={scoreDraft.score} onChange={e => setScoreDraft(d => ({ ...d, score: e.target.value }))} style={{ ...styles.numInput, flex: 1 }} />
        </div>
        <button onClick={onAddScore} style={styles.saveBtn}>記録を追加</button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>スコア推移</div>
        {chartData.length === 0 ? (
          <div style={{ color: "#8CA0BC", fontSize: 13, padding: "16px 0" }}>模試や公開テストの結果を追加すると、ここに表示されます。</div>
        ) : (
          <div style={{ width: "100%", height: 220, marginTop: 8 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#1E2C46" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8CA0BC", fontSize: 11 }} axisLine={{ stroke: "#26374F" }} tickLine={false} />
                <YAxis domain={[300, 900]} tick={{ fill: "#8CA0BC", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#16233D", border: "1px solid #26374F", borderRadius: 8, color: "#EAF0F7" }} />
                <ReferenceLine y={TARGET_SCORE} stroke="#F2B84B" strokeDasharray="4 4" label={{ value: "目標750", fill: "#F2B84B", fontSize: 11, position: "insideTopRight" }} />
                <Line type="monotone" dataKey="score" stroke="#4FD1AE" strokeWidth={2.5} dot={{ r: 4, fill: "#4FD1AE" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Plan tab
--------------------------------------------------------- */
function PlanTab({ phase }) {
  return (
    <div>
      {PHASES.map(p => {
        const isCurrent = p.id === phase.id;
        return (
          <div key={p.id} style={{ ...styles.card, ...(isCurrent ? styles.cardActive : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={styles.phaseTitle}>{p.title}</div>
              <div style={{ fontSize: 12, color: "#F2B84B", fontFamily: "'JetBrains Mono',monospace" }}>目標 {p.targetScore}</div>
            </div>
            <div style={{ fontSize: 12, color: "#8CA0BC", marginTop: 2 }}>
              {p.start.slice(5).replace("-", "/")} 〜 {p.end.slice(5).replace("-", "/")} ・ {p.sub}
            </div>
            <div style={styles.routineBox2}>📘 単語:{p.vocabNote}</div>
            <div style={{ marginTop: 10 }}>
              {["月", "火", "水", "木", "金"].map((wd, i) => (
                <div key={wd} style={{ display: "flex", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: i < 4 ? "1px solid #1E2C46" : "none" }}>
                  <span style={{ color: "#8CA0BC", width: 18, flexShrink: 0 }}>{wd}</span>
                  <span style={{ color: CAT_COLORS[p.week[i]], width: 66, flexShrink: 0 }}>{CAT_LABELS[p.week[i]]}</span>
                  <span style={{ color: "#D5DEEB" }}>{detailFor(p.week[i], p.id)}</span>
                </div>
              ))}
            </div>
            <ul style={styles.focusList}>{p.focus.map((f, i) => <li key={i}>{f}</li>)}</ul>
            <div style={styles.routineBox}>{p.minutes} / 平日のみ</div>
            {isCurrent && <div style={styles.currentBadge}>現在のフェーズ</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   styles
--------------------------------------------------------- */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap');
`;

const styles = {
  app: { minHeight: "100vh", background: "#0F1A2E", color: "#EAF0F7", fontFamily: "'Noto Sans JP',sans-serif", padding: "20px 16px 40px", boxSizing: "border-box", maxWidth: 480, margin: "0 auto" },
  hero: { background: "linear-gradient(160deg,#16233D,#101B30)", border: "1px solid #26374F", borderRadius: 16, padding: "18px 18px 20px" },
  eyebrow: { fontSize: 11, letterSpacing: "0.08em", color: "#4FD1AE", fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 },
  heroScore: { fontFamily: "'Zen Kaku Gothic New',sans-serif", fontWeight: 700, fontSize: 28, lineHeight: 1.1 },
  heroMeta: { fontSize: 12.5, color: "#8CA0BC", marginTop: 8 },
  scoreBarTrack: { height: 6, background: "#1E2C46", borderRadius: 4, marginTop: 6, overflow: "hidden" },
  scoreBarFill: { height: "100%", background: "linear-gradient(90deg,#4FD1AE,#F2B84B)", borderRadius: 4, transition: "width .5s ease" },
  tabRow: { display: "flex", gap: 5, marginTop: 20 },
  tabBtn: { flex: 1, padding: "9px 4px", borderRadius: 10, border: "1px solid #26374F", background: "transparent", color: "#8CA0BC", fontSize: 12.5, fontWeight: 500, fontFamily: "'Noto Sans JP',sans-serif", cursor: "pointer" },
  tabBtnActive: { background: "#1E2C46", color: "#EAF0F7", borderColor: "#4FD1AE" },
  content: { marginTop: 16 },
  card: { background: "#16233D", border: "1px solid #26374F", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardActive: { borderColor: "#F2B84B", boxShadow: "0 0 0 1px rgba(242,184,75,0.25)" },
  cardTitle: { fontFamily: "'Zen Kaku Gothic New',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 12 },
  dateInput: { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #26374F", background: "#0F1A2E", color: "#EAF0F7", fontSize: 13, fontFamily: "'Noto Sans JP',sans-serif", boxSizing: "border-box" },
  numInput: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #26374F", background: "#0F1A2E", color: "#EAF0F7", fontSize: 14, boxSizing: "border-box" },
  saveBtn: { width: "100%", marginTop: 16, padding: "11px 0", borderRadius: 10, border: "none", background: "linear-gradient(90deg,#4FD1AE,#3fc79e)", color: "#0F1A2E", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Noto Sans JP',sans-serif" },
  navBtn: { background: "#0F1A2E", border: "1px solid #26374F", borderRadius: 8, color: "#EAF0F7", width: 32, height: 32, fontSize: 16, cursor: "pointer" },
  dayCell: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, height: 40, borderRadius: 8, background: "transparent" },
  phaseTitle: { fontFamily: "'Zen Kaku Gothic New',sans-serif", fontWeight: 700, fontSize: 16 },
  focusList: { margin: "10px 0 12px", paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "#D5DEEB" },
  routineBox: { fontSize: 12.5, color: "#8CA0BC", background: "#0F1A2E", borderRadius: 8, padding: "8px 10px", border: "1px solid #1E2C46" },
  routineBox2: { fontSize: 12.5, color: "#F2B84B", background: "rgba(242,184,75,0.08)", borderRadius: 8, padding: "8px 10px", border: "1px solid rgba(242,184,75,0.3)", marginTop: 10 },
  detailBox: { fontSize: 13, color: "#D5DEEB", background: "#0F1A2E", borderRadius: 8, padding: "10px 12px", border: "1px solid #1E2C46", marginTop: 12, lineHeight: 1.6 },
  currentBadge: { marginTop: 10, display: "inline-block", fontSize: 11, color: "#F2B84B", border: "1px solid #F2B84B", borderRadius: 999, padding: "3px 10px" },
};

import { useState, useMemo, useRef, useEffect } from "react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

/** Fetch with one automatic retry after `retryDelay` ms on network failure */
async function fetchWithRetry(url, options = {}, retryDelay = 6000) {
  try {
    return await fetch(url, options);
  } catch (err) {
    await new Promise(r => setTimeout(r, retryDelay));
    return await fetch(url, options); // second attempt
  }
}

const COMMON_SKILLS = [
  "Power BI", "SQL", "Python", "Excel", "DAX", "Azure", "Tableau", "R", "dbt",
  "Snowflake", "Looker", "Spark", "Airflow", "Pandas", "NumPy", "Java", "Scala",
  "AWS", "GCP", "Qlik", "SAP", "Scikit-learn", "TensorFlow", "Jupyter",
  "Matplotlib", "Alteryx", "SAS", "PostgreSQL", "MySQL", "MongoDB",
];

const SAMPLE_CANDIDATES = [
  {
    name: "Jane Doe",
    skills: ["Power BI", "SQL", "Python", "DAX", "Azure", "Excel", "Tableau", "Pandas"],
    experience_years: 5,
    education: "M.S. Data Analytics, State University",
    location: "Atlanta, GA",
    email: "jane.doe@email.com",
    salary: "$95,000/yr",
    lexical_score: 85.2,
    semantic_score: 91.4,
    final_score: 88.3,
    filename: "Jane_Doe_Resume.pdf",
    rank: 1,
  },
  {
    name: "John Smith",
    skills: ["SQL", "Python", "Excel", "Tableau", "R", "Pandas", "NumPy"],
    experience_years: 3,
    education: "B.S. Computer Science, State University",
    location: "Orlando, FL",
    email: "john.smith@email.com",
    salary: "$78,000/yr",
    lexical_score: 62.8,
    semantic_score: 74.1,
    final_score: 68.5,
    filename: "John_Smith_Resume.pdf",
    rank: 2,
  },
];

const DEFAULT_JD = `We are hiring a Data Analyst to join our growing analytics team.

Key requirements:
- Power BI for dashboard creation and reporting
- SQL for data querying and transformation
- Python for data analysis and automation
- Excel for data manipulation
- DAX for Power BI calculations
- Azure for cloud data services

Responsibilities:
- Build and maintain Power BI dashboards for business units
- Write complex SQL queries to extract and transform data
- Automate recurring reports using Python scripts
- Present insights to business stakeholders

Requirements:
- 3+ years of data analysis experience
- Proficiency in Power BI (required)
- Strong SQL skills`;

export default function App() {
  const [jdText, setJdText] = useState(DEFAULT_JD);
  const [jdSkills, setJdSkills] = useState(["Power BI", "SQL", "Python", "Excel", "DAX", "Azure"]);
  const [newSkill, setNewSkill] = useState("");
  const [sliderValue, setSliderValue] = useState(50);
  const [candidates, setCandidates] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showSamples, setShowSamples] = useState(true);
  const [backendStatus, setBackendStatus] = useState("checking"); // "checking" | "online" | "waking" | "offline"
  const [deleteTarget, setDeleteTarget] = useState(null); // candidate to confirm-delete
  const fileInputRef = useRef();
  const mainAppRef = useRef();

  // Ping backend on mount to detect sleep / offline
  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(5000) });
        if (!cancelled) setBackendStatus(res.ok ? "online" : "offline");
      } catch {
        if (cancelled) return;
        // First ping failed → backend likely sleeping; show banner and retry
        setBackendStatus("waking");
        try {
          await new Promise(r => setTimeout(r, 10000)); // wait 10 s for Railway to wake
          if (cancelled) return;
          const res2 = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(8000) });
          if (!cancelled) setBackendStatus(res2.ok ? "online" : "offline");
        } catch {
          if (!cancelled) setBackendStatus("offline");
        }
      }
    }
    ping();
    return () => { cancelled = true; };
  }, []);

  const lexicalWeight = parseFloat(((100 - sliderValue) / 100).toFixed(2));
  const semanticWeight = parseFloat((sliderValue / 100).toFixed(2));

  const rankedCandidates = useMemo(() => {
    if (!candidates.length) return [];
    return [...candidates]
      .map(c => ({
        ...c,
        final_score: parseFloat((c.lexical_score * lexicalWeight + c.semantic_score * semanticWeight).toFixed(1)),
      }))
      .sort((a, b) => b.final_score - a.final_score)
      .map((c, i) => ({ ...c, rank: i + 1 }));
  }, [candidates, lexicalWeight, semanticWeight]);

  const modeLabel = sliderValue <= 20 ? "Exact match only"
    : sliderValue <= 40 ? "Mostly keyword-based"
      : sliderValue <= 60 ? "Balanced matching"
        : sliderValue <= 80 ? "Meaning-aware"
          : "Broad semantic match";

  function extractSkillsFromJD() {
    const text = jdText.toLowerCase();
    const found = COMMON_SKILLS.filter(s => text.includes(s.toLowerCase()));
    setJdSkills(found.length ? found : ["SQL", "Python", "Excel"]);
  }

  function addSkill() {
    const v = newSkill.trim();
    if (v && !jdSkills.includes(v)) {
      setJdSkills(prev => [...prev, v]);
      setNewSkill("");
    }
  }

  function removeSkill(skill) {
    setJdSkills(prev => prev.filter(s => s !== skill));
  }

  function scrollToApp() {
    mainAppRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function deleteCandidate(candidate) {
    setCandidates(prev => prev.filter(c => c.filename !== candidate.filename));
    setUploadedFiles(prev => prev.filter(f => f !== candidate.filename));
    if (selected?.filename === candidate.filename) setSelected(null);
    setDeleteTarget(null);
  }

  async function processFiles(files) {
    const allowed = 10 - uploadedFiles.length;
    const toUpload = files.slice(0, allowed);
    if (!toUpload.length) return;
    setLoading(true);
    setStatus("Uploading and parsing resumes...");
    if (backendStatus !== "online") setStatus("⏳ Waking up backend, this may take ~15 seconds…");
    try {
      const formData = new FormData();
      toUpload.forEach(f => formData.append("files", f));
      const parseRes = await fetchWithRetry(`${BACKEND_URL}/api/parse-resumes`, { method: "POST", body: formData });
      if (!parseRes.ok) throw new Error("Parse failed");
      const parseData = await parseRes.json();
      const parsed = parseData.candidates;
      setUploadedFiles(prev => [...prev, ...toUpload.map(f => f.name)]);
      setStatus("Scoring candidates...");
      const matchRes = await fetchWithRetry(`${BACKEND_URL}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jdText,
          candidates: [...candidates, ...parsed],
          jd_skills: jdSkills,
          lexical_weight: lexicalWeight,
          semantic_weight: semanticWeight,
        }),
      });
      if (!matchRes.ok) throw new Error("Match failed");
      const matchData = await matchRes.json();
      setCandidates(matchData.ranked_candidates);
      setBackendStatus("online");
      setShowSamples(false);
      setStatus(`✓ ${matchData.ranked_candidates.length} candidates ranked`);
    } catch (err) {
      setStatus("⚠ Backend offline. Check Railway deployment.");
      setBackendStatus("offline");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e) {
    await processFiles(Array.from(e.target.files));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.match(/\.(pdf|doc|docx)$/i)
    );
    processFiles(files);
  }

  async function reScore() {
    if (!candidates.length) return;
    setLoading(true);
    setStatus("Re-scoring...");
    try {
      const res = await fetchWithRetry(`${BACKEND_URL}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_description: jdText,
          candidates,
          jd_skills: jdSkills,
          lexical_weight: lexicalWeight,
          semantic_weight: semanticWeight,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCandidates(data.ranked_candidates);
      setStatus("✓ Re-scored");
    } catch {
      setStatus("⚠ Could not reach backend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      {/* Backend waking-up banner */}
      {backendStatus === "waking" && (
        <div className="backend-banner">
          <div className="spinner" style={{ borderColor: "rgba(255,200,0,0.3)", borderTopColor: "#FFD700", width: 14, height: 14 }} />
          <span>⏳ Backend is waking up on Railway (cold start ~15 s)…</span>
        </div>
      )}
      {backendStatus === "offline" && (
        <div className="backend-banner backend-banner--error">
          <span>⚠ Backend appears offline. Check your <a href="https://railway.app" target="_blank" rel="noreferrer">Railway deployment</a>.</span>
        </div>
      )}

      {/* Navbar (Fixed) */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="logo">ResumeMatch</span>
          <span className="badge">Beta</span>
        </div>
        <div className="navbar-status">
          {loading ? (
            <><div className="spinner" /><span>Processing…</span></>
          ) : status ? (
            <><div className="status-dot" /><span>{status}</span></>
          ) : backendStatus === "online" ? (
            <><div className="status-dot" style={{ background: "#10B981" }} /><span>Backend online</span></>
          ) : backendStatus === "checking" ? (
            <span style={{ opacity: 0.5 }}>Connecting…</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </nav>

      {/* Hero / Intro section on top */}
      <section className="hero">
        <div className="hero-eyebrow">✦ AI-Powered Resume Screening</div>
        <h1>Find Your Best Candidates,<br />Instantly</h1>
        <p className="hero-sub">
          Match resumes against your job description using keyword and semantic AI analysis.
          Ranked results in seconds.
        </p>
        <button className="hero-cta" onClick={scrollToApp}>
          Try the App <span>↓</span>
        </button>
      </section>

      {/* Main Dashboard Layout (fills viewport once scrolled down) */}
      <main className="main-layout" ref={mainAppRef}>

        {/* Left Panel - Configuration & Upload */}
        <aside className="left-panel">

          <div className="panel-header">
            <h2 className="panel-title">Configuration</h2>
            <p className="panel-sub">Set job criteria and upload resumes</p>
          </div>

          {/* Slider */}
          <div className="config-block">
            <div className="block-header">
              <span className="block-title">🎯 Match Mode</span>
              <span className="slider-mode-badge">{modeLabel}</span>
            </div>
            <div className="slider-track-wrapper">
              <input
                type="range" min="0" max="100" step="1"
                value={sliderValue}
                style={{ "--val": sliderValue }}
                onChange={e => setSliderValue(Number(e.target.value))}
                className="slider"
                aria-label="Lexical to Semantic balance"
              />
              <div className="slider-labels">
                <span>← Exact Skills (Lexical)</span>
                <span>Similar Skills (Semantic) →</span>
              </div>
            </div>
          </div>

          {/* JD Input */}
          <div className="config-block">
            <div className="block-header">
              <span className="block-title">📋 Job Description</span>
            </div>
            <textarea
              className="jd-textarea"
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="Paste your job description here…"
              aria-label="Job description"
            />
          </div>

          {/* Skills Input */}
          <div className="config-block">
            <div className="block-header">
              <span className="block-title">🏷 Key Skills</span>
              <button onClick={extractSkillsFromJD} className="btn-sm btn-outline">Extract ✨</button>
            </div>
            <div className="skills-chips">
              {jdSkills.map(skill => (
                <span key={skill} className="skill-chip">
                  {skill}
                  <button onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>×</button>
                </span>
              ))}
            </div>
            <div className="skill-add-row">
              <input
                type="text" placeholder="Add a skill…"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSkill()}
                className="skill-input"
                aria-label="Add skill"
              />
              <button onClick={addSkill} className="btn-sm btn-primary">Add</button>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="config-block" style={{ marginTop: 'auto', marginBottom: '10px' }}>
            <div className="block-header">
              <span className="block-title">📤 Upload Candidates</span>
            </div>
            <div
              className={`upload-dropzone${dragOver ? " drag-over" : ""}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              role="button" tabIndex="0"
              onKeyDown={e => e.key === "Enter" && fileInputRef.current.click()}
            >
              <span className="upload-icon">📄</span>
              <h3>Drop resumes here</h3>
              <p>PDF or Word files</p>

              <button
                className="analyze-btn"
                onClick={e => { e.stopPropagation(); fileInputRef.current.click(); }}
                disabled={loading}
              >
                {loading ? <><div className="spinner" style={{ borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#fff" }} />Analyzing…</> : <>✦ Browse & Analyze</>}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file" multiple accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />

            {uploadedFiles.length > 0 && (
              <div className="file-list">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="file-pill">
                    {f.length > 20 ? f.slice(0, 18) + "…" : f}
                  </span>
                ))}
              </div>
            )}
          </div>

        </aside>

        {/* Right Panel - Results */}
        <section className="right-panel">

          <div className="results-header">
            <div>
              <h2 className="results-title">Ranked Candidates</h2>
              <p className="results-sub">
                {rankedCandidates.length > 0
                  ? `Showing ${rankedCandidates.length} parsed resumes`
                  : "Upload resumes on the left to see matches"}
              </p>
            </div>
            {candidates.length > 0 && (
              <button className="btn-sm btn-outline" onClick={reScore} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {loading ? <div className="spinner" /> : "↻ Re-score"}
              </button>
            )}
          </div>

          {rankedCandidates.length === 0 ? (
            <div className="empty-state-wrapper">
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>No candidates yet. Configure your criteria on the left and upload resumes to get started.</p>
              </div>

              {/* Sample Resumes Preview */}
              <div className="sample-section">
                {/* Collapsed bar shown when dismissed */}
                {!showSamples ? (
                  <button
                    className="sample-collapsed-bar"
                    onClick={() => setShowSamples(true)}
                    aria-label="Expand sample results"
                  >
                    <span className="sample-badge" style={{ marginBottom: 0 }}>👀 PREVIEW</span>
                    <span className="sample-collapsed-label">Sample Results</span>
                    <span className="sample-collapsed-hint">Click to expand</span>
                    <span className="sample-chevron">▼</span>
                  </button>
                ) : (
                  <>
                    <div className="sample-header">
                      <div className="sample-badge">👀 PREVIEW</div>
                      <h3 className="sample-title">Sample Results</h3>
                      <p className="sample-sub">
                        Here's what your results will look like after uploading resumes.
                        Click a card to see the detailed breakdown.
                      </p>
                      <button className="btn-sm btn-outline sample-dismiss" onClick={() => setShowSamples(false)}>
                        ▲ Collapse
                      </button>
                    </div>
                    <div className="candidates-grid">
                      {SAMPLE_CANDIDATES.map((c, i) => (
                        <CandidateCard
                          key={c.filename || i}
                          candidate={c}
                          rank={i + 1}
                          jdSkills={jdSkills}
                          onClick={() => setSelected(c)}
                          isSample={true}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="candidates-grid">
              {rankedCandidates.map((c, i) => (
                <CandidateCard
                  key={c.filename || i}
                  candidate={c}
                  rank={i + 1}
                  jdSkills={jdSkills}
                  onClick={() => setSelected(c)}
                  onDelete={() => setDeleteTarget(c)}
                />
              ))}
            </div>
          )}

          {/* Slide-over Detail Panel */}
          {selected && (
            <CandidateDetail
              candidate={selected}
              jdSkills={jdSkills}
              sliderValue={sliderValue}
              lexicalWeight={lexicalWeight}
              semanticWeight={semanticWeight}
              onClose={() => setSelected(null)}
            />
          )}

        </section>
      </main>

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          candidate={deleteTarget}
          onConfirm={() => deleteCandidate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function scoreColor(score) {
  if (score >= 75) return "score-green";
  if (score >= 50) return "score-yellow";
  return "score-red";
}

function CandidateCard({ candidate: c, rank, jdSkills, onClick, onDelete, isSample }) {
  const jdLower = jdSkills.map(s => s.toLowerCase());
  const matched = c.skills?.filter(s => jdLower.includes(s.toLowerCase())) || [];
  const missing = jdSkills.filter(s => !(c.skills || []).map(x => x.toLowerCase()).includes(s.toLowerCase()));

  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div
      className={`candidate-card${isSample ? " sample-card" : ""}`}
      onClick={onClick}
      role="button" tabIndex="0"
      onKeyDown={e => e.key === "Enter" && onClick()}
    >
      {isSample && <div className="sample-ribbon">Sample</div>}
      {!isSample && onDelete && (
        <button
          className="card-delete-btn"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${c.name}`}
          title="Remove candidate"
        >×</button>
      )}
      <div className="card-top">
        <div className="card-left">
          <div className="avatar">{c.name.split(" ").map(n => n[0]).join("")}</div>
          <div>
            <p className="candidate-name">{rankEmoji ? `${rankEmoji} ` : `#${rank} `}{c.name}</p>
            <p className="candidate-sub">{c.location || "Location unknown"}</p>
          </div>
        </div>
        <div className="score-ring-wrap">
          <div className={`final-score ${scoreColor(c.final_score)}`}>{c.final_score}%</div>
          <div className="rank-label">match</div>
        </div>
      </div>

      <div className="score-bars">
        <ScoreBar label="Keyword" score={c.lexical_score} color="#5B6AF0" />
        <ScoreBar label="Semantic" score={c.semantic_score} color="#10B981" />
      </div>

      <div className="card-footer">
        <div className="skill-tags">
          {(c.skills || []).slice(0, 3).map(s => (
            <span key={s} className={`tag ${jdLower.includes(s.toLowerCase()) ? "tag-match" : "tag-miss"}`}>{s}</span>
          ))}
          {(c.skills || []).length > 3 && <span className="tag-more">+{c.skills.length - 3}</span>}
        </div>
        <div className="match-summary">
          <span className="match-ok">✓ {matched.length}</span>
          <span className="match-gap">✗ {missing.length}</span>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-bg">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="score-bar-value">{score}%</span>
    </div>
  );
}

function CandidateDetail({ candidate: c, jdSkills, sliderValue, lexicalWeight, semanticWeight, onClose }) {
  const jdLower = jdSkills.map(s => s.toLowerCase());
  const matched = (c.skills || []).filter(s => jdLower.includes(s.toLowerCase()));
  const missing = jdSkills.filter(s => !(c.skills || []).map(x => x.toLowerCase()).includes(s.toLowerCase()));
  const bonus = (c.skills || []).filter(s => !jdLower.includes(s.toLowerCase()));
  const final = c.final_score || parseFloat((c.lexical_score * lexicalWeight + c.semantic_score * semanticWeight).toFixed(1));

  return (
    <div className="detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="detail-panel">

        <div className="detail-header">
          <div className="card-left">
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{c.name.split(" ").map(n => n[0]).join("")}</div>
            <div>
              <p className="candidate-name" style={{ fontSize: 15 }}>{c.name}</p>
              <p className="candidate-sub">{c.location || "Location unknown"}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="detail-content">

          <div className="detail-section">
            <div className="section-title-sm">📊 Match Score Breakdown</div>
            <div>
              <ScoreBar label="Keyword" score={c.lexical_score} color="#5B6AF0" />
              <div style={{ height: 6 }} />
              <ScoreBar label="Semantic" score={c.semantic_score} color="#10B981" />

              <div className="formula-row">
                ({c.lexical_score} × {Math.round((1 - sliderValue / 100) * 100)}%) +&nbsp;
                ({c.semantic_score} × {Math.round(sliderValue)}%) = <strong>{final}% final</strong>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-num" style={{ color: "#5B6AF0" }}>{matched.length}</span>
                  <span className="stat-lbl">matched</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num" style={{ color: "#EF4444" }}>{missing.length}</span>
                  <span className="stat-lbl">missing</span>
                </div>
                <div className="stat-box">
                  <span className="stat-num" style={{ color: "#10B981" }}>{bonus.length}</span>
                  <span className="stat-lbl">bonus</span>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-title-sm">🏷 Skill Analysis</div>
            <div className="skills-row">
              <div>
                <p className="skills-group-label" style={{ color: "var(--primary)" }}>✓ Matched</p>
                <div className="skill-tags">
                  {matched.length ? matched.map(s => <span key={s} className="tag tag-match">{s}</span>) : <span className="tag tag-miss">None</span>}
                </div>
              </div>
              <div>
                <p className="skills-group-label" style={{ color: "var(--danger)" }}>✗ Missing</p>
                <div className="skill-tags">
                  {missing.length ? missing.map(s => <span key={s} className="tag tag-gap">{s}</span>) : <span className="tag-ok">All present ✓</span>}
                </div>
              </div>
            </div>
            {bonus.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="skills-group-label">＋ Bonus skills</p>
                <div className="skill-tags">
                  {bonus.map(s => <span key={s} className="tag tag-miss">{s}</span>)}
                </div>
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-title-sm">👤 Candidate Info</div>
            <div className="info-grid">
              {[
                ["Experience", c.experience_years ? `${c.experience_years} yrs` : "—"],
                ["Salary", c.salary || "—"],
                ["Education", c.education || "—"],
                ["Email", c.email || "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="info-label">{l}</p>
                  <p className="info-value">{v}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ candidate, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-icon">🗑️</div>
        <h3 className="modal-title" id="modal-title">Remove Candidate?</h3>
        <p className="modal-body">
          The resume for <strong>{candidate.name}</strong>
          {candidate.filename ? ` (${candidate.filename})` : ""} that has been analyzed will be deleted.
        </p>
        <div className="modal-actions">
          <button className="btn-sm btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-sm modal-confirm-btn" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

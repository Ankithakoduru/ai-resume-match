import { useState, useMemo, useRef } from "react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const COMMON_SKILLS = [
  "Power BI","SQL","Python","Excel","DAX","Azure","Tableau","R","dbt",
  "Snowflake","Looker","Spark","Airflow","Pandas","NumPy","Java","Scala",
  "AWS","GCP","Qlik","SAP","Scikit-learn","TensorFlow","Jupyter",
  "Matplotlib","Alteryx","SAS","PostgreSQL","MySQL","MongoDB",
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
  const fileInputRef = useRef();

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

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    const allowed = 10 - uploadedFiles.length;
    const toUpload = files.slice(0, allowed);
    if (!toUpload.length) return;

    setLoading(true);
    setStatus("Uploading and parsing resumes...");

    try {
      const formData = new FormData();
      toUpload.forEach(f => formData.append("files", f));

      const parseRes = await fetch(`${BACKEND_URL}/api/parse-resumes`, {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) throw new Error("Parse failed");
      const parseData = await parseRes.json();
      const parsed = parseData.candidates;

      setUploadedFiles(prev => [...prev, ...toUpload.map(f => f.name)]);
      setStatus("Scoring candidates...");

      const matchRes = await fetch(`${BACKEND_URL}/api/match`, {
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
      setStatus(`✓ ${matchData.ranked_candidates.length} candidates ranked`);
    } catch (err) {
      setStatus("⚠ Backend not connected. Running in demo mode.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function reScore() {
    if (!candidates.length) return;
    setLoading(true);
    setStatus("Re-scoring with updated settings...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/match`, {
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
      if (!res.ok) throw new Error("Match failed");
      const data = await res.json();
      setCandidates(data.ranked_candidates);
      setStatus("✓ Re-scored");
    } catch (err) {
      setStatus("⚠ Could not reach backend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="logo">ResumeMatch</span>
          <span className="badge">Beta</span>
        </div>
        <span className="header-status">{loading ? "⟳ Processing..." : status || `${rankedCandidates.length} candidates`}</span>
      </header>

      {/* Slider */}
      <div className="slider-bar">
        <span className="slider-label">Match mode</span>
        <span className="lex-badge">Lexical {100 - sliderValue}%</span>
        <input
          type="range" min="0" max="100" step="1"
          value={sliderValue}
          onChange={e => setSliderValue(Number(e.target.value))}
          className="slider"
          aria-label="Lexical to Semantic balance"
        />
        <span className="sem-badge">Semantic {sliderValue}%</span>
        <span className="mode-label">{modeLabel}</span>
        {candidates.length > 0 && (
          <button className="rescore-btn" onClick={reScore} disabled={loading}>
            Re-score
          </button>
        )}
      </div>

      {/* Main */}
      <main className="main">
        {/* Left Panel */}
        <div className="left-panel">
          <div className="panel-header">
            <span>📋 Job description</span>
            <span className="panel-sub">Editable</span>
          </div>
          <textarea
            className="jd-textarea"
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="Paste your job description here..."
            aria-label="Job description"
          />

          {/* Skills Panel */}
          <div className="skills-panel">
            <div className="skills-header">
              <span>🏷 Key skills <small>(editable)</small></span>
              <button onClick={extractSkillsFromJD} className="extract-btn">Extract from JD</button>
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
                type="text" placeholder="Add a skill..."
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSkill()}
                className="skill-input"
                aria-label="Add skill"
              />
              <button onClick={addSkill} className="add-btn">Add</button>
            </div>
          </div>

          {/* Upload Panel */}
          <div className="upload-panel">
            <div className="upload-header">
              <span>📤 Upload resumes <small>(max 10)</small></span>
              <span className="upload-count">{uploadedFiles.length} / 10</span>
            </div>
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current.click()}
              onKeyDown={e => e.key === "Enter" && fileInputRef.current.click()}
              role="button" tabIndex="0"
              aria-label="Upload resume files"
            >
              <div className="upload-icon">📄</div>
              <p>Click to upload PDF or Word files</p>
            </div>
            <input
              ref={fileInputRef}
              type="file" multiple accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              style={{ display: "none" }}
              aria-label="File input"
            />
            {uploadedFiles.length > 0 && (
              <div className="file-list">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="file-pill">📄 {f.length > 20 ? f.slice(0, 18) + "…" : f}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="panel-header sticky">
            <span>👥 Ranked candidates</span>
            <span className="panel-sub">Sorted by match score</span>
          </div>

          {selected ? (
            <CandidateDetail
              candidate={selected}
              jdSkills={jdSkills}
              sliderValue={sliderValue}
              lexicalWeight={lexicalWeight}
              semanticWeight={semanticWeight}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="candidate-list">
              {rankedCandidates.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 40 }}>📤</div>
                  <p>Upload resumes to get started</p>
                </div>
              ) : (
                rankedCandidates.map((c, i) => (
                  <CandidateCard key={c.filename || i} candidate={c} rank={i + 1} jdSkills={jdSkills} onClick={() => setSelected(c)} />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function CandidateCard({ candidate: c, rank, jdSkills, onClick }) {
  const rankColor = rank === 1 ? "#185FA5" : rank === 2 ? "#3B6D11" : rank === 3 ? "#854F0B" : "#888";
  const jdLower = jdSkills.map(s => s.toLowerCase());
  const matched = c.skills?.filter(s => jdLower.includes(s.toLowerCase())) || [];
  const missing = jdSkills.filter(s => !(c.skills || []).map(x => x.toLowerCase()).includes(s.toLowerCase()));

  return (
    <div className="candidate-card" onClick={onClick} role="button" tabIndex="0" onKeyDown={e => e.key === "Enter" && onClick()}>
      <div className="card-top">
        <div className="card-left">
          <div className="avatar">{c.name.split(" ").map(n => n[0]).join("")}</div>
          <div>
            <p className="candidate-name">{c.name}</p>
            <p className="candidate-sub">{c.location || "Location unknown"}</p>
          </div>
        </div>
        <div className="card-score">
          <div className="final-score" style={{ color: rankColor }}>{c.final_score}%</div>
          <div className="rank-label">#{rank}</div>
        </div>
      </div>
      <div className="score-bars">
        <ScoreBar label="Lexical" score={c.lexical_score} color="#185FA5" />
        <ScoreBar label="Semantic" score={c.semantic_score} color="#1D9E75" />
      </div>
      <div className="card-footer">
        <div className="skill-tags">
          {(c.skills || []).slice(0, 3).map(s => (
            <span key={s} className={jdLower.includes(s.toLowerCase()) ? "tag-match" : "tag-miss"}>{s}</span>
          ))}
          {(c.skills || []).length > 3 && <span className="tag-more">+{c.skills.length - 3}</span>}
        </div>
        <div className="match-summary">
          <span className="match-ok">✓ {matched.length}</span>
          <span className="match-gap">✗ {missing.length} missing</span>
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
    <div className="detail-overlay">
      <div className="detail-card">
        <div className="detail-header">
          <div className="detail-identity">
            <div className="avatar avatar-lg">{c.name.split(" ").map(n => n[0]).join("")}</div>
            <div>
              <p className="candidate-name">{c.name}</p>
              <p className="candidate-sub">{c.location || "Location unknown"}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Score Breakdown */}
        <section className="detail-section">
          <h3 className="section-title">📊 Match score breakdown</h3>
          <div className="breakdown-box">
            <ScoreBar label="Lexical" score={c.lexical_score} color="#185FA5" />
            <ScoreBar label="Semantic" score={c.semantic_score} color="#1D9E75" />
            <div className="formula-row">
              <span className="formula-text">
                ({c.lexical_score} × {Math.round((1 - sliderValue / 100) * 100)}%) + ({c.semantic_score} × {Math.round(sliderValue)}%) = <strong>{final}% final score</strong>
              </span>
            </div>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-num" style={{ color: "#185FA5" }}>{matched.length}</span>
                <span className="stat-lbl">skills matched</span>
              </div>
              <div className="stat-box">
                <span className="stat-num" style={{ color: "#A32D2D" }}>{missing.length}</span>
                <span className="stat-lbl">skills missing</span>
              </div>
              <div className="stat-box">
                <span className="stat-num" style={{ color: "#3B6D11" }}>{bonus.length}</span>
                <span className="stat-lbl">bonus skills</span>
              </div>
            </div>
          </div>
        </section>

        {/* Skills */}
        <section className="detail-section">
          <div className="skills-row">
            <div>
              <p className="skills-group-label match">✓ Matched skills</p>
              {matched.length ? matched.map(s => <span key={s} className="tag-match">{s}</span>) : <span className="tag-none">None</span>}
            </div>
            <div>
              <p className="skills-group-label gap">✗ Missing skills</p>
              {missing.length ? missing.map(s => <span key={s} className="tag-gap">{s}</span>) : <span className="tag-ok">All present ✓</span>}
            </div>
          </div>
          {bonus.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="skills-group-label bonus">+ Bonus skills</p>
              {bonus.map(s => <span key={s} className="tag-miss">{s}</span>)}
            </div>
          )}
        </section>

        {/* Info Grid */}
        <section className="detail-section">
          <div className="info-grid">
            {[
              ["Experience", c.experience_years ? `${c.experience_years} years` : "—"],
              ["Salary", c.salary || "—"],
              ["Education", c.education || "—"],
              ["Email", c.email || "—"],
            ].map(([l, v]) => (
              <div key={l} className="info-item">
                <p className="info-label">{l}</p>
                <p className="info-value">{v}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

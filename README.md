# ResumeMatch 🔍

A resume filtering tool that blends **lexical** (keyword) and **semantic** (meaning-based) matching to help recruiters find the best candidates faster.

> **No API key needed.** Semantic scoring uses `sentence-transformers` running locally — completely free.

---

## Project Structure

```
resumematch/
├── .gitignore
├── README.md
├── backend/                  # Python FastAPI backend
│   ├── main.py               # API routes
│   ├── parser.py             # Resume parsing (PDF + DOCX)
│   ├── scorer.py             # Lexical (TF-IDF) + Semantic (sentence-transformers)
│   ├── models.py             # Pydantic request/response models
│   ├── pyproject.toml        # uv project config + dependencies
│   ├── uv.lock               # Locked dependency graph (commit this)
│   ├── Procfile              # Railway deployment
│   └── .env.example
└── frontend/                 # React frontend
    ├── src/
    │   ├── App.jsx           # Main component
    │   ├── App.css           # Styles
    │   └── index.js
    ├── public/
    │   └── index.html
    ├── package.json
    └── vercel.json           # Vercel deployment config
```

---

## Local Development Setup

### Prerequisites
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — fast Python package manager
- Node.js 18+

### 1. Backend

```bash
cd backend

# Install all dependencies (creates .venv automatically)
uv sync

# Copy env file (no values required — app works without any keys)
cp .env.example .env

# Run the backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# Backend runs at http://localhost:8000
# API docs at  http://localhost:8000/docs
```

> **First run:** `sentence-transformers` downloads the `all-MiniLM-L6-v2` model (~90MB) once and caches it. Subsequent runs are instant.

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the frontend
npm start
# App runs at http://localhost:3000
```

---

## API Endpoints

### `GET /`
Health check.

```json
{"status": "ResumeMatch API is running"}
```

---

### `POST /api/parse-resumes`
Upload resume files (PDF or DOCX). Returns parsed structured data.

**Request:** `multipart/form-data` with `files[]` (max 10)

**Response:**
```json
{
  "candidates": [
    {
      "name": "Jane Smith",
      "skills": ["Python", "SQL", "Power BI"],
      "experience_years": 5,
      "education": "B.S. Computer Science",
      "location": "Tampa, FL",
      "email": "jane@example.com",
      "raw_text": "..."
    }
  ]
}
```

---

### `POST /api/match`
Score and rank candidates against a job description.

**Request:**
```json
{
  "job_description": "We are hiring a Data Analyst...",
  "candidates": [...],
  "jd_skills": ["Power BI", "SQL", "Python"],
  "lexical_weight": 0.5,
  "semantic_weight": 0.5
}
```

**Response:**
```json
{
  "ranked_candidates": [
    {
      "name": "Jane Smith",
      "lexical_score": 82.5,
      "semantic_score": 88.0,
      "final_score": 85.25,
      "rank": 1,
      "matched_skills": ["SQL", "Python"],
      "missing_skills": ["Power BI"],
      "bonus_skills": ["Tableau"],
      "skill_match_percentage": 66.7
    }
  ]
}
```

---

## Deployment

### Backend → Railway

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select your repo, set **Root Directory** to `backend`
4. Railway auto-detects the `Procfile` and deploys
5. Go to **Settings → Networking → Generate Domain** to get your public URL
6. No environment variables required (app works fully without any keys)

> **Note:** First deploy takes 3–5 min — Railway installs PyTorch + sentence-transformers (~500MB). Subsequent deploys are fast.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repo, set **Root Directory** to `frontend`
3. Under **Environment Variables**, add:
   ```
   REACT_APP_BACKEND_URL = https://your-railway-url.up.railway.app
   ```
4. Click **Deploy** — you'll get a URL like `https://resumematch.vercel.app`

### Fix CORS after deployment

In `backend/main.py`, update `allow_origins` with your Vercel URL:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://resumematch.vercel.app",  # your Vercel URL
        "http://localhost:3000",
    ],
    ...
)
```

Commit and push — Railway redeploys automatically.

---

## How Scoring Works

### Lexical Score (TF-IDF)
- Converts both the JD and resume into TF-IDF vectors
- Measures cosine similarity between vectors
- Rewards exact keyword matches
- 100% lexical = only candidates with the exact words score high

### Semantic Score (sentence-transformers)
- Uses `all-MiniLM-L6-v2` model — runs locally, no API key needed
- Converts JD and resume into meaning vectors
- Candidates with equivalent skills (e.g. Tableau vs Power BI) score higher
- 100% semantic = focuses on conceptual similarity

### Final Score
```
Final Score = (Lexical Score × Lexical Weight) + (Semantic Score × Semantic Weight)
```
The slider in the UI controls these weights in real-time.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 |
| Backend | Python · FastAPI |
| Package Manager | uv |
| Resume Parsing | pdfplumber · python-docx |
| Lexical Matching | scikit-learn TF-IDF |
| Semantic Matching | sentence-transformers (`all-MiniLM-L6-v2`) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |

---

## Environment Variables

### Backend (`.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Optional | For future LLM features (e.g. AI-generated summaries) |

### Frontend (Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | ✅ Yes (production) | Your Railway backend URL |

---

## Notes

- Semantic scoring uses a local model — no external API calls at runtime
- Maximum 10 resumes per session (MVP limit)
- Demographic fields (gender, ethnicity) are never used in scoring
- All resume data is processed in-memory and not stored permanently

---

Built as a portfolio project · 2026

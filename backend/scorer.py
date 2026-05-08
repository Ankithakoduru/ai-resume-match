import os
import numpy as np
from typing import List, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# sentence-transformers runs locally — no API key needed, completely free
from sentence_transformers import SentenceTransformer

# Load the model once at startup (downloads ~90MB on first run, then cached)
_embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        print("Loading sentence-transformers model (first run may take a moment)...")
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Model loaded.")
    return _embedding_model


def get_lexical_scores(job_description: str, resume_texts: List[str]) -> List[float]:
    """
    Compute TF-IDF cosine similarity between JD and each resume.
    Returns scores as percentages (0-100).
    """
    if not any(resume_texts):
        return [0.0] * len(resume_texts)

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=5000,
    )
    corpus = [job_description] + resume_texts
    try:
        tfidf_matrix = vectorizer.fit_transform(corpus)
        jd_vector = tfidf_matrix[0]
        resume_vectors = tfidf_matrix[1:]
        similarities = cosine_similarity(jd_vector, resume_vectors)[0]
        return [round(float(s) * 100, 1) for s in similarities]
    except Exception as e:
        print(f"Lexical scoring error: {e}")
        return [0.0] * len(resume_texts)


def get_semantic_scores(job_description: str, resume_texts: List[str]) -> List[float]:
    """
    Compute semantic similarity using sentence-transformers (free, local, no API key).
    Uses all-MiniLM-L6-v2 — fast, lightweight, and great for resume matching.
    Returns scores as percentages (0-100).
    """
    try:
        model = get_embedding_model()

        # Encode JD and all resumes in one batch (efficient)
        all_texts = [job_description[:8000]] + [t[:8000] for t in resume_texts]
        embeddings = model.encode(all_texts, convert_to_numpy=True, show_progress_bar=False)

        jd_embedding = embeddings[0:1]           # shape (1, dim)
        resume_embeddings = embeddings[1:]        # shape (n, dim)

        similarities = cosine_similarity(jd_embedding, resume_embeddings)[0]

        # Cosine similarity for sentence-transformers is typically 0.0–1.0
        # Scale to 0-100 with a mild normalization boost
        scores = []
        for sim in similarities:
            normalized = max(0.0, (float(sim) - 0.1) / 0.9) * 100
            scores.append(round(min(100.0, normalized), 1))
        return scores

    except Exception as e:
        print(f"Semantic scoring error: {e}. Falling back to lexical scores.")
        return get_lexical_scores(job_description, resume_texts)


def cosine_sim(vec1: List[float], vec2: List[float]) -> float:
    a = np.array(vec1)
    b = np.array(vec2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def compute_skill_overlap(jd_skills: List[str], candidate_skills: List[str]) -> dict:
    """
    Compute which skills match, which are missing, and which are bonus.
    """
    jd_lower = [s.lower() for s in jd_skills]
    cand_lower = [s.lower() for s in candidate_skills]

    matched = [s for s in candidate_skills if s.lower() in jd_lower]
    missing = [s for s in jd_skills if s.lower() not in cand_lower]
    bonus = [s for s in candidate_skills if s.lower() not in jd_lower]

    skill_match_pct = (len(matched) / len(jd_skills) * 100) if jd_skills else 0

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "bonus_skills": bonus,
        "skill_match_percentage": round(skill_match_pct, 1),
    }


def compute_scores(
    job_description: str,
    candidates: List[dict],
    jd_skills: List[str],
    lexical_weight: float,
    semantic_weight: float,
) -> List[dict]:
    """
    Main scoring function.
    Returns candidates sorted by final weighted score (descending).
    """
    resume_texts = [c.get("raw_text", "") for c in candidates]

    lexical_scores = get_lexical_scores(job_description, resume_texts)
    semantic_scores = get_semantic_scores(job_description, resume_texts)

    results = []
    for i, candidate in enumerate(candidates):
        lex = lexical_scores[i]
        sem = semantic_scores[i]
        final = round(lex * lexical_weight + sem * semantic_weight, 1)

        skill_analysis = compute_skill_overlap(jd_skills, candidate.get("skills", []))

        results.append({
            **candidate,
            "lexical_score": lex,
            "semantic_score": sem,
            "final_score": final,
            "lexical_weight_used": lexical_weight,
            "semantic_weight_used": semantic_weight,
            **skill_analysis,
        })

    results.sort(key=lambda x: x["final_score"], reverse=True)

    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results

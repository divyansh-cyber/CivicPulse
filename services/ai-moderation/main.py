"""
CivicPulse AI Moderation & Insights Service
FastAPI + Groq (llama-3.3-70b) — 3 agents:
  1. Moderator agent  — POST /moderate
  2. Summarizer agent — POST /summarize
  3. Risk scanner     — POST /risk-scan
"""
import os
import json
import re
from datetime import datetime
from typing import Optional, List
from dotenv import load_dotenv

from groq import Groq
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
AI_AVAILABLE = bool(GROQ_API_KEY)

if AI_AVAILABLE:
    groq_client = Groq(api_key=GROQ_API_KEY)
    GROQ_MODEL = "llama-3.3-70b-versatile"   # Free tier, fast, high quality
    print(f"[OK] Groq AI ready - model: {GROQ_MODEL}")
else:
    groq_client = None
    print("[WARN] GROQ_API_KEY not set - AI agents will return neutral defaults")

app = FastAPI(
    title="CivicPulse AI Service",
    description="Moderation, summarization, and escalation-risk agents powered by Groq",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModerateRequest(BaseModel):
    content: str

class ModerateResponse(BaseModel):
    toxic: bool
    offTopic: bool
    score: float          # 0.0–1.0 (higher = more problematic)
    sentiment: float      # -1.0 (negative) to +1.0 (positive)
    reason: Optional[str] = None

class SummarizeRequest(BaseModel):
    transcript: str       # newline-joined message contents

class SummarizeResponse(BaseModel):
    summary: str

class IssueForRisk(BaseModel):
    issueId: str
    title: str
    upVotes: int
    downVotes: int
    commentCount: int
    hoursUntilSLA: float
    currentTier: str

class RiskScanRequest(BaseModel):
    issues: List[IssueForRisk]

class RiskResult(BaseModel):
    issueId: str
    flagged: bool
    reason: Optional[str] = None
    riskScore: float      # 0.0–1.0

class RiskScanResponse(BaseModel):
    results: List[RiskResult]


# ── Core helper ───────────────────────────────────────────────────────────────

def call_groq(system_prompt: str, user_prompt: str, fallback: dict) -> dict:
    """Call Groq with a JSON-output prompt. Returns fallback dict on any error."""
    if not AI_AVAILABLE or not groq_client:
        return fallback
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=512,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"⚠️  Groq call failed: {e}")
        return fallback


# ── Agent 1: Moderator ────────────────────────────────────────────────────────

@app.post("/moderate", response_model=ModerateResponse)
async def moderate_message(req: ModerateRequest):
    """
    Score a message for toxicity, off-topic content, and sentiment.
    Returns score 0.0–1.0 (higher = more problematic).
    """
    system = "You are a civic community moderation AI. Respond ONLY with valid JSON — no markdown, no explanation."
    user = f"""Analyze this message posted in a public civic discussion platform:

\"\"\"{req.content[:2000]}\"\"\"

Return ONLY valid JSON with these exact fields:
{{
  "toxic": <true if abusive, threatening, or hate speech, else false>,
  "offTopic": <true if completely unrelated to civic/community matters, else false>,
  "score": <float 0.0–1.0, where 0.0=perfectly fine, 1.0=must be removed>,
  "sentiment": <float -1.0 (very negative/angry) to +1.0 (very positive/constructive)>,
  "reason": "<one short sentence explaining the score, or null if score < 0.3>"
}}"""

    fallback = {"toxic": False, "offTopic": False, "score": 0.0, "sentiment": 0.0, "reason": None}
    result = call_groq(system, user, fallback)

    return ModerateResponse(
        toxic=bool(result.get("toxic", False)),
        offTopic=bool(result.get("offTopic", False)),
        score=max(0.0, min(1.0, float(result.get("score", 0.0)))),
        sentiment=max(-1.0, min(1.0, float(result.get("sentiment", 0.0)))),
        reason=result.get("reason"),
    )


# ── Agent 2: Summarizer ───────────────────────────────────────────────────────

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_discussion(req: SummarizeRequest):
    """
    Condense a discussion transcript into a 3-sentence digest for officials.
    """
    if not req.transcript.strip():
        return SummarizeResponse(summary="No messages yet in this discussion.")

    system = "You are an AI assistant helping civic officials. Respond ONLY with valid JSON — no markdown, no explanation."
    user = f"""Below is a transcript of messages from a civic discussion thread.

Transcript:
\"\"\"{req.transcript[:8000]}\"\"\"

Write a concise 3-sentence summary covering:
1. The main concern or topic
2. The dominant community sentiment (positive, negative, or mixed)
3. Any actionable requests from residents

Return ONLY valid JSON:
{{"summary": "<your 3-sentence summary here>"}}"""

    fallback = {"summary": "Summary unavailable — AI service returned an unexpected response."}
    result = call_groq(system, user, fallback)
    return SummarizeResponse(summary=result.get("summary", fallback["summary"]))


# ── Agent 3: Escalation-risk scanner ─────────────────────────────────────────

@app.post("/risk-scan", response_model=RiskScanResponse)
async def scan_escalation_risk(req: RiskScanRequest):
    """
    For each open issue nearing its SLA deadline, assess escalation risk.
    Returns a risk score and flag for each issue.
    """
    if not req.issues:
        return RiskScanResponse(results=[])

    issues_json = json.dumps([i.dict() for i in req.issues], indent=2)

    system = "You are a civic platform risk analysis AI. Respond ONLY with valid JSON — no markdown, no explanation."
    user = f"""Analyze these civic issues approaching their SLA deadlines.

For each issue consider:
- hoursUntilSLA: hours until deadline (negative = already breached)
- upVotes: community urgency signal
- commentCount: engagement level
- currentTier: hierarchy level

Issues:
{issues_json}

Rate escalation risk 0.0–1.0. Flag if risk > 0.6.

Return ONLY valid JSON:
{{
  "results": [
    {{
      "issueId": "<id>",
      "flagged": <true/false>,
      "riskScore": <0.0–1.0>,
      "reason": "<brief reason or null>"
    }}
  ]
}}"""

    fallback = {
        "results": [
            {
                "issueId": i.issueId,
                "flagged": i.hoursUntilSLA < 12,
                "riskScore": 0.8 if i.hoursUntilSLA < 0 else (0.6 if i.hoursUntilSLA < 12 else 0.2),
                "reason": "SLA already breached" if i.hoursUntilSLA < 0 else None,
            }
            for i in req.issues
        ]
    }
    result = call_groq(system, user, fallback)

    results = []
    for r in result.get("results", fallback["results"]):
        results.append(RiskResult(
            issueId=str(r.get("issueId", "")),
            flagged=bool(r.get("flagged", False)),
            riskScore=max(0.0, min(1.0, float(r.get("riskScore", 0.0)))),
            reason=r.get("reason"),
        ))

    return RiskScanResponse(results=results)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ai_available": AI_AVAILABLE,
        "provider": "groq" if AI_AVAILABLE else "none",
        "model": GROQ_MODEL if AI_AVAILABLE else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

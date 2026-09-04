# 🛡️ KYRON — Zero-Trust Runtime Security Gateway for Autonomous AI Agents

> **"Your AI makes decisions. Kyron makes sure they're safe."**  
> An ultra-low-latency runtime firewall, SOC forensics console, and authorization gateway protecting tool-calling AI agents from prompt injection, data exfiltration, tool hijacking, and unauthorized system access in **< 2 milliseconds**.

[![CI Workflow](https://github.com/Raphel6969/kyron/actions/workflows/ci.yml/badge.svg)](https://github.com/Raphel6969/kyron/actions/workflows/ci.yml)
[![Tests Passing](https://img.shields.io/badge/Tests-58%2F58%20Passed-emerald.svg)](https://github.com/Raphel6969/kyron)
[![PyPI](https://img.shields.io/badge/PyPI-kyron--security-blue.svg)](https://pypi.org/project/kyron-security/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

---

## ⚡ The Problem: Prompt Injection is Now Remote Code Execution

Autonomous AI agents in 2024 and 2025 are endowed with dangerous real-world agency: executing shell commands, querying production databases, reading emails, initiating Stripe refunds, and writing container configs.

When an agent consumes untrusted external content (emails, uploaded PDFs, web scrapes, user inputs) containing indirect adversarial prompts, **it can be tricked into invoking sensitive tools against the developer’s intent**.

Existing defenses fall into two flawed extremes:
1. **Brittle Regex Heuristics**: Trivially bypassed via leetspeak, multilingual phrasing, base64 encoding, or XML delimiters.
2. **Frontier LLM Wrappers**: Suffer 1,500ms–3,000ms latency overhead and high API cost per screening, completely breaking agent performance.

### The Kyron Solution
Kyron sits as a **zero-trust reverse proxy and gateway** between autonomous agents and their execution environments. It evaluates every prompt, tool name, and argument payload through a **4-Stage Adaptive Cascade** in **under 2 milliseconds**:

```
+---------------------------------------------------------------------------------------------------------+
|                                    KYRON 4-STAGE RUNTIME FIREWALL                                       |
|                                                                                                         |
|   Incoming Context        Stage 0: RBAC Token Check (<0.01ms)  ──► Blocked if role lacks tool permission|
|   + Proposed Tool Call ──► Stage 1: Deterministic Rule Engine (<0.1ms)  ──► Heuristic signature block   |
|                            Stage 2: TurboQuant ML Vector Classifier (<1.5ms) ──► 211 injection vectors  |
|                                     │                                                                   |
|                                     ▼ (Selective Escalation if 0.40 <= risk <= 0.65)                    |
|                            Stage 3: Groq LLM Judge (LLaMA 3.1 8B ~150ms)                                |
|                                     │                                                                   |
|                            Policy Engine Gate (policy.yaml hard enforcement)                            |
|                                     │                                                                   |
|                                     ▼                                                                   |
|                            [ALLOW | BLOCK | REQUIRE_APPROVAL]                                           |
+---------------------------------------------------------------------------------------------------------+
```

---

## 🌟 Key Capabilities & v2 Suite

### 1. ⚡ 4-Stage Adaptive Detection Cascade
- **Stage 0 — Token-Level RBAC (<0.01ms)**: JWT session tokens enforce role boundaries (`guest`, `intern`, `developer`, `tech_lead`, `admin`). If an intern's agent invokes `write_file` or `bash_execute`, Kyron blocks it at Stage 0 with **zero LLM cost**.
- **Stage 1 — Heuristic Rule Engine (<0.1ms)**: High-speed pattern matcher intercepting known jailbreaks, delimiters, and leak attempts.
- **Stage 2 — TurboQuant ML Vector Classifier (<1.5ms)**: `all-MiniLM-L6-v2` embedding engine with an **LRU Cache (512 slots)** and a vector index seeded with **211 adversarial injection signatures** across 14 OWASP attack categories.
- **Stage 3 — Selective LLM Judge (~150ms)**: Powered by Groq's high-throughput LLaMA 3.1 8B. Triggered only when Stage 1 and Stage 2 scores fall into the ambiguous grey zone ($0.40 \le \text{Risk} \le 0.65$), minimizing cloud latency and API cost.
- **Policy Engine Gate**: Declarative `policy.yaml` with wildcard path matching (`allowed_paths`), domain whitelists (`allowed_domains`), and per-session rate limits with absolute veto power.

### 2. 🎮 Interactive SOC Control Room & Telemetry
- **Attack Vector Simulator**: Test 1-click realistic multi-stage injection scenarios.
- **Custom Threat Playbook Builder**: Arbitrary sandbox allowing judges and testers to compose custom prompts, choose target tools, and observe cascade interception live.
- **Human-in-the-Loop Approval Queue**: Dedicated review inbox for events marked `REQUIRE_APPROVAL` with human **Approve** / **Deny** arbitration.
- **Agent Registry & Risk Leaderboard**: Sortable directory ranking agent identities by block rate, call frequency, and average risk score.
- **Forensics Slide-Out Drawer**: Per-event deep dive showing raw tool arguments, token identity, Stage 1/2/3 scores, and LLM Judge reasoning.
- **Visual Analytics**: Recharts Verdict Donut Chart, Top Attack Categories horizontal bar chart, and weekly 7×4 Threat Velocity Heatmap.
- **Executive Security Audit Report (.html)**: Instant downloadable standalone report ready for SOC compliance reviews.
- **Live Threat Feed Ticker**: Real-time marquee streaming live firewall verdicts via WebSocket / Server-Sent Events (SSE).

### 3. 🐍 Official Python SDK (`kyron-security`)
Developers protect any autonomous agent with just **2 lines of code**:
```bash
pip install kyron-security
```
```python
from kyron import KyronGuard

# Initialize guard with session token
guard = KyronGuard(token="agt_dev_session_token_xyz")

# Wrap sensitive tool execution with runtime protection
result = guard.run(
    tool="call_http",
    arguments={"url": "https://api.external.com/data", "method": "GET"},
    content=untrusted_user_input
)
```
Works seamlessly with **LangChain**, **CrewAI**, **AutoGen**, and native **OpenAI Agents**.

---

## 🏛️ System Architecture

```
                                 +---------------------------------------+
                                 |     REACT 18 / VITE SOC DASHBOARD     |
                                 |  (Double-Bezel Glass & Telemetry Feed)|
                                 +-------------------+-------------------+
                                                     | SSE / WebSocket
                                                     v
+----------------------------------------------------------------------------------------------------+
|                                    FASTAPI RUNTIME GATEWAY                                         |
|                                                                                                    |
|    /screen           /screen/batch        /approvals/pending       /agents/registry      /policy   |
|       │                    │                      │                        │                │      |
|       ▼                    ▼                      ▼                        ▼                ▼      |
|  [Token RBAC] ──► [Rule Engine] ──► [TurboQuant Vector Index] ──► [Groq LLM Judge] ──► [Policy]   |
+----------------------------------------------------------------------------------------------------+
                                                     │
                         +---------------------------+---------------------------+
                         v                                                       v
        +---------------------------------+                     +---------------------------------+
        | HOT STORAGE (SQLite in WAL Mode)|                     | COLD STORAGE (Neon PostgreSQL)  |
        | - Sub-millisecond read/writes   | ──[Async Sync]──►   | - Long-term cloud persistence   |
        | - Real-time SOC dashboard audit |                     | - Enterprise compliance archive |
        +---------------------------------+                     +---------------------------------+
```

---

## 🚦 Quickstart Guide

### Option A: 🐳 Docker Compose (Recommended)

Run the full production stack (FastAPI Backend + React Frontend + Nginx Reverse Proxy + Cached ML Model) in a single command:

```bash
# 1. Clone repository
git clone https://github.com/Raphel6969/kyron.git
cd kyron

# 2. Launch container
docker compose up --build
```

Access the application:
- **SOC Console**: [http://localhost:8080](http://localhost:8080) (or [http://localhost:80](http://localhost:80))
- **Interactive API Docs**: [http://localhost:8080/docs](http://localhost:8080/docs)
- **Health Check**: [http://localhost:8080/health](http://localhost:8080/health)

---

### Option B: 💻 Local Bare-Metal Development

#### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server on port 8000
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend

# Install packages & start Vite dev server
npm install
npm run dev
```

Open your browser to `http://localhost:5173`.

---

## 🛡️ OWASP Top 10 for LLMs Coverage

| OWASP Vulnerability | Threat Description | Kyron Mitigation Mechanism |
| :--- | :--- | :--- |
| **LLM01: Prompt Injection** | Direct & indirect prompt manipulation | 4-Stage Cascade (Regex + 211-signature ML index + LLM Judge) |
| **LLM02: Sensitive Info Leak** | Leaking system prompts, API keys, env vars | Pattern rules + Groq Judge reasoner + Data exfiltration signatures |
| **LLM06: Excessive Agency** | Agent invoking unauthorized or high-risk tools | Stage 0 RBAC + `policy.yaml` tool whitelist + Human Approval Queue |
| **LLM07: System Prompt Leak** | Extracting agent hidden system instructions | Dedicated `prompt_leak` vector category in ML classifier |
| **LLM08: Vector Insecurity** | Rogue embedding tampering / cache pollution | In-memory MD5-keyed LRU cache with strict length bounds |

---

## 🧪 Testing & Verification

Kyron includes a comprehensive automated test suite testing the 4-stage cascade, authentication, Stage 0 RBAC permissions, ML embedding index, Groq LLM Judge fallbacks, and the declarative policy engine:

```bash
# Run 58 backend tests
python -m pytest backend/tests/ -v
```

```bash
# Run frontend TypeScript typecheck & production build
cd frontend && npm run build
```

**Results**:
- Backend: **58 passed in ~33s** (100% pass rate)
- Frontend: **2,798 modules transformed in ~8.8s** with **0 errors**.

---

## 📋 Hackathon Judge Demo Script

Presenting Kyron to judges or stakeholders? Check out our step-by-step interactive presentation guide:
👉 **[PITCH_SCRIPT.md](./PITCH_SCRIPT.md)** (includes 60-second elevator pitch, 3-minute interactive click-by-click demo walkthrough, and judge Q&A defense sheet).

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

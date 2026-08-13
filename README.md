# CivicPulse

> A hyperlocal civic engagement platform that bridges the gap between citizens and local governance.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-civic--sync--web--quxu.vercel.app-6366f1?style=flat-square)](https://civic-sync-web-quxu.vercel.app)
[![API](https://img.shields.io/badge/API-civicsync--api1.onrender.com-22c55e?style=flat-square)](https://civicsync-api1.onrender.com/health)
[![AI Service](https://img.shields.io/badge/AI%20Service-civicsync--ai2.onrender.com-f59e0b?style=flat-square)](https://civicsync-ai2.onrender.com/health)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [User Roles](#user-roles)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Data Models](#data-models)
- [API Reference](#api-reference)
- [AI Agents](#ai-agents)
- [SLA Escalation Engine](#sla-escalation-engine)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Docker Setup](#docker-setup)
- [Cloud Deployment](#cloud-deployment)
- [Seeding the Database](#seeding-the-database)
- [Test Credentials](#test-credentials)

---

## Overview

**CivicPulse** is a full-stack, production-grade civic engagement platform built for Indian cities. It enables citizens to report local issues (potholes, broken streetlights, water shortages, etc.), participate in polls, and engage in community discussions — all scoped to their exact neighborhood.

What sets CivicPulse apart is its **automatic SLA-driven escalation engine**: if a local official does not act on a reported issue within the defined SLA window, the issue automatically escalates up the administrative hierarchy — from locality to colony to municipality to city — ensuring accountability at every level.

All discussions are **actively moderated by an AI** powered by Groq LLaMA, which detects toxic content in real time and flags or hides problematic messages automatically.

---

## Features

| Feature | Description |
|---|---|
| Hyperlocal Scoping | Citizens only see issues and discussions relevant to their locality; officials see their jurisdiction |
| Issue Reporting | Report civic issues with title, description, and tags; upvote/downvote to signal urgency |
| SLA Escalation | Issues that breach their SLA deadline auto-escalate up the location hierarchy |
| Community Polls | Officials and moderators create polls; citizens vote once; live result visualization |
| Real-time Discussions | Live threaded chat per topic, powered by Socket.io WebSockets |
| AI Moderation | Groq LLaMA detects toxic/off-topic messages and flags or hides them in real time |
| AI Discussion Digest | Auto-generated 3-sentence AI summaries of discussion threads for busy officials |
| AI Risk Scanner | Flags issues approaching their SLA deadline with a contextual risk score |
| Analytics Dashboard | Engagement metrics, issue trends, and resolution rates per location |
| Live Notifications | Real-time Socket.io events for issue updates, new messages, and moderation actions |

---

## User Roles

CivicPulse uses a 3-tier role system with scope-based access control:

| Role | Scope | Permissions |
|---|---|---|
| **Citizen** | Own locality | Report issues, vote, post in discussions, vote in polls |
| **Official** | Assigned jurisdiction tier | All citizen actions + update issue status, lock/unlock discussions, create polls |
| **Moderator** | Platform-wide | All official actions + cross-scope access |

**Location Hierarchy (4 tiers):**

```
City (e.g., New Delhi)
  Municipality (e.g., South Delhi Municipal Corporation)
    Colony (e.g., Vasant Kunj Colony)
      Locality (e.g., Vasant Kunj Sector A)  <-- Citizens live here
```

---

## System Architecture

```
+------------------------------------------------------------------+
|                       CLIENT (Browser)                           |
|           Next.js 14 - App Router - Socket.io-client             |
+-----------------------------+--------------------+---------------+
                              | HTTP/REST          | WebSocket
                              v                    v
+------------------------------------------------------------------+
|              BACKEND API (Node.js / Express) - Port 4000         |
|   /auth   /issues   /polls   /discussions   /locations           |
|   /dashboard   Socket.io                                         |
+--------+-----------------------------------------+--------------+
         |                                         |
         v                                         v
+-------------------+   +-----------------+  +--------------------+
| MongoDB Atlas     |   | Upstash Redis   |  | AI Service         |
| (Primary DB)      |   | (BullMQ Queue)  |  | FastAPI + Groq     |
+-------------------+   +--------+--------+  | Port 8000          |
                                 |           +--------------------+
                                 v
                        +-----------------+
                        | Background      |
                        | Workers         |
                        | - escalation    |
                        | - analytics     |
                        | - uptime        |
                        +-----------------+
```

---

## Tech Stack

### Frontend - apps/web

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14 (App Router) | React framework, SSR, routing |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Utility-first styling |
| Socket.io Client | 4 | Real-time WebSocket events |
| Lucide React | latest | Icon library |
| date-fns | 3 | Date formatting |

### Backend API - apps/api

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express | 4 | HTTP server and routing |
| Socket.io | 4 | WebSocket server |
| Mongoose | 8 | MongoDB ODM |
| BullMQ | 5 | Redis-backed job queue |
| bcryptjs | 2 | Password hashing |
| jsonwebtoken | 9 | JWT authentication |
| axios | 1 | HTTP client (calls AI service) |
| dotenv | 16 | Environment configuration |

### AI Moderation Service - services/ai-moderation

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | 0.111 | HTTP server |
| Uvicorn | 0.30 | ASGI server |
| Groq SDK | >=0.9 | LLaMA-3.3-70B inference |
| Pydantic | 2.8 | Request/response schemas |

### Background Workers - workers/

| Worker | Technology | Purpose |
|---|---|---|
| escalation-worker | Node.js + BullMQ | Processes SLA check jobs; escalates overdue issues |
| analytics-worker | Node.js | Computes engagement metrics per location |
| uptime-checker | Node.js | Pings API health endpoint and logs status |

### Infrastructure and Cloud

| Service | Provider | Usage |
|---|---|---|
| Database | MongoDB Atlas | Primary data store |
| Cache / Queue | Upstash Redis | BullMQ job queue (TLS) |
| Frontend Hosting | Vercel | Next.js deployment, CI/CD |
| Backend Hosting | Render (Node) | Express + Socket.io API |
| AI Hosting | Render (Python) | FastAPI moderation service |
| AI Inference | Groq Cloud | LLaMA-3.3-70B-Versatile (free tier) |

---

## Data Models

### User

```
_id, name, email, passwordHash
role: citizen | official | moderator
locationId, scopeTier, elevatedSpaceIds[]
timestamps
```

### Location (4-tier hierarchy)

```
_id, name
tier: city | municipality | colony | locality
parentId, ancestors[]
timestamps
```

### Issue

```
_id, title, description, createdBy
originLocationId, currentLocationId
status: open | under_review | approved | implemented | closed
votes { up, down }, voters[]
slaDeadline, slaJobId
escalationHistory [{ fromLocationId, toLocationId, atTier, movedAt, reason }]
aiRiskFlag { flagged, reason, checkedAt }
tags[], timestamps
```

### Discussion and Message

```
Discussion: _id, title, locationId, createdBy, isLocked, aiSummary, timestamps

Message: _id, discussionId, authorId, content
moderationStatus: visible | under_review | hidden
aiFlag { toxic, offTopic, score, sentiment, checkedAt }
timestamps
```

### Poll and PollVote

```
Poll: _id, title, options[], locationId, createdBy, closesAt, timestamps
PollVote: _id, pollId, userId, optionIndex, timestamps
```

### EngagementMetrics

```
_id, locationId, date
issuesCreated, issuesResolved, pollsCreated, totalVotes, discussionMessages
timestamps
```

---

## API Reference

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | Register a new citizen account |
| POST | /auth/login | Login, returns JWT token |
| GET | /auth/me | Get current user profile |

### Locations (Public)

| Method | Path | Description |
|---|---|---|
| GET | /locations | List all locations |
| GET | /locations/tree | Full hierarchy tree |
| GET | /locations/:id | Single location + children |

### Issues (Auth required)

| Method | Path | Description |
|---|---|---|
| GET | /issues | List issues scoped to user's tier |
| GET | /issues/:id | Single issue with escalation history |
| POST | /issues | Create new issue |
| POST | /issues/:id/vote | Upvote or downvote |
| PATCH | /issues/:id/status | Update status (officials only) |

### Polls (Auth required)

| Method | Path | Description |
|---|---|---|
| GET | /polls | List polls in scope |
| POST | /polls | Create a poll (officials only) |
| POST | /polls/:id/vote | Cast a vote |
| GET | /polls/:id/results | Poll results with counts |

### Discussions (Auth required)

| Method | Path | Description |
|---|---|---|
| GET | /discussions | List discussions in scope |
| GET | /discussions/:id | Discussion + messages |
| POST | /discussions | Create discussion |
| POST | /discussions/:id/messages | Post a message (triggers AI moderation) |
| PATCH | /discussions/:id/lock | Lock/unlock thread (officials only) |
| POST | /discussions/:id/summarize | Generate AI digest (officials only) |

### Dashboard (Auth required)

| Method | Path | Description |
|---|---|---|
| GET | /dashboard | Engagement metrics for user scope |

### AI Service (Port 8000)

| Method | Path | Description |
|---|---|---|
| POST | /moderate | Score a message for toxicity and sentiment |
| POST | /summarize | Summarize a discussion transcript |
| POST | /risk-scan | Assess escalation risk for a batch of issues |
| GET | /health | Health check with AI availability status |

---

## AI Agents

CivicPulse includes three Groq-powered AI agents in `services/ai-moderation/main.py`:

### Agent 1 - Moderator (POST /moderate)

Analyzes each new message posted to a discussion:
- `toxic` — true if hate speech, threats, or abuse
- `offTopic` — true if unrelated to civic matters
- `score` — 0.0 to 1.0 (>=0.7 = under_review, >=0.9 = auto-hidden)
- `sentiment` — -1.0 (angry/negative) to +1.0 (constructive/positive)

**Real-time flow:** Message posted -> API calls AI service -> DB updated -> Socket.io broadcasts `message_moderated` -> Red shield badge appears on toxic messages.

### Agent 2 - Summarizer (POST /summarize)

Condenses a discussion transcript into a 3-sentence digest covering:
1. The main concern or topic
2. Community sentiment (positive, negative, or mixed)
3. Actionable requests from residents

### Agent 3 - Risk Scanner (POST /risk-scan)

Analyzes open issues approaching SLA deadlines and returns a risk score (0.0-1.0) based on:
- Hours until SLA breach
- Community upvotes and engagement
- Current escalation tier

---

## SLA Escalation Engine

Issues that are not actioned within the SLA window automatically escalate up the location hierarchy:

| Tier | Default SLA | Environment Variable |
|---|---|---|
| Locality | 48 hours | SLA_HOURS_LOCALITY |
| Colony | 72 hours | SLA_HOURS_COLONY |
| Municipality | 120 hours | SLA_HOURS_MUNICIPALITY |
| City | 168 hours | SLA_HOURS_CITY |

**How it works:**
1. Issue created at locality level -> SLA deadline set -> BullMQ job scheduled
2. BullMQ `check-sla` job fires at deadline
3. If issue is still `open` -> escalation-worker escalates to parent location
4. New SLA set for parent tier -> new job scheduled
5. Socket.io notifies all clients in the new room
6. Escalation logged in `issue.escalationHistory`

**Fallback:** If Redis is unavailable, in-memory `setTimeout` handles SLA jobs automatically with no service interruption.

---

## Project Structure

```
civicpulse/
|-- apps/
|   |-- api/                    # Express + Socket.io backend
|   |   `-- src/
|   |       |-- server.js       # App entry point, Socket.io setup
|   |       |-- db.js           # MongoDB connection
|   |       |-- seed.js         # Database seeder
|   |       |-- models/         # Mongoose schemas
|   |       |   |-- User.js
|   |       |   |-- Issue.js
|   |       |   |-- Discussion.js
|   |       |   |-- Message.js
|   |       |   |-- Poll.js
|   |       |   |-- PollVote.js
|   |       |   |-- Location.js
|   |       |   `-- EngagementMetrics.js
|   |       |-- routes/         # REST API routes
|   |       |   |-- auth.js
|   |       |   |-- issues.js
|   |       |   |-- polls.js
|   |       |   |-- discussions.js
|   |       |   |-- locations.js
|   |       |   `-- dashboard.js
|   |       |-- middleware/
|   |       |   |-- auth.js     # JWT verification
|   |       |   `-- scope.js    # Role & location scope enforcement
|   |       `-- queues/
|   |           `-- index.js    # BullMQ + in-memory fallback
|   |
|   `-- web/                    # Next.js 14 frontend
|       `-- app/
|           |-- page.tsx        # Landing / home
|           |-- auth/login/
|           |-- auth/register/
|           |-- feed/
|           |-- issues/
|           |-- polls/
|           |-- discussions/
|           |-- dashboard/
|           `-- profile/
|
|-- services/
|   `-- ai-moderation/          # Python FastAPI service
|       |-- main.py             # 3 AI agents
|       |-- requirements.txt
|       `-- .python-version     # Pinned to 3.11.9
|
|-- workers/
|   |-- escalation-worker/      # BullMQ SLA escalation consumer
|   |-- analytics-worker/       # Engagement metric aggregator
|   `-- uptime-checker/         # API health monitor
|
|-- packages/
|   `-- shared-types/           # Shared TypeScript types
|
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker and Docker Compose (recommended) OR local MongoDB + Redis

---

### Option A - Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/divyansh-cyber/CivicSync.git
cd CivicSync

# 2. Copy environment variable templates
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
cp .env.example workers/escalation-worker/.env
cp .env.example workers/analytics-worker/.env

# 3. Set your GROQ_API_KEY in services/ai-moderation/.env
echo "GROQ_API_KEY=your_groq_key_here" > services/ai-moderation/.env

# 4. Start all services
docker compose up --build

# 5. Seed the database (run once in a new terminal)
docker exec -it civicpulse_api node src/seed.js
```

Services will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- AI Service: http://localhost:8000

---

### Option B - Manual (No Docker)

#### Step 1 - Start MongoDB and Redis

```bash
# Option 1: Local installations
mongod --dbpath ./data/db
redis-server

# Option 2: Use MongoDB Atlas + Upstash Redis (cloud, no local install needed)
# Just set MONGODB_URI and REDIS_URL in your .env files
```

#### Step 2 - Backend API

```bash
cd apps/api
npm install

# Fill in your .env values
cp ../../.env.example .env

npm start
# API running on http://localhost:4000
```

#### Step 3 - AI Moderation Service

```bash
cd services/ai-moderation

# Create and activate virtual environment
python -m venv venv

# Linux / Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt

# Add your Groq API key
echo "GROQ_API_KEY=your_groq_key_here" > .env

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# AI Service running on http://localhost:8000
```

Get a free Groq API key at https://console.groq.com

#### Step 4 - Escalation Worker

```bash
cd workers/escalation-worker
npm install

# Create .env
echo "MONGODB_URI=mongodb://localhost:27017/civicpulse" > .env
echo "REDIS_URL=redis://localhost:6379" >> .env
echo "API_BASE_URL=http://localhost:4000" >> .env

node index.js
```

#### Step 5 - Frontend

```bash
cd apps/web
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
echo "NEXT_PUBLIC_SOCKET_URL=http://localhost:4000" >> .env.local

npm run dev
# Frontend running on http://localhost:3000
```

---

## Environment Variables

### apps/api/.env

```env
MONGODB_URI=mongodb://localhost:27017/civicpulse
REDIS_URL=redis://localhost:6379
PORT=4000
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000

# SLA hours per location tier (controls auto-escalation timing)
SLA_HOURS_LOCALITY=48
SLA_HOURS_COLONY=72
SLA_HOURS_MUNICIPALITY=120
SLA_HOURS_CITY=168
```

### apps/web/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### services/ai-moderation/.env

```env
GROQ_API_KEY=your_groq_api_key_here
```

### workers/escalation-worker/.env

```env
MONGODB_URI=mongodb://localhost:27017/civicpulse
REDIS_URL=redis://localhost:6379
API_BASE_URL=http://localhost:4000
SLA_HOURS_LOCALITY=48
SLA_HOURS_COLONY=72
SLA_HOURS_MUNICIPALITY=120
SLA_HOURS_CITY=168
```

---

## Docker Setup

The `docker-compose.yml` orchestrates all 7 services:

| Container | Image | Exposed Port |
|---|---|---|
| civicpulse_mongo | mongo:7 | 27017 |
| civicpulse_redis | redis:7-alpine | 6379 |
| civicpulse_api | Node.js custom | 4000 |
| civicpulse_web | Next.js custom | 3000 |
| civicpulse_ai | Python custom | 8000 |
| civicpulse_escalation | Node.js custom | internal |
| civicpulse_analytics | Node.js custom | internal |

```bash
# Start all services in background
docker compose up -d --build

# View logs for a specific service
docker compose logs -f api
docker compose logs -f ai-moderation
docker compose logs -f escalation-worker

# Stop all services
docker compose down

# Stop and delete all volumes (wipes database)
docker compose down -v
```

---

## Cloud Deployment

### Production URLs

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://civic-sync-web-quxu.vercel.app |
| Backend API | Render | https://civicsync-api1.onrender.com |
| AI Service | Render | https://civicsync-ai2.onrender.com |

### Vercel (Frontend)

1. Connect GitHub repo at vercel.com
2. Set Root Directory to `apps/web`
3. Add Environment Variables in Project Settings:
   ```
   NEXT_PUBLIC_API_URL = https://civicsync-api1.onrender.com
   NEXT_PUBLIC_SOCKET_URL = https://civicsync-api1.onrender.com
   ```
4. Every push to `master` triggers an automatic deployment

### Render - Backend API

1. New Web Service -> connect GitHub repo
2. Root Directory: `apps/api`
3. Runtime: Node
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variables: MONGODB_URI, REDIS_URL, JWT_SECRET, AI_SERVICE_URL, CORS_ORIGIN, SLA_HOURS_*

### Render - AI Service

1. New Web Service -> connect GitHub repo
2. Root Directory: `services/ai-moderation`
3. Runtime: Python
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable: `GROQ_API_KEY`

> **Free Tier Note:** Render free instances sleep after 15 minutes of inactivity. The first request after sleeping may take 30-50 seconds. The registration page includes automatic retry logic to handle cold starts gracefully.

---

## Seeding the Database

The seed script populates MongoDB with a realistic New Delhi city hierarchy and test users:

```bash
# Local
cd apps/api
node src/seed.js

# Via Docker
docker exec -it civicpulse_api node src/seed.js
```

The seeder creates:
- **New Delhi** city with 2 municipalities, 5 colonies, and 10 localities
- **Test users** across all roles at every tier of the hierarchy
- **Sample issues**, discussions, polls, and messages

---

## Test Credentials

After seeding, use these accounts to explore the platform:

| Role | Email | Password | Scope |
|---|---|---|---|
| Citizen | citizen-vka1@civicpulse.app | citizen123 | Vasant Kunj Sector A |
| Citizen | citizen-hkv@civicpulse.app | citizen123 | Hauz Khas Village |
| RWA President | rwa-vka@civicpulse.app | official123 | Vasant Kunj Colony |
| Colony Official | official-sdmc@civicpulse.app | official123 | South Delhi Municipality |
| City Official | official-nd@civicpulse.app | official123 | New Delhi (City) |
| Moderator | mod@civicpulse.app | mod123 | Platform-wide |

Full credentials list available in `TEST_CREDENTIALS.md`.

---

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add some feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project was built as a demonstration of a production-grade civic engagement platform. All rights reserved.

---

Built with love for better civic governance.
**CivicPulse** - Your voice, your neighborhood, your city.

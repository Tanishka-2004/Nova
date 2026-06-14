# Nova — The AI-Native D2C Marketing Co-Pilot

Nova is a venture-backed, AI-native Mini CRM designed for D2C brands. It continuously scans shopper databases, detects customer segment opportunities, structures marketing campaigns, and dispatches multi-channel communications with full real-time telemetry callback tracking.

---

```mermaid
graph TD
    subgraph Frontend (Next.js 16)
        A[CommandCenter Page] -->|GET /api/opportunities| B(Opportunity Engine)
        A -->|POST /api/chat| C(AI Strategist)
        A -->|POST /api/campaign/launch| D(Campaign Launcher)
        E(Webhook Endpoint) -->|POST /api/webhooks/delivery| A
    end
    subgraph Database (PostgreSQL)
        B -->|Queries Cohorts| F[(Neon Cloud DB)]
        D -->|Persists Campaigns| F
        E -->|Mutates Messages| F
    end
    subgraph Backend (FastAPI)
        D -->|HTTP POST /send| G[Stubbed Channel Service]
        G -->|Async Telemetry Webhooks| E
    end
```

---

## 🚀 Product Vision & Philosophy

E-commerce marketers are overwhelmed by data and complex automation flows. They want to connect with their shoppers without building brittle query logic or manually typing copy variant testing scripts.

Nova implements a **Hybrid Intelligence** marketing loop:
1. **Determinism (The Opportunity Engine):** Real-time database metrics (AOV, cohort counts, recency) are queried directly from Postgres via Prisma. The LLM has no control over these values, preventing mathematical hallucinations.
2. **Probability (The AI Strategist):** Generative tasks (copywriting variants, customer persona designs, channel selections) are generated dynamically based on the cohort data variables passed as context.
3. **Telemetry (The Receipt Webhook):** Campaigns are tracked through a complete callback pipeline, updating progress bars in real-time as users interact.

---

## 🛠️ System Architecture

Nova is built as a monorepo utilizing **Turborepo** for build caching. It consists of three primary components:

### 1. The Next.js 16 App Router (Frontend + API Gateway)
* Handles page renders, opportunities calculation, AI strategy streams, and callback webhook ingestions.
* Uses Prisma Client to interface directly with Neon PostgreSQL.

### 2. The FastAPI Channel Service (Backend Microservice)
* Act as a separate stubbed channel gateway (simulating providers like Twilio or SendGrid).
* Uses `asyncio` to run concurrent queues, sleeping dynamically to simulate delivery delays, failed routes, and open/click events.

### 3. The PostgreSQL Database Package
* Centralized D2C schema storing customer data, transaction logs, segments, campaigns, and delivery statuses.
* Implements dynamic RFM (Recency, Frequency, Monetary) analytics inside the seeder to construct realistic e-commerce segments.

---

## 📡 Webhook Telemetry & Event Lifecycle

A single campaign message moves through the following stages:

```
[QUEUED] ──► [SENT] ──► [DELIVERED] ──► [READ] ──► [CLICKED] or [FAILED]
```

### Robustness Features
* **Casing Normalization:** Webhook status strings are normalized to uppercase to match Prisma enums.
* **Out-of-Order Webhook Protection:** Handled via a state level hierarchy:
  `QUEUED(0) < SENT(1) < DELIVERED(2) < READ(3) < CLICKED/FAILED(4)`
  If a late event (e.g. `READ`) arrives after a terminal event (e.g. `CLICKED`), the status column does not regress, but the `readAt` timestamp is still updated.
* **Idempotency:** Webhook updates are checked, resolving duplicate callbacks safely.
* **Exponential Backoff:** The FastAPI simulator retries failed webhook dispatches up to 3 times.

---

## 🗄️ Database Data Model

```
 ┌──────────────┐          ┌──────────────┐          ┌───────────────────┐
 │   Customer   │◄─────────┤    Order     │          │  SegmentCustomer  │
 ├──────────────┤          ├──────────────┤          ├───────────────────┤
 │ id (PK)      │          │ id (PK)      │          │ segmentId (PK)    │
 │ name         │          │ customerId   │          │ customerId (PK)   │
 │ email (UQ)   │          │ orderNumber  │          └───────────────────┘
 │ phone        │          │ amount       │
 │ rfmTier      │          │ items (JSON) │          ┌───────────────────┐
 │ totalSpent   │          │ status       │          │      Segment      │
 │ orderCount   │          │ createdAt    │          ├───────────────────┤
 └──────┬───────┘          └──────────────┘          │ id (PK)           │
        │                                            │ filters (JSON)    │
        │                  ┌──────────────┐          └─────────┬─────────┘
        │                  │   Campaign   │                    │
        │                  ├──────────────┤                    │
        │                  │ id (PK)      │◄───────────────────┘
        │                  │ segmentId    │
        │                  │ stats (JSON) │
        │                  └──────┬───────┘
        │                         │
        ▼                         ▼
 ┌────────────────────────────────────────┐
 │            CampaignMessage             │
 ├────────────────────────────────────────┤
 │ id (PK)                                │
 │ campaignId (FK)                        │
 │ customerId (FK)                        │
 │ content                                │
 │ status                                 │
 └────────────────────────────────────────┘
```

---

## 💻 Local Setup Instructions

### Prerequisites
* Node.js v20+
* pnpm v9+
* Python v3.11+

### Step 1: Install Dependencies
Run from the monorepo root:
```bash
pnpm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root folder (and `packages/database/.env`):
```env
DATABASE_URL="postgresql://neondb_owner:npg_ghV9iu0wcKaM@ep-young-river-ah8bek7l.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
GEMINI_API_KEY="your-gemini-key"
OPENAI_API_KEY="your-openai-key"
CHANNEL_SERVICE_URL="http://localhost:8001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Step 3: Run Database Migrations & Ingestion
```bash
# Push schema tables to PostgreSQL
pnpm --filter database db:push

# Import SQLite baseline snapshot into PostgreSQL
pnpm --filter database exec tsx src/import_postgres.ts
```

### Step 4: Launch Services
1. **Start the Channel Service (FastAPI):**
   ```bash
   cd apps/channel-service
   python -m venv .venv
   .venv\Scripts\activate # On Windows
   pip install -r requirements.txt
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```
2. **Start the Frontend (Next.js):**
   ```bash
   # From root directory
   pnpm --filter web dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Production Deployment

### 1. Frontend (Vercel)
* Link the repository on Vercel.
* Input variables: `DATABASE_URL`, `CHANNEL_SERVICE_URL`, `NEXT_PUBLIC_APP_URL`, `GEMINI_API_KEY`.
* Vercel will build the Next.js workspace automatically.

### 2. Backend (Render / Fly.io / Railway)
* Create a new Web Service linking the repository.
* Set root directory: `apps/channel-service`.
* Build: `pip install -r requirements.txt`.
* Start: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
* Input variable: `CORS_ORIGINS=["https://your-frontend.vercel.app"]`.

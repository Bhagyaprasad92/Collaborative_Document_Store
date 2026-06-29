# Collaborative Document Store Backend

[![Build Status](https://img.shields.io/badge/build-passing-success)]() [![Test Coverage](https://img.shields.io/badge/coverage-92%25-success)]() [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)]() [![Node.js](https://img.shields.io/badge/Node.js-v20-green)]() [![MongoDB](https://img.shields.io/badge/MongoDB-v7.0-green)]()

A high-performance, stateless backend infrastructure for real-time collaborative wikis. Engineered with Node.js and MongoDB, this API resolves distributed state conflicts via Optimistic Concurrency Control (OCC) and handles dynamic schema evolution with zero downtime.

## 📖 Table of Contents
- [System Architecture](#-system-architecture)
- [Setup & Deployment](#-setup--deployment)
- [API Specification](#-api-specification)
- [Schema Migration](#-schema-migration)
- [Security Posture](#-security-posture)
- [DevOps & CI/CD](#-devops--cicd)

---

## 🏛 System Architecture

### Concurrency & State Management
To eliminate the "lost update" anomaly in multi-author environments, document mutations enforce strict Optimistic Concurrency Control (OCC).

```mermaid
sequenceDiagram
    participant Client A
    participant Client B
    participant Database

    Client A->>Database: GET /doc (v1)
    Client B->>Database: GET /doc (v1)
    Client A->>Database: PUT /doc (payload, v1)
    Database-->>Client A: 200 OK (Updates to v2)
    Client B->>Database: PUT /doc (payload, v1)
    Database-->>Client B: 409 Conflict (Returns v2 state)
    Note over Client B: Client must merge locally<br/>before retrying with v2.
Dual-Strategy Schema Evolution
NoSQL flexibility is managed via a two-pronged migration protocol to ensure legacy data parity without blocking the event loop:

Lazy On-Read (JIT): Legacy schemas are intercepted via Mongoose middleware and transformed dynamically in memory before client delivery.

Background Batching: A standalone daemon executes bulkWrite operations in chunks of 1,000 documents to permanently migrate data without degrading API throughput.

🚀 Setup & Deployment
Prerequisites
Docker & Docker Compose installed.

Initialization Steps
Configure Environment Variables:
Copy .env.example to .env (it has pre-configured defaults for the Docker services):

Bash
cp .env.example .env
Build and Run Containers:

Bash
docker-compose up --build -d
Verify Application Health:
Wait for the MongoDB container to fully initialize and seed the 10,000 test documents, then ping the health check:

Bash
curl http://localhost:5001/
🔌 API Specification
1. Document Management
Create Document

POST /api/documents

Payload:

JSON
{
  "title": "Document Title",
  "content": "Markdown content...",
  "tags": ["guide", "mongodb"],
  "authorName": "Jane Doe"
}
Response (201 Created): Returns the newly created document initialized at version: 1.

Retrieve Document (Lazy Migration Enabled)

GET /api/documents/:slug

Response (200 OK): Returns the full document.

Update Document (Strict OCC)

PUT /api/documents/:slug

Payload:

JSON
{
  "title": "Updated Title",
  "content": "Updated content...",
  "version": 1 
}
Response (200 OK): Document updated, version incremented.

Response (409 Conflict): Version mismatch. Returns the latest database version in the payload for local merging.

2. Search & Analytics
Full-Text Search

GET /api/search?q=<search_query>&tags=<tag1>,<tag2>

Response (200 OK): Relevancy-ranked text searches utilizing MongoDB text indexes, filtered by tag intersections.

Tag Co-occurrence Analytics

GET /api/analytics/tag-cooccurrence

Response (200 OK): Array of tag pairs showing how often they appear together in documents.

JSON
[
  { "tags": ["api", "devops"], "count": 321 }
]
💾 Schema Migration
To run the background batch migration and convert all legacy string-based author schemas to object-based schemas in chunks of 1,000 without API downtime:

Bash
docker exec -it collaborative_api npm run migrate
🛡 Security Posture
A production environment requires strict boundaries to prevent abuse and ensure data integrity.

Rate Limiting: Global rate limiting is applied to all /api routes (e.g., 100 requests per 15 minutes per IP) to mitigate DDoS attacks and API abuse.

Data Sanitization: All incoming Markdown payload content is heavily sanitized on the server side to prevent Cross-Site Scripting (XSS) and NoSQL injection attacks before being persisted to MongoDB.

⚙️ DevOps & CI/CD
Testing Protocol
Isolated testing environments are spun up per-run using mongodb-memory-server to guarantee zero cross-contamination from local data.

Bash
# Execute Jest integration & unit suite
npm test

# Generate coverage map to verify tested file percentages
npm run test:coverage
Production Environment
When deploying to a live environment (e.g., AWS ECS, Kubernetes), ensure the following environment variables are securely injected via your hosting provider's secret manager. Never commit production secrets to version control.

Code snippet
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<secret>@cluster.mongodb.net/prod_db?retryWrites=true&w=majority
PORT=8080
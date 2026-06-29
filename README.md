# Collaborative Document Store Backend

A production-ready collaborative wiki-like backend built with **Node.js, Express, and MongoDB (Mongoose)**. It implements advanced database patterns including optimistic concurrency control (OCC) for conflict-free editing, dual schema evolution strategies, full-text search with relevance ranking, and high-performance analytics pipelines.

---

## Features

- **Docker Containerization**: Entire app & DB set up with health checks so the API boots only after MongoDB is fully ready.
- **Optimistic Concurrency Control (OCC)**: Atomic `findOneAndUpdate` operations prevent the "lost update" problem in collaborative editing. Version conflicts return `409 Conflict` containing the fresh document state.
- **Capped Revision History**: Automatically slices and keeps only the last 20 revisions inside each document structure.
- **Full-Text Search & Filters**: Relevancy-ranked text searches utilizing MongoDB text indexes on title and content, with support for tag intersection filtering.
- **Analytics Pipelines**:
  - `most-edited`: Top 10 documents by revision history size.
  - `tag-cooccurrence`: Tracks which tag pairs are most frequently used together.
- **Schema Evolution (Dual Migration Strategy)**:
  - **Lazy On-Read**: Outdated schemas are converted dynamically on read.
  - **Background Migration Script**: Standalone script processes updates in batches of 1,000 using `bulkWrite` for high performance.
- **Auto-Seeding**: Automatically seeds 10,000 documents (including ~10% old schemas for testing migrations) on first run.

---

## Tech Stack

- **Core**: Node.js & Express
- **Database**: MongoDB v7.0
- **ODM**: Mongoose v9.0
- **Containerization**: Docker & Docker Compose
- **Data Generation**: Faker.js

---

## Setup & Running

### Prerequisites
- Docker & Docker Compose installed on your system.

### Steps
1. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (it has pre-configured defaults for the docker services):
   ```bash
   cp .env.example .env
   ```

2. **Build and Run Containers**:
   ```bash
   docker-compose up --build -d
   ```

3. **Check Logs**:
   To monitor the server startup and automatic database seeding (10k documents):
   ```bash
   docker logs -f collaborative_api
   ```

4. **Verify Application Health**:
   Send a GET request to the root health check:
   ```bash
   curl http://localhost:5001/
   ```

---

## API Documentation

### 1. Document Management

#### Create Document
- **POST** `/api/documents`
- **Request Body**:
  ```json
  {
    "title": "Document Title",
    "content": "Markdown content...",
    "tags": ["guide", "mongodb"],
    "authorName": "Jane Doe",
    "authorEmail": "jane@example.com"
  }
  ```
- **Response** (`201 Created`): Returns the newly created document with `version: 1` and a generated slug.

#### Retrieve Document (Lazy Migration Enabled)
- **GET** `/api/documents/:slug`
- **Response** (`200 OK`): Returns the full document. If the document has an old author string schema, it is dynamically upgraded to the object structure before being returned.
- **Response** (`404 Not Found`): If the slug does not exist.

#### Update Document (OCC)
- **PUT** `/api/documents/:slug`
- **Request Body**:
  ```json
  {
    "title": "Updated Title",
    "content": "Updated content...",
    "version": 1 // MUST match the current document version
  }
  ```
- **Response** (`200 OK`): Document successfully updated. Version is incremented, and a revision log is appended.
- **Response** (`409 Conflict`): If the client version does not match the database version. Returns the latest database version in the response body.

#### Delete Document
- **DELETE** `/api/documents/:slug`
- **Response** (`200 OK`): Successfully deleted the document.
- **Response** (`404 Not Found`): If the document doesn't exist.

---

### 2. Search & Analytics

#### Full-Text Search
- **GET** `/api/search?q=<search_query>&tags=<tag1>,<tag2>`
- **Query Params**:
  - `q` (Required): Text search query.
  - `tags` (Optional): Comma-separated list of tags. Results must match ALL provided tags.
- **Response** (`200 OK`): List of matching documents, sorted by relevance score (`score`).

#### Most Edited Documents
- **GET** `/api/analytics/most-edited`
- **Response** (`200 OK`): Top 10 documents sorted by their edit/revision count in descending order.

#### Tag Co-occurrence
- **GET** `/api/analytics/tag-cooccurrence`
- **Response** (`200 OK`): Array of tag pairs showing how often they appear together in documents, sorted by count descending.
  ```json
  [
    { "tags": ["api", "devops"], "count": 321 },
    ...
  ]
  ```

---

## Schema Migration

### Run Background Migration
To convert all legacy string-based author schemas (`"metadata.author": "Jane Doe"`) to object-based schemas (`{"id": null, "name": "Jane Doe", "email": null}`) in batches of 1,000:

```bash
docker exec -it collaborative_api npm run migrate
```
This runs the standalone migration script located at `scripts/migrate_author_schema.js`.

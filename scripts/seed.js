/**
 * scripts/seed.js
 *
 * Seeds the MongoDB documents collection with 10,000 test documents.
 * - Skips seeding if the collection already has documents (idempotent).
 * - ~90% of documents use the new author object schema { id, name, email }.
 * - ~10% of documents use the OLD author string schema "Author Name"
 *   (inserted via raw MongoDB driver to bypass Mongoose schema validation).
 * - Creates a unique index on `slug` and a text index on `title` + `content`.
 * - Generates varying revision_history lengths (1–15 revisions) to support
 *   analytics testing.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

const TOTAL_DOCS = 10000;
const BATCH_SIZE = 500;
const OLD_SCHEMA_RATIO = 0.1; // 10% old schema

/* ------------------------------------------------------------------ */
/* Database Connection                                                   */
/* ------------------------------------------------------------------ */

async function connectDB() {
  const uri = `${process.env.MONGO_URI}/${process.env.DATABASE_NAME}`;
  try {
    await mongoose.connect(uri);
    console.log(`✅  MongoDB connected: ${uri}`);
  } catch (error) {
    console.error("❌  MongoDB connection error:", error.message);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */

const TAG_POOL = [
  "mongodb",
  "backend",
  "database",
  "api",
  "nodejs",
  "express",
  "docker",
  "javascript",
  "cloud",
  "security",
  "system-design",
  "web",
  "programming",
  "guide",
  "tutorial",
  "api-design",
  "concurrency",
  "performance",
  "microservices",
  "devops",
];

function pickTags(min = 2, max = 5) {
  const count = faker.number.int({ min, max });
  return faker.helpers.arrayElements(TAG_POOL, count);
}

function generateRevisions(maxVersion) {
  const count = faker.number.int({ min: 1, max: Math.min(maxVersion, 15) });
  const revisions = [];
  for (let v = 1; v <= count; v++) {
    revisions.push({
      version: v,
      updatedAt: faker.date.recent({ days: 180 }),
      authorId: faker.string.uuid(),
      contentDiff: faker.helpers.arrayElement([
        "Updated introduction paragraph",
        "Fixed typos and grammar",
        "Added new section on advanced usage",
        "Revised code examples",
        "Updated references and links",
        "Expanded conclusion",
        "Merged upstream changes",
        "Minor formatting fixes",
      ]),
    });
  }
  return revisions;
}

function slugify(title, index) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    `-${index}`
  );
}

/* ------------------------------------------------------------------ */
/* Document Builders                                                     */
/* ------------------------------------------------------------------ */

/**
 * Builds a document with the NEW author schema: { id, name, email }
 */
function buildNewSchemaDoc(i) {
  const title = faker.company.catchPhrase();
  const content =
    `# ${title}\n\n` +
    faker.lorem.paragraphs(faker.number.int({ min: 5, max: 15 }), "\n\n");
  const wordCount = content.trim().split(/\s+/).length;
  const revisions = generateRevisions(faker.number.int({ min: 2, max: 20 }));
  const finalVersion = revisions.length;

  return {
    slug: slugify(title, i),
    title,
    content,
    version: finalVersion,
    tags: pickTags(),
    metadata: {
      author: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
      },
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent({ days: 90 }),
      wordCount,
    },
    revision_history: revisions.slice(-20), // cap at 20
  };
}

/**
 * Builds a document with the OLD author schema: metadata.author is a string.
 * These documents are inserted via the raw driver to bypass Mongoose validation.
 */
function buildOldSchemaDoc(i) {
  const title = faker.company.catchPhrase();
  const content =
    `# ${title}\n\n` +
    faker.lorem.paragraphs(faker.number.int({ min: 3, max: 10 }), "\n\n");
  const wordCount = content.trim().split(/\s+/).length;
  const revisions = generateRevisions(faker.number.int({ min: 1, max: 10 }));
  const finalVersion = revisions.length;

  return {
    slug: slugify(title, `old-${i}`),
    title,
    content,
    version: finalVersion,
    tags: pickTags(),
    metadata: {
      // OLD schema: author is a plain string
      author: faker.person.fullName(),
      createdAt: faker.date.past({ years: 3 }),
      updatedAt: faker.date.recent({ days: 365 }),
      wordCount,
    },
    revision_history: revisions.slice(-20),
    __v: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Index Creation                                                        */
/* ------------------------------------------------------------------ */

async function ensureIndexes(collection) {
  console.log("📋  Ensuring indexes...");

  try {
    // Unique index on slug — use default name "slug_1" to match Mongoose's auto-created index
    await collection.createIndex({ slug: 1 }, { unique: true, name: "slug_1" });
    console.log("  ✅  slug_1 unique index ready");
  } catch (err) {
    if (err.code === 85 || err.code === 86 || err.message.includes("already exists")) {
      console.log("  ℹ️   slug_1 index already exists, skipping");
    } else {
      throw err;
    }
  }

  try {
    // Full-text index on title and content for $text queries
    await collection.createIndex(
      { title: "text", content: "text" },
      { name: "text_search_index" }
    );
    console.log("  ✅  text_search_index ready");
  } catch (err) {
    if (err.code === 85 || err.code === 86 || err.message.includes("already exists")) {
      console.log("  ℹ️   text index already exists, skipping");
    } else {
      throw err;
    }
  }

  console.log("✅  Indexes verified.");
}

/* ------------------------------------------------------------------ */
/* Seeder                                                                */
/* ------------------------------------------------------------------ */

async function seedDocuments() {
  const db = mongoose.connection.db;
  const collection = db.collection("documents");

  // Idempotent check: skip if already seeded
  const existingCount = await collection.countDocuments();
  if (existingCount > 0) {
    console.log(`ℹ️   Collection already has ${existingCount} documents. Skipping seed.`);
    await ensureIndexes(collection);
    return;
  }

  console.log(`🌱  Seeding ${TOTAL_DOCS} documents...`);

  const oldSchemaCount = Math.floor(TOTAL_DOCS * OLD_SCHEMA_RATIO);
  const newSchemaCount = TOTAL_DOCS - oldSchemaCount;

  let inserted = 0;

  // --- Insert NEW schema documents in batches ---
  for (let i = 0; i < newSchemaCount; i += BATCH_SIZE) {
    const batchDocs = [];
    const end = Math.min(i + BATCH_SIZE, newSchemaCount);

    for (let j = i; j < end; j++) {
      batchDocs.push(buildNewSchemaDoc(j + 1));
    }

    await collection.insertMany(batchDocs, { ordered: false });
    inserted += batchDocs.length;
    process.stdout.write(`\r   Progress: ${inserted}/${TOTAL_DOCS} documents`);
  }

  // --- Insert OLD schema documents in batches (bypasses Mongoose validation) ---
  const oldBatchSize = Math.min(BATCH_SIZE, oldSchemaCount);
  for (let i = 0; i < oldSchemaCount; i += oldBatchSize) {
    const batchDocs = [];
    const end = Math.min(i + oldBatchSize, oldSchemaCount);

    for (let j = i; j < end; j++) {
      batchDocs.push(buildOldSchemaDoc(j + 1));
    }

    // insertMany directly on collection bypasses Mongoose schema validation
    await collection.insertMany(batchDocs, { ordered: false });
    inserted += batchDocs.length;
    process.stdout.write(`\r   Progress: ${inserted}/${TOTAL_DOCS} documents`);
  }

  console.log(`\n✅  Inserted ${inserted} documents:`);
  console.log(`    - ${newSchemaCount} with new author schema { id, name, email }`);
  console.log(`    - ${oldSchemaCount} with OLD author schema (string) for migration testing`);

  await ensureIndexes(collection);
}

/* ------------------------------------------------------------------ */
/* Entry Point                                                           */
/* ------------------------------------------------------------------ */

/**
 * seedOnStartup — called by server.js after DB is already connected.
 * Does NOT open or close the mongoose connection.
 */
async function seedOnStartup() {
  await seedDocuments();
  console.log("🏁  Seeding complete.");
}

/**
 * CLI execution: node scripts/seed.js
 * Connects, seeds, then closes the connection.
 */
async function runCLI() {
  await connectDB();
  await seedDocuments();
  console.log("🏁  Seeding complete.");
  await mongoose.connection.close();
}

// When this script is run directly (not required as a module), run CLI mode
if (require.main === module) {
  runCLI().catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  });
}

module.exports = seedOnStartup;
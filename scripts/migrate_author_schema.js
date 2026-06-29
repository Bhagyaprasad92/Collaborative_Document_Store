/**
 * scripts/migrate_author_schema.js
 *
 * Background Schema Migration Script
 * ===================================
 * Migrates documents from the OLD author schema to the NEW schema.
 *
 * OLD schema: metadata.author = "Jane Doe"  (plain string)
 * NEW schema: metadata.author = { id: null, name: "Jane Doe", email: null }
 *
 * Strategy:
 *  - Query for documents where metadata.author is a BSON string (type 2)
 *  - Process in batches of 1000 to avoid memory pressure
 *  - Use bulkWrite for efficient batch updates (single round-trip per batch)
 *  - Idempotent: safe to run multiple times
 *
 * Usage:
 *   node scripts/migrate_author_schema.js
 *
 * Requires .env file with MONGO_URI and DATABASE_NAME.
 */

require("dotenv").config();

const mongoose = require("mongoose");

/* ------------------------------------------------------------------ */
/* Configuration                                                         */
/* ------------------------------------------------------------------ */

const BATCH_SIZE = 1000;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DATABASE_NAME = process.env.DATABASE_NAME || "collaborative_docs";

/* ------------------------------------------------------------------ */
/* Database Connection                                                   */
/* ------------------------------------------------------------------ */

async function connectDB() {
  const uri = `${MONGO_URI}/${DATABASE_NAME}`;
  try {
    await mongoose.connect(uri);
    console.log(`✅  Connected to MongoDB: ${uri}`);
  } catch (err) {
    console.error("❌  Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Migration                                                             */
/* ------------------------------------------------------------------ */

async function migrateAuthorSchema() {
  const db = mongoose.connection.db;
  const collection = db.collection("documents");

  // Count total documents needing migration (BSON type 2 = string)
  const totalToMigrate = await collection.countDocuments({
    "metadata.author": { $type: "string" },
  });

  if (totalToMigrate === 0) {
    console.log("✅  No documents require migration. All author fields are already objects.");
    return;
  }

  console.log(`\n📦  Found ${totalToMigrate} document(s) with old string author schema.`);
  console.log(`🔄  Migrating in batches of ${BATCH_SIZE}...\n`);

  let totalMigrated = 0;
  let batchNum = 0;

  // Process in batches until no more old-schema docs remain
  while (true) {
    batchNum++;

    // Fetch a batch of documents with string author
    const batch = await collection
      .find({ "metadata.author": { $type: "string" } })
      .limit(BATCH_SIZE)
      .project({ _id: 1, "metadata.author": 1 })
      .toArray();

    if (batch.length === 0) break;

    // Build bulkWrite operations for this batch
    const bulkOps = batch.map((doc) => {
      const authorName = doc.metadata.author; // The legacy string value

      return {
        updateOne: {
          filter: {
            _id: doc._id,
            // Double-check it's still a string (defensive, for concurrency)
            "metadata.author": { $type: "string" },
          },
          update: {
            $set: {
              "metadata.author": {
                id: null,
                name: authorName,
                email: null,
              },
            },
          },
        },
      };
    });

    // Execute all updates for this batch in a single round-trip
    const result = await collection.bulkWrite(bulkOps, { ordered: false });

    totalMigrated += result.modifiedCount;

    const percent = Math.round((totalMigrated / totalToMigrate) * 100);
    console.log(
      `  Batch ${batchNum}: processed ${batch.length} docs, ` +
      `modified ${result.modifiedCount} | ` +
      `Total: ${totalMigrated}/${totalToMigrate} (${percent}%)`
    );
  }

  console.log(`\n🏁  Migration complete.`);
  console.log(`    Total documents migrated: ${totalMigrated}`);

  // Verify no old-schema documents remain
  const remaining = await collection.countDocuments({
    "metadata.author": { $type: "string" },
  });

  if (remaining === 0) {
    console.log("✅  Verification passed: all author fields are now objects.");
  } else {
    console.warn(
      `⚠️   Verification: ${remaining} document(s) still have string author. ` +
      "Re-run the script to complete migration."
    );
  }
}

/* ------------------------------------------------------------------ */
/* Entry Point                                                           */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("=".repeat(60));
  console.log(" Collaborative Document Store — Author Schema Migration");
  console.log("=".repeat(60));
  console.log(`  Database: ${DATABASE_NAME}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("=".repeat(60) + "\n");

  await connectDB();

  const start = Date.now();
  await migrateAuthorSchema();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log(`\n⏱️   Elapsed: ${elapsed}s`);
  console.log(`  Finished: ${new Date().toISOString()}`);

  await mongoose.connection.close();
  console.log("✅  Connection closed.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

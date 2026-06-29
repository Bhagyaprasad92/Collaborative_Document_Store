const mongoose = require("mongoose");
const Document = require("../models/document.model");
const generateSlug = require("../utils/slugGenerator");

/*
|--------------------------------------------------------------------------
| Helper: Apply Lazy Schema Migration on a raw lean document
|--------------------------------------------------------------------------
| If the stored author is a plain string (old schema), transform it into
| the new object structure { id, name, email } before returning to client.
*/

function applyLazyMigration(doc) {
  if (!doc || !doc.metadata) return doc;

  if (typeof doc.metadata.author === "string") {
    const authorName = doc.metadata.author;
    doc.metadata.author = {
      id: null,
      name: authorName,
      email: null,
    };
  }

  return doc;
}

/*
|--------------------------------------------------------------------------
| Helper: Count words in a string
|--------------------------------------------------------------------------
*/

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/*
|--------------------------------------------------------------------------
| Helper: Generate unique slug (appends timestamp suffix on collision)
|--------------------------------------------------------------------------
*/

async function generateUniqueSlug(title) {
  const baseSlug = generateSlug(title);
  const existing = await Document.findOne({ slug: baseSlug }).lean();
  if (!existing) return baseSlug;
  return `${baseSlug}-${Date.now()}`;
}

/*
|--------------------------------------------------------------------------
| POST /api/documents — Create Document
|--------------------------------------------------------------------------
*/

const createDocument = async (req, res) => {
  try {
    const {
      title,
      content,
      tags,
      authorName,
      authorEmail,
    } = req.body;

    if (!title || !content || !authorName) {
      return res.status(400).json({
        success: false,
        message: "title, content and authorName are required",
      });
    }

    const slug = await generateUniqueSlug(title);
    const wordCount = countWords(content);

    const document = await Document.create({
      slug,
      title,
      content,
      version: 1,
      tags: tags || [],
      metadata: {
        author: {
          id: null,
          name: authorName,
          email: authorEmail || null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount,
      },
      revision_history: [],
    });

    return res.status(201).json({
      success: true,
      message: "Document created successfully",
      data: document,
    });

  } catch (error) {
    console.error("createDocument error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A document with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/documents/:slug — Retrieve Document (with lazy migration)
|--------------------------------------------------------------------------
*/

const getDocumentBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Use lean() to get a plain JS object so we can mutate metadata.author
    const document = await Document.findOne({ slug })
      .select("-__v")
      .lean();

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Apply lazy schema migration (old string author → new object)
    const migratedDoc = applyLazyMigration(document);

    return res.status(200).json({
      success: true,
      data: migratedDoc,
    });

  } catch (error) {
    console.error("getDocumentBySlug error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| PUT /api/documents/:slug — Update Document (Optimistic Concurrency Control)
|--------------------------------------------------------------------------
| Uses a single atomic findOneAndUpdate where the query includes BOTH the
| slug AND the expected version. If version has changed, the update finds
| no document (returns null) → 409 Conflict with current DB document.
|
| The $push + $slice combo caps revision_history to the last 20 entries.
*/

const updateDocument = async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      title,
      content,
      tags,
      version: expectedVersion,
      authorId,
    } = req.body;

    if (expectedVersion === undefined || expectedVersion === null) {
      return res.status(400).json({
        success: false,
        message: "version is required for updates (Optimistic Concurrency Control)",
      });
    }

    const newVersion = Number(expectedVersion) + 1;
    const now = new Date();

    // Build the revision entry to append
    const revisionEntry = {
      version: newVersion,
      updatedAt: now,
      authorId: authorId || null,
      contentDiff: `Updated to version ${newVersion}`,
    };

    // Construct $set fields conditionally
    const setFields = {
      "metadata.updatedAt": now,
    };
    if (title !== undefined) setFields.title = title;
    if (content !== undefined) {
      setFields.content = content;
      setFields["metadata.wordCount"] = countWords(content);
    }
    if (tags !== undefined) setFields.tags = tags;

    // Single atomic operation: match slug + exact version atomically
    const updatedDoc = await Document.findOneAndUpdate(
      { slug, version: Number(expectedVersion) },
      {
        $set: setFields,
        $inc: { version: 1 },
        $push: {
          revision_history: {
            $each: [revisionEntry],
            $slice: -20,  // Keep only the last 20 revisions
          },
        },
      },
      {
        returnDocument: "after",  // Return the updated document (replaces deprecated `new: true`)
        lean: true,               // Return plain JS object for direct mutation
      }
    );

    // If null: no document matched slug+version → version conflict
    if (!updatedDoc) {
      // Fetch the current document to return in 409 response
      const currentDoc = await Document.findOne({ slug })
        .select("-__v")
        .lean();

      if (!currentDoc) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: `Version conflict: document is at version ${currentDoc.version}, you sent version ${expectedVersion}`,
        currentDocument: applyLazyMigration(currentDoc),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: applyLazyMigration(updatedDoc),
    });

  } catch (error) {
    console.error("updateDocument error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE /api/documents/:slug — Delete Document
|--------------------------------------------------------------------------
*/

const deleteDocument = async (req, res) => {
  try {
    const { slug } = req.params;

    const deleted = await Document.findOneAndDelete({ slug });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });

  } catch (error) {
    console.error("deleteDocument error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/search — Full-Text Search with Tag Filtering
|--------------------------------------------------------------------------
| Query params:
|   q     — (required) search term, uses MongoDB $text index
|   tags  — (optional) comma-separated list of tags (ALL must match)
|   limit — (optional) max results, default 20
|   skip  — (optional) pagination offset, default 0
|
| Results include a `score` field ($meta textScore) sorted descending.
| When tags are provided, documents must contain ALL of the specified tags.
*/

const searchDocuments = async (req, res) => {
  try {
    const { q, tags, limit = 20, skip = 0 } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'q' is required",
      });
    }

    // Build the filter — always includes $text search
    const filter = {
      $text: { $search: q.trim() },
    };

    // If tags provided, document must contain ALL specified tags ($all)
    if (tags) {
      const tagList = tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      if (tagList.length > 0) {
        filter.tags = { $all: tagList };
      }
    }

    const results = await Document.find(
      filter,
      { score: { $meta: "textScore" } }  // Projection: include relevance score
    )
      .select("-__v")
      .sort({ score: { $meta: "textScore" } })  // Sort by relevance descending
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    // Apply lazy migration to each result
    const migratedResults = results.map(applyLazyMigration);

    return res.status(200).json({
      success: true,
      count: migratedResults.length,
      data: migratedResults,
    });

  } catch (error) {
    console.error("searchDocuments error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createDocument,
  getDocumentBySlug,
  updateDocument,
  deleteDocument,
  searchDocuments,
};
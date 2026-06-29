const mongoose = require("mongoose");

/*
|--------------------------------------------------------------------------
| Revision History Sub-Schema
|--------------------------------------------------------------------------
*/

const revisionSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    authorId: {
      type: String,
      default: null,
    },

    contentDiff: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

/*
|--------------------------------------------------------------------------
| Main Document Schema
|--------------------------------------------------------------------------
| Note: metadata.author is defined as Mixed to support both the new object
| schema { id, name, email } and the legacy string schema "Author Name".
| The GET endpoint performs a lazy migration transform on read, and the
| background script (scripts/migrate_author_schema.js) handles bulk updates.
*/

const documentSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  title: {
    type: String,
    required: true,
    trim: true,
  },

  content: {
    type: String,
    required: true,
  },

  version: {
    type: Number,
    default: 1,
  },

  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  metadata: {
    // Mixed allows both legacy string and new { id, name, email } object
    author: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },

  revision_history: {
    type: [revisionSchema],
    default: [],
  },
});

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

/* Full-text search index on title and content */
documentSchema.index(
  { title: "text", content: "text" },
  { name: "text_search_index" }
);

/*
|--------------------------------------------------------------------------
| Export Model
|--------------------------------------------------------------------------
*/

module.exports = mongoose.model("Document", documentSchema);
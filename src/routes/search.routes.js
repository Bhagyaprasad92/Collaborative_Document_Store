const express = require("express");

const {
  searchDocuments,
} = require("../controllers/document.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/search?q=<term>&tags=<tag1,tag2>&limit=20&skip=0
|--------------------------------------------------------------------------
| Full-text search with optional tag filtering.
| Results include a `score` field sorted by relevance descending.
*/

router.get("/", searchDocuments);

module.exports = router;

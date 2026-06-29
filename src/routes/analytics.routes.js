const express = require("express");

const {
  getMostEdited,
  getTagCooccurrence,
} = require("../controllers/analytics.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| GET /api/analytics/most-edited
|--------------------------------------------------------------------------
| Returns the top 10 documents ordered by number of revisions (desc).
*/

router.get("/most-edited", getMostEdited);

/*
|--------------------------------------------------------------------------
| GET /api/analytics/tag-cooccurrence
|--------------------------------------------------------------------------
| Returns the most frequently co-occurring tag pairs across all documents.
*/

router.get("/tag-cooccurrence", getTagCooccurrence);

module.exports = router;

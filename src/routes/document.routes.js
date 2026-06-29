const express = require("express");

const {
  createDocument,
  getDocumentBySlug,
  updateDocument,
  deleteDocument,
} = require("../controllers/document.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| POST /api/documents — Create Document
|--------------------------------------------------------------------------
*/

router.post("/", createDocument);

/*
|--------------------------------------------------------------------------
| GET /api/documents/:slug — Retrieve Document by Slug
|--------------------------------------------------------------------------
*/

router.get("/:slug", getDocumentBySlug);

/*
|--------------------------------------------------------------------------
| PUT /api/documents/:slug — Update Document (OCC)
|--------------------------------------------------------------------------
*/

router.put("/:slug", updateDocument);

/*
|--------------------------------------------------------------------------
| DELETE /api/documents/:slug — Delete Document
|--------------------------------------------------------------------------
*/

router.delete("/:slug", deleteDocument);

module.exports = router;
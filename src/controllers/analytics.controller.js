const Document = require("../models/document.model");

/*
|--------------------------------------------------------------------------
| GET /api/analytics/most-edited
|--------------------------------------------------------------------------
| Returns the top 10 documents sorted by the number of entries in their
| revision_history array (descending).
*/

const getMostEdited = async (req, res) => {
  try {
    const results = await Document.aggregate([
      {
        $project: {
          title: 1,
          slug: 1,
          editCount: { $size: "$revision_history" },
        },
      },
      {
        $sort: { editCount: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    return res.status(200).json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error("getMostEdited error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET /api/analytics/tag-cooccurrence
|--------------------------------------------------------------------------
| Finds which pairs of tags appear together most frequently across all
| documents. Returns an array of { tags: [tagA, tagB], count: N } objects
| sorted by count descending.
|
| Strategy:
|   For each document, we use $unwind with includeArrayIndex to get (tagA, idxA).
|   We then store tagA, and unwind again to get (tagB, idxB).
|   We filter for idxA < idxB so each pair is counted once.
|   We group by alphabetically-sorted (tagA, tagB) and count.
|
| Key insight: after the first $unwind with includeArrayIndex, we use
| $addFields to save the current tag as "tagA" and its index. Then we do
| a second $unwind on the same tags field — at this point each document
| has the original tags array still intact (we didn't remove it), tagA
| saved, and tags unwound to tagB. We filter idxA < idxB to avoid
| duplicates and self-pairs.
*/

const getTagCooccurrence = async (req, res) => {
  try {
    const results = await Document.aggregate([
      // Step 1: Only documents with 2+ tags can form pairs
      {
        $match: {
          $expr: { $gte: [{ $size: "$tags" }, 2] },
        },
      },

      // Step 2: Keep _id and tags only, also save a copy of tags as allTags
      // so we still have the full array after the first unwind
      {
        $project: {
          tags: 1,
          allTags: "$tags",
        },
      },

      // Step 3: First unwind — gives us one doc per tagA with its index
      {
        $unwind: {
          path: "$allTags",
          includeArrayIndex: "idxA",
        },
      },

      // Step 4: Save tagA value before second unwind clobbers the field name
      {
        $addFields: {
          tagA: "$allTags",
        },
      },

      // Step 5: Second unwind on tags (original array) — gives us tagB per each tagA
      {
        $unwind: {
          path: "$tags",
          includeArrayIndex: "idxB",
        },
      },

      // Step 6: Only keep pairs where idxA < idxB (no self-pairs, no duplicates)
      {
        $match: {
          $expr: { $lt: ["$idxA", "$idxB"] },
        },
      },

      // Step 7: Group by alphabetically-sorted pair (so mongodb,nodejs == nodejs,mongodb)
      {
        $group: {
          _id: {
            tag1: {
              $cond: [{ $lte: ["$tagA", "$tags"] }, "$tagA", "$tags"],
            },
            tag2: {
              $cond: [{ $lte: ["$tagA", "$tags"] }, "$tags", "$tagA"],
            },
          },
          count: { $sum: 1 },
        },
      },

      // Step 8: Shape the output
      {
        $project: {
          _id: 0,
          tags: ["$_id.tag1", "$_id.tag2"],
          count: 1,
        },
      },

      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);

    return res.status(200).json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error("getTagCooccurrence error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMostEdited,
  getTagCooccurrence,
};

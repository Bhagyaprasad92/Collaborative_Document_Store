const slugify = require("slugify");

const generateSlug = (title) => {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
};

module.exports = generateSlug;
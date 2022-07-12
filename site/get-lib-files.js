const libFiles = require("@ts-morph/common").getLibFiles();

require("fs").writeFileSync(
  "lib-files.json",
  JSON.stringify(libFiles, null, 2)
);

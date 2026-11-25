// runs _socsim from the right cwd (shell can't cd into the Korean path)
process.chdir(require("path").join(__dirname, ".."));
require("./_socsim.cjs");

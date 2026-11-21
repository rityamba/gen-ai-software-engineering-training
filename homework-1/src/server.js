"use strict";

const config = require("./config");
const app = require("./app");

app.listen(config.port, (err) => {
  if (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
  console.log(
    `Banking Transactions API listening on port ${config.port} (${config.nodeEnv})`,
  );
});

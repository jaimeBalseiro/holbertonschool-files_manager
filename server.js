const express = require('express');

const app = express();
const port = process.env.PORT || 5000;
const router = require('./routes/index');

// Parse JSON bodies (as sent by API clients)
app.use(express.json());
// Parse URL-encoded bodies
app.use(router);

// Listen to requests
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

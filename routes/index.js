const express = require('express');
const AppControler = require('../controllers/AppController');

const router = express.Router();

router.get('/status', AppControler.getStatus);
router.get('/stats', AppControler.getStats);

module.exports = router;

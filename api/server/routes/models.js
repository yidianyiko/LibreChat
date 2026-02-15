const express = require('express');
const { modelController, modelRatesController } = require('~/server/controllers/ModelController');
const { optionalJwtAuth } = require('~/server/middleware/');

const router = express.Router();
router.get('/rates', optionalJwtAuth, modelRatesController);
router.get('/', optionalJwtAuth, modelController);

module.exports = router;

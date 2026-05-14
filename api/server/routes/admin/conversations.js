const express = require('express');
const { createAdminConversationsRouter, requireAdmin } = require('@librechat/api');
const { Conversation, Message } = require('~/db/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth, requireAdmin, createAdminConversationsRouter({ Conversation, Message }));

module.exports = router;

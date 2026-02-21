#!/usr/bin/env node
/**
 * Migration: Add subscriptionBalance and topupBalance fields to existing Balance documents.
 *
 * Existing documents created before the dual-balance system may lack these fields.
 * This script initializes them to 0 for documents that don't have them.
 *
 * Usage: node config/migrate-balance-fields.js
 * Requires: MONGO_URI environment variable
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('balances');

  // Find documents missing the new fields
  const result = await collection.updateMany(
    {
      $or: [
        { subscriptionBalance: { $exists: false } },
        { topupBalance: { $exists: false } },
      ],
    },
    {
      $set: {
        subscriptionBalance: 0,
        topupBalance: 0,
      },
    },
  );

  console.log(`Updated ${result.modifiedCount} balance documents`);
  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

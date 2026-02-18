import { Schema } from 'mongoose';
import type * as t from '~/types';

const balanceSchema = new Schema<t.IBalance>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  // 1000 tokenCredits = 1 mill ($0.001 USD)
  // Deprecated: old unified balance (keep for migration)
  tokenCredits: {
    type: Number,
    default: 0,
  },
  // New: Subscription balance (resets monthly)
  subscriptionBalance: {
    type: Number,
    default: 0,
  },
  // New: Topup balance (permanent, purchased separately)
  topupBalance: {
    type: Number,
    default: 0,
  },
  // Last time subscription balance was reset
  lastSubscriptionReset: {
    type: Date,
  },
  // Automatic refill settings
  autoRefillEnabled: {
    type: Boolean,
    default: false,
  },
  refillIntervalValue: {
    type: Number,
    default: 30,
  },
  refillIntervalUnit: {
    type: String,
    enum: ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months'],
    default: 'days',
  },
  lastRefill: {
    type: Date,
    default: Date.now,
  },
  // amount to add on each refill
  refillAmount: {
    type: Number,
    default: 0,
  },
});

export default balanceSchema;

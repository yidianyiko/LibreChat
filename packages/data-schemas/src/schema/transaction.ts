import mongoose, { Schema, Document, Types } from 'mongoose';

// @ts-ignore
export interface ITransaction extends Document {
  user: Types.ObjectId;
  conversationId?: string;
  tokenType: 'prompt' | 'completion' | 'credits';
  model?: string;
  context?: string;
  balanceType?: 'subscription' | 'topup' | 'legacy' | null;
  valueKey?: string;
  metadata?: Record<string, unknown>;
  rate?: number;
  rawAmount?: number;
  tokenValue?: number;
  inputTokens?: number;
  writeTokens?: number;
  readTokens?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const transactionSchema: Schema<ITransaction> = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    conversationId: {
      type: String,
      ref: 'Conversation',
      index: true,
    },
    tokenType: {
      type: String,
      enum: ['prompt', 'completion', 'credits'],
      required: true,
    },
    model: {
      type: String,
      index: true,
    },
    context: {
      type: String,
      // Add new contexts: subscription_charge, subscription_topup, subscription_reset
    },
    balanceType: {
      type: String,
      enum: ['subscription', 'topup', 'legacy', null],
      default: null,
    },
    valueKey: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    rate: Number,
    rawAmount: Number,
    tokenValue: Number,
    inputTokens: { type: Number },
    writeTokens: { type: Number },
    readTokens: { type: Number },
  },
  {
    timestamps: true,
  },
);

export default transactionSchema;

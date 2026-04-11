import { Schema } from 'mongoose';
import type { IWeChatBinding } from '~/types';

const currentConversationSchema = new Schema(
  {
    conversationId: { type: String, required: true },
    parentMessageId: { type: String, required: true },
    selectedAt: { type: Date, required: true },
    lastAdvancedAt: { type: Date, default: null },
    source: { type: String, enum: ['new', 'switch'], required: true },
  },
  { _id: false },
);

const weChatBindingSchema: Schema<IWeChatBinding> = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    ilinkBotId: { type: String, default: null },
    botToken: { type: String, default: null, select: false },
    baseUrl: { type: String, default: null },
    ilinkUserId: { type: String, default: null, sparse: true, unique: true },
    status: {
      type: String,
      enum: ['healthy', 'reauth_required', 'unbound'],
      required: true,
      default: 'unbound',
    },
    boundAt: { type: Date, default: null },
    unhealthyAt: { type: Date, default: null },
    unboundAt: { type: Date, default: null },
    currentConversation: { type: currentConversationSchema, default: null },
  },
  { timestamps: true },
);

export default weChatBindingSchema;

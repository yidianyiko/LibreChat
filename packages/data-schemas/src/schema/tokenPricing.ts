import { Schema } from 'mongoose';

export interface ITokenPricing {
  modelPattern: string;
  provider: string;
  inputRate: number;
  outputRate: number;
  longContextThreshold?: number;
  longContextInputRate?: number;
  longContextOutputRate?: number;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tokenPricingSchema = new Schema<ITokenPricing>(
  {
    modelPattern: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    inputRate: {
      type: Number,
      required: true,
    },
    outputRate: {
      type: Number,
      required: true,
    },
    longContextThreshold: {
      type: Number,
    },
    longContextInputRate: {
      type: Number,
    },
    longContextOutputRate: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

export default tokenPricingSchema;

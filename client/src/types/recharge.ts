export interface PricingTier {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number; // in cents
  discount: number; // percentage
}

export interface RechargeHistory {
  id: string;
  credits: number;
  amount: number;
  currency: string;
  tierId: string;
  sessionId: string;
  createdAt: string;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PricingResponse {
  enabled: boolean;
  tiers: PricingTier[];
}

export interface VerifySessionResponse {
  sessionId: string;
  paymentStatus: string;
  isPaid: boolean;
  credits: number;
  tierId: string;
  amountTotal: number;
}

export interface SubscriptionStatus {
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionBalance: number;
  topupBalance: number;
  totalBalance?: number;
}

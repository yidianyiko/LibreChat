export type TTimeRangeCount = {
  last1Day: number;
  last7Days: number;
  last30Days: number;
};

export type TDailyRegistrationProvider = {
  key: string;
  count: number;
};

export type TDailyRegistration = {
  date: string;
  total: number;
  providers: TDailyRegistrationProvider[];
};

export type TDailyUsage = {
  date: string;
  activeUsers: number;
  messages: number;
  conversations: number;
  errors: number;
};

export type TDistributionBucket = {
  key: string;
  label: string;
  count: number;
};

export type TAdminStatsOverview = {
  totalUsers: number;
  newUsers: TTimeRangeCount;
  activeUsers: TTimeRangeCount;
  messages: TTimeRangeCount;
  conversations: TTimeRangeCount;
  activeRateLast7Days: number;
  messagesPerActiveUserLast7Days: number;
  errorRateLast7Days: number;
  negativeFeedbackRateLast7Days: number;
};

export type TAdminStatsQuality = {
  errorsLast7Days: number;
  assistantMessagesLast7Days: number;
  feedbackCountLast7Days: number;
  negativeFeedbackCountLast7Days: number;
};

export type TAdminStatsResponse = {
  overview: TAdminStatsOverview;
  registration: {
    daily: TDailyRegistration[];
    byProvider: TDistributionBucket[];
  };
  usage: {
    daily: TDailyUsage[];
    byEndpoint: TDistributionBucket[];
    byModel: TDistributionBucket[];
  };
  quality: TAdminStatsQuality;
};

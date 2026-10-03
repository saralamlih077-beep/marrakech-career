export type RegisteredUser = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  applicationCount: number;
  sentApplicationCount: number;
};

export type AdminAnalytics = {
  schemaVersion: number;
  users: {
    total: number;
    newLast30Days: number;
    profilesCompleted: number;
    registeredUsers: RegisteredUser[];
    emailConfirmation: Array<{ name: string; value: number }>;
    profileCompletion: Array<{ name: string; value: number }>;
  };
  activity: { favorites: number; applications: number; applicationsByStatus: Record<string, number> };
  feedback: null | { total: number; averageRating: number; ratings: Array<{ rating: number; value: number }>; interpretation: string };
  engagement?: {
    available: boolean; startedAt: string | null; activeLast30Days: number;
    week: EngagementPoint[]; month: EngagementPoint[];
  };
  applicationTrends?: {
    statusTrackingAvailable: boolean; startedAt: string | null;
    week: ApplicationPoint[]; month: ApplicationPoint[];
  };
  skills?: { verifiedOffers: number; skills: Array<{ skill: string; profiles: number; offers: number; rate: number }> };
  profileQuality?: Array<{ field: string; value: number }>;
};

export type EngagementPoint = {
  key: string; date: string; activeUsers: number | null; newUsers: number | null;
  returningUsers: number | null; cvViews: number | null; offerViews: number | null;
};
export type ApplicationPoint = {
  key: string; date: string; registered: number; sent: number | null;
  interviews: number | null; accepted: number | null;
};

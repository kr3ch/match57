/**
 * Shared TypeScript types -- mirrors the JSON schema persisted by the backend
 * (which is the same schema bot.py has always used: ``users_db.json``).
 */

export type Gender = "Девушка" | "Парень";
export type LookingFor = "Девушки" | "Парни" | "Все равно";

export type PhotoMedia = { type: "photo" | "video"; file_id: string };

export type Profile = {
  user_id: number;
  username?: string | null;
  age: number;
  gender: Gender;
  looking_for: LookingFor;
  name: string;
  description?: string;
  photos: PhotoMedia[];
  phone?: string;
  created_at: string;
  likes_sent?: number[];
  likes_received?: number[];
  matches?: number[];
  dislikes?: number[];
  hidden?: boolean;
  referrals?: number[];
};

export type PublicProfile = {
  user_id: number;
  name: string;
  age: number;
  gender: Gender;
  description: string;
  photos: PhotoMedia[];
};

export type Me = {
  user_id: number;
  username?: string | null;
  is_admin: boolean;
  registered: boolean;
  hidden?: boolean;
};

export type LikeResult = {
  match: boolean;
  contact: string | null;
};

export type AdminStats = {
  total: number;
  guys: number;
  girls: number;
  total_likes: number;
  total_matches: number;
  total_referrals: number;
  loners: number;
  matched: number;
  hidden: number;
  new_today: number;
  banned: number;
  reports: number;
  unresolved_reports: number;
};

export type ReportRow = {
  index: number;
  from: number;
  from_name?: string;
  from_username?: string | null;
  on: number;
  on_name?: string;
  on_username?: string | null;
  reason: string;
  at: string;
  resolved: boolean;
};

export type ReferralInfo = {
  count: number;
  bonuses: string;
  telegram_link: string | null;
  web_link: string;
};

export const REPORT_REASONS = [
  "🔞 Неприемлемый контент",
  "🤡 Фейковая анкета",
  "😡 Оскорбления/угрозы",
] as const;

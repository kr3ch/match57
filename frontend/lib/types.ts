/**
 * v2 frontend types — mirrors the SQLAlchemy schema served by FastAPI under
 * ``/api``. The auth model is now email + password (no Telegram).
 */

export type Gender = "Девушка" | "Парень";
export type LookingFor = "Девушки" | "Парни" | "Все равно";

export type PhotoKind = "photo" | "video";

export type Photo = {
  id: number;
  user_id: number;
  filename: string;
  kind: PhotoKind;
  mime?: string | null;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
};

export type PublicProfile = {
  user_id: number;
  name: string;
  age: number;
  gender: Gender;
  looking_for: LookingFor;
  description: string | null;
  school: string | null;
  username: string | null;
  is_admin: boolean;
  hidden: boolean;
  banned: boolean;
  photos: Photo[];
  last_seen_at: string | null;
};

export type Me = PublicProfile & {
  email?: string;
  phone?: string | null;
  email_verified?: boolean;
};

export type LikeResult = {
  matched: boolean;
  conversation_id?: number | null;
};

export type Match = {
  match_id: number;
  user: PublicProfile;
  conversation_id: number | null;
  online: boolean;
};

export type IncomingLike = {
  user: PublicProfile;
  at: string;
};

export type SkippedItem = {
  user: PublicProfile;
  at: string;
};

export type ConversationListItem = {
  id: number;
  other: {
    user_id: number;
    name: string;
    username: string | null;
    age: number | null;
    avatar:
      | { filename: string; kind: PhotoKind; user_id: number }
      | null;
    online: boolean;
    last_seen_at: string | null;
    is_admin?: boolean;
  } | null;
  last_message: {
    id: number;
    body: string | null;
    kind: MessageKind;
    from_user_id: number;
    created_at: string;
  } | null;
  unread_count: number;
  last_message_at: string | null;
};

export type MessageKind = "text" | "voice" | "video" | "photo" | "file";

export type ChatMessage = {
  id: number;
  conversation_id: number;
  from_user_id: number;
  body: string | null;
  kind: MessageKind;
  attachment: null | {
    filename: string;
    mime: string | null;
    duration_ms: number | null;
    width: number | null;
    height: number | null;
    user_id: number;
  };
  reply_to_id: number | null;
  reactions: { user_id: number; emoji: string }[];
  // Backend serialises this as a flat list of user ids — see
  // backend/app/services/messaging.py::serialize_message.
  read_by: number[];
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  is_mine: boolean;
};

export type AdminStatsV2 = {
  total_users: number;
  banned: number;
  hidden: number;
  total_likes: number;
  total_dislikes: number;
  total_matches: number;
  open_reports: number;
  photo_count: number;
};

export type ReportRow = {
  id: number;
  from_user_id: number;
  target_user_id: number;
  reason: string;
  status: "open" | "resolved" | "banned";
  at: string;
};

export const REPORT_REASONS = [
  "🔞 Неприемлемый контент",
  "🤡 Фейковая анкета",
  "😡 Оскорбления/угрозы",
] as const;

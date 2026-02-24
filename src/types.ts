export type UserProfile = {
  id: string;
  nickname: string;
  profilePictureUrl: string | null;
  avatarHistoryUrls?: string[];
  createdAt: string;
  followingUserIds: string[];
  followerUserIds: string[];
};

export type Post = {
  id: string;
  userId: string;
  caption: string;
  mediaUrls: string[];
  mediaTypes: string[];
  createdAt: string;
  updatedAt: string;
  likedBy: string[];
  sourceType?: 'feed' | 'channel';
  sourceChannelId?: string;
  sourceChannelTitle?: string;
  sourceChannelAvatarUrl?: string;
  sourcePostId?: string;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  likedBy?: string[];
  author?: UserProfile;
};

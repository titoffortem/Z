import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string;
  nickname: string;
  profilePictureUrl: string | null;
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
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  author?: UserProfile;
};

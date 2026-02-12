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
  likesCount: number;
  commentCount: number;
  // Array of user UIDs who liked the post.
  likes?: string[];
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string; 
  // Denormalized for convenience
  authorNickname: string;
  authorPhotoURL: string | null;
};

export type Like = {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
};

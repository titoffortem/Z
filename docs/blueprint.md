# **App Name**: Z

## Core Features:

- Google Auth & Profile Creation: Secure user authentication via Google's signInWithRedirect, with a mandatory, unique nickname selection for profile completion, stored in Firestore's 'users' collection.
- Versatile Content Publishing: Users can compose posts including image uploads via ImgBB, embedding YouTube/MP4 video links for in-app playback, and attaching document links for direct download, with all media URLs stored in Firestore.
- Personalized Smart Mix Feed: A dynamic content feed that prioritizes posts from followed users, intelligently surfaces trending content, and introduces new discoveries through random posts, reflecting user interaction data from Firestore for a 'YouTube Shorts-like' experience.
- Real-time Social Interaction: Enable real-time direct messaging between users with a dedicated 'Messages' section, and instant feedback on posts via a 'like' mechanism, all synchronized through Firestore's 'chats' and 'posts' collections.
- User Discovery Search: Efficiently locate and connect with other users through a dedicated search functionality based on their unique nicknames, utilizing the 'users' collection in Firestore.
- AI-Generated Post Captions: An integrated AI tool that suggests creative and relevant captions for user posts based on uploaded media or initial text input, enhancing content engagement and reducing the effort to create compelling posts. Tool use included.

## Style Guidelines:

- The background color uses a dark, subtle military green hue for a modern feel (#344E41), providing a deep canvas for content.
- A medium-bright military green serves as the primary action color (#588157), ensuring interactive elements and key information stand out effectively on the dark background.
- A lighter, softer military green provides an accent color (#A3B18A), offering a secondary highlight and enhancing visual hierarchy while maintaining harmony with the overall cool palette.
- Body and headline font: 'Inter' (sans-serif), chosen for its modern, clean, and objective appearance, enhancing readability in a minimalist dark theme.
- Minimalist and clean geometric icons are utilized across the interface to complement the modern, uncluttered aesthetic, ensuring clarity and ease of navigation.
- A media-centric, vertically-scrolling feed is adopted, resembling the prominent, engaging display of short-form video platforms like YouTube Shorts, to prioritize visual content and user engagement.
- Subtle and fluid animations are employed for interactions like 'liking' posts, navigating between sections, and loading content, contributing to a polished and responsive user experience.
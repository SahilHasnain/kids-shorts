# Kids Shorts App - Setup Guide

## What's Different from Speech App?

1. **No Navigation**: Opens directly to shorts feed (no tabs, no header)
2. **Kids Content Only**: Filters shorts from channels with `isKidsChannel: true`
3. **Minimal UI**: Only play/pause button, no progress bar or seek controls
4. **Same Backend**: Uses the same Appwrite project as speech-app

## Quick Start

```bash
# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## How to Add Kids Channels

In your Appwrite channels collection, set `isKidsChannel: true` for any channel you want to include in the kids shorts app.

Example:
```json
{
  "$id": "channel-id-here",
  "name": "Kids Channel Name",
  "youtubeChannelId": "UC...",
  "isKidsChannel": true,
  "includeShorts": true
}
```

## Project Structure

```
kids-shorts/
├── app/
│   ├── _layout.tsx          # Root layout (no tabs/header)
│   └── index.tsx            # Main shorts feed screen
├── components/
│   ├── CustomVideoPlayer.tsx  # Minimal video player
│   └── EmptyState.tsx         # Empty state component
├── config/
│   └── appwrite.ts           # Appwrite configuration
├── constants/
│   └── theme.ts              # Theme colors
├── hooks/
│   ├── useKidsShorts.ts      # Fetch kids shorts
│   └── useSeenShorts.ts      # Track seen shorts
├── services/
│   └── progressTracking.ts  # Progress tracking
└── types/
    └── index.ts              # TypeScript types
```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

## Environment Variables

The app uses these Appwrite credentials (configured in app.json):
- Endpoint: `https://sgp.cloud.appwrite.io/v1`
- Project ID: `69c60b0e001c5ec5e031`

## Features

- ✅ Full-screen shorts player
- ✅ Swipe up/down navigation
- ✅ Auto-loop videos
- ✅ Progress tracking
- ✅ Seen shorts management
- ✅ Smart feed (prioritizes unseen content)
- ✅ Pull to refresh
- ✅ Infinite scroll

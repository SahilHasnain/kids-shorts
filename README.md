# Kids Shorts App

A minimal shorts player app for kids content, built with React Native and Expo.

## Features

- Full-screen shorts player (no tabs, no header)
- Automatically filters shorts from kids channels (channels with `isKidsChannel: true`)
- Uses the same Appwrite backend as the speech-app
- Progress tracking and seen shorts management
- Swipe up/down to navigate between shorts

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on Android:
```bash
npm run android
```

4. Run on iOS:
```bash
npm run ios
```

## Configuration

The app uses the same Appwrite project as speech-app:
- Endpoint: `https://sgp.cloud.appwrite.io/v1`
- Project ID: `69c60b0e001c5ec5e031`

To add a channel to kids shorts, set `isKidsChannel: true` in the channels collection.

## Architecture

- **No navigation**: App opens directly to shorts feed
- **Minimal UI**: Only play/pause button, no progress bar or seek controls
- **Auto-loop**: Videos loop automatically like YouTube Shorts
- **Smart feed**: Prioritizes unseen shorts, mixes in seen ones for rediscovery

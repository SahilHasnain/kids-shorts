const { Client, Databases, Storage, ID, Permission, Role } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

async function setupAppwrite() {
    console.log('🚀 Setting up Appwrite for Kids Shorts...\n');

    try {
        // 1. Create Database
        console.log('📦 Creating database...');
        const database = await databases.create(
            ID.unique(),
            'kids-shorts-db'
        );
        console.log(`✅ Database created: ${database.$id}\n`);

        // 2. Create Videos Collection
        console.log('📝 Creating videos collection...');
        const videosCollection = await databases.createCollection(
            database.$id,
            ID.unique(),
            'videos',
            [
                Permission.read(Role.any()),
                Permission.write(Role.users())
            ]
        );
        console.log(`✅ Videos collection created: ${videosCollection.$id}`);

        // Add attributes to videos collection
        await databases.createStringAttribute(database.$id, videosCollection.$id, 'videoId', 255, true);
        await databases.createStringAttribute(database.$id, videosCollection.$id, 'title', 500, true);
        await databases.createStringAttribute(database.$id, videosCollection.$id, 'thumbnailUrl', 1000, false);
        await databases.createIntegerAttribute(database.$id, videosCollection.$id, 'duration', true);
        await databases.createStringAttribute(database.$id, videosCollection.$id, 'channelId', 255, true);
        await databases.createBooleanAttribute(database.$id, videosCollection.$id, 'isShort', true);
        await databases.createDatetimeAttribute(database.$id, videosCollection.$id, 'uploadDate', false);
        console.log('✅ Video attributes created');

        // Create indexes
        await databases.createIndex(database.$id, videosCollection.$id, 'channelId_idx', 'key', ['channelId']);
        await databases.createIndex(database.$id, videosCollection.$id, 'isShort_idx', 'key', ['isShort']);
        await databases.createIndex(database.$id, videosCollection.$id, 'uploadDate_idx', 'key', ['uploadDate'], ['desc']);
        console.log('✅ Video indexes created\n');

        // 3. Create Channels Collection
        console.log('📝 Creating channels collection...');
        const channelsCollection = await databases.createCollection(
            database.$id,
            ID.unique(),
            'channels',
            [
                Permission.read(Role.any()),
                Permission.write(Role.users())
            ]
        );
        console.log(`✅ Channels collection created: ${channelsCollection.$id}`);

        // Add attributes to channels collection
        await databases.createStringAttribute(database.$id, channelsCollection.$id, 'youtubeChannelId', 255, true);
        await databases.createStringAttribute(database.$id, channelsCollection.$id, 'name', 255, true);
        await databases.createBooleanAttribute(database.$id, channelsCollection.$id, 'isKidsChannel', true);
        console.log('✅ Channel attributes created');

        // Create index
        await databases.createIndex(database.$id, channelsCollection.$id, 'isKidsChannel_idx', 'key', ['isKidsChannel']);
        console.log('✅ Channel indexes created\n');

        // 4. Create Storage Bucket
        console.log('📦 Creating storage bucket...');
        const bucket = await storage.createBucket(
            ID.unique(),
            'video-files',
            [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users())
            ],
            false, // fileSecurity
            true,  // enabled
            null,  // maximumFileSize (null = no limit)
            ['video/mp4', 'video/webm', 'video/quicktime'], // allowedFileExtensions
            'none', // compression
            true,  // encryption
            false  // antivirus
        );
        console.log(`✅ Storage bucket created: ${bucket.$id}\n`);

        // Print configuration
        console.log('🎉 Setup complete! Update your config/appwrite.ts with these IDs:\n');
        console.log('const frontendConfig = {');
        console.log(`  endpoint: "${process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT}",`);
        console.log(`  projectId: "${process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID}",`);
        console.log(`  databaseId: "${database.$id}",`);
        console.log(`  videosCollectionId: "${videosCollection.$id}",`);
        console.log(`  channelsCollectionId: "${channelsCollection.$id}",`);
        console.log(`  storageBucketId: "${bucket.$id}",`);
        console.log('};');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setupAppwrite();

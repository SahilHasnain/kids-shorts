import { Client, Databases, Storage } from "appwrite";

const frontendConfig = {
  endpoint: "https://sgp.cloud.appwrite.io/v1",
  projectId: "69907afc003b9e3d9152",
  databaseId: "69d2206900358e41513d",
  videosCollectionId: "69d2206b0018425b9cb5",
  channelsCollectionId: "69d22070003313a4fe51",
  storageBucketId: "69d22086002f376ddbb3",
} as const;

const client = new Client();

client
  .setEndpoint(frontendConfig.endpoint)
  .setProject(frontendConfig.projectId);

export const databases = new Databases(client);
export const storage = new Storage(client);

export const config = {
  endpoint: frontendConfig.endpoint,
  projectId: frontendConfig.projectId,
  databaseId: frontendConfig.databaseId,
  videosCollectionId: frontendConfig.videosCollectionId,
  channelsCollectionId: frontendConfig.channelsCollectionId,
  storageBucketId: frontendConfig.storageBucketId,
};

export default client;

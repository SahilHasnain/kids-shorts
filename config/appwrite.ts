import { Client, Databases, Storage } from "appwrite";

const frontendConfig = {
  endpoint: "https://sgp.cloud.appwrite.io/v1",
  projectId: "69c60b0e001c5ec5e031",
  databaseId: "69c60d540003506ba3cf",
  speechesCollectionId: "69c60d5700050177d8ff",
  channelsCollectionId: "69c60d6c002054f70390",
} as const;

const client = new Client();

client
  .setEndpoint(frontendConfig.endpoint)
  .setProject(frontendConfig.projectId);

export const databases = new Databases(client);
export const storage = new Storage(client);

export const config = {
  databaseId: frontendConfig.databaseId,
  speechesCollectionId: frontendConfig.speechesCollectionId,
  channelsCollectionId: frontendConfig.channelsCollectionId,
};

export default client;

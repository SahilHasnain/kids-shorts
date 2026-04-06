import { Client, Databases, Query, Storage } from "node-appwrite";
import { appConfig, requireConfig } from "@/lib/config";

export { Query };

export function getAppwriteClient() {
  requireConfig();

  const client = new Client()
    .setEndpoint(appConfig.endpoint)
    .setProject(appConfig.projectId)
    .setKey(appConfig.apiKey);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

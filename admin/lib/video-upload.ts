import { spawn } from "child_process";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { getAppwriteClient, Query } from "@/lib/appwrite";
import { appConfig } from "@/lib/config";

export interface UploadConfig {
  channels: string[];
  uploadMode: "all" | "shorts" | "videos";
  quality: 480 | 720 | 1080;
  limit: number;
}

interface VideoDocument {
  $id: string;
  title: string;
  youtubeId: string;
  channelId: string;
  duration: number;
}

export interface ProgressCallback {
  (data: {
    type: "progress" | "success" | "error" | "complete";
    current: number;
    total: number;
    speechId?: string;
    title?: string;
    message?: string;
    status?: "downloading" | "transcoding" | "uploading" | "updating";
  }): void;
}

const TEMP_DIR = join(process.cwd(), "..", "temp-video");

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function getVideoCodec(filePath: string) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  return stdout.trim().toLowerCase();
}

async function ensureH264Compatible(filePath: string) {
  const codec = await getVideoCodec(filePath);
  if (codec === "h264") {
    return filePath;
  }

  const transcodedPath = join(dirname(filePath), `${basename(filePath, extname(filePath))}_h264.mp4`);

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    transcodedPath,
  ]);

  return transcodedPath;
}

function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupTempFile(filePath: string) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

async function downloadVideo(youtubeId: string, title: string, quality: number) {
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").slice(0, 50);
  const outputPath = join(TEMP_DIR, `${youtubeId}_${sanitizedTitle}.mp4`);

  await runCommand("yt-dlp", [
    "-f",
    `bestvideo[vcodec^=avc1][height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`,
    "--merge-output-format",
    "mp4",
    "--max-filesize",
    "500M",
    "--no-playlist",
    "-o",
    outputPath,
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ]);

  return outputPath;
}

async function fetchVideosWithoutFile(config: UploadConfig) {
  const { databases } = getAppwriteClient();
  const allVideos: VideoDocument[] = [];
  let offset = 0;
  const limit = 100;

  while (allVideos.length < config.limit) {
    const response = await databases.listDocuments(appConfig.databaseId, appConfig.videosCollectionId, [
      Query.isNull("videoId"),
      Query.limit(limit),
      Query.offset(offset),
    ]);

    let batch = response.documents as unknown as VideoDocument[];

    batch = batch.filter((video) => config.channels.includes(video.channelId));
    if (config.uploadMode === "shorts") {
      batch = batch.filter((video) => video.duration < 60);
    }
    if (config.uploadMode === "videos") {
      batch = batch.filter((video) => video.duration >= 60);
    }

    allVideos.push(...batch);

    if (response.documents.length < limit) {
      break;
    }

    offset += limit;
  }

  return allVideos.slice(0, config.limit);
}

export async function uploadVideos(config: UploadConfig, progressCallback: ProgressCallback) {
  const { databases, storage } = getAppwriteClient();
  ensureTempDir();

  const videos = await fetchVideosWithoutFile(config);
  const errors: string[] = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < videos.length; i += 1) {
    const video = videos[i];
    let tempFilePath: string | null = null;
    let uploadFilePath: string | null = null;

    try {
      progressCallback({
        type: "progress",
        current: i + 1,
        total: videos.length,
        speechId: video.$id,
        title: video.title,
        status: "downloading",
        message: "Downloading from YouTube",
      });

      tempFilePath = await downloadVideo(video.youtubeId, video.title, config.quality);
      uploadFilePath = await ensureH264Compatible(tempFilePath);

      progressCallback({
        type: "progress",
        current: i + 1,
        total: videos.length,
        speechId: video.$id,
        title: video.title,
        status: "uploading",
        message: "Uploading to Appwrite Storage",
      });

      const fileName = `${video.youtubeId}.mp4`;
      const file = await storage.createFile(
        appConfig.storageBucketId,
        ID.unique(),
        InputFile.fromPath(uploadFilePath, fileName)
      );

      await databases.updateDocument(appConfig.databaseId, appConfig.videosCollectionId, video.$id, {
        videoId: file.$id,
      });

      successful += 1;
      progressCallback({
        type: "success",
        current: i + 1,
        total: videos.length,
        speechId: video.$id,
        title: video.title,
        message: "Upload successful",
      });
    } catch (error) {
      failed += 1;
      errors.push(`${video.title}: ${error instanceof Error ? error.message : "Upload failed"}`);
      progressCallback({
        type: "error",
        current: i + 1,
        total: videos.length,
        speechId: video.$id,
        title: video.title,
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      if (tempFilePath) {
        cleanupTempFile(tempFilePath);
      }
      if (uploadFilePath && uploadFilePath !== tempFilePath) {
        cleanupTempFile(uploadFilePath);
      }
    }
  }

  progressCallback({
    type: "complete",
    current: videos.length,
    total: videos.length,
    message: `Complete: ${successful} successful, ${failed} failed`,
  });

  return { successful, failed, errors };
}

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");

const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const path = require("path");

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const transcribe = new TranscribeClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function detectMediaFormat(originalName, mimeType) {
  const ext = (path.extname(originalName || "") || "").toLowerCase().replace(".", "");

  // Prefer extension if present
  if (ext === "mp3") return { mediaFormat: "mp3", s3Ext: "mp3" };
  if (ext === "wav") return { mediaFormat: "wav", s3Ext: "wav" };
  if (ext === "m4a") return { mediaFormat: "mp4", s3Ext: "m4a" }; // Transcribe expects mp4 for m4a

  // Fallback: mimetype
  if (mimeType === "audio/mpeg") return { mediaFormat: "mp3", s3Ext: "mp3" };
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return { mediaFormat: "wav", s3Ext: "wav" };
  if (mimeType === "audio/mp4") return { mediaFormat: "mp4", s3Ext: "m4a" };

  // Safe default (tell user to upload mp3/wav)
  throw new Error("Unsupported audio type. Upload .mp3 or .wav (or .m4a).");
}

async function speechToText({ filePath, originalName, mimeType }) {
  const { mediaFormat, s3Ext } = detectMediaFormat(originalName, mimeType);

  // 1) Upload to S3
  const fileContent = fs.readFileSync(filePath);
  const key = `audio-${crypto.randomUUID()}.${s3Ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: mimeType || "application/octet-stream",
    })
  );

  // 2) Start transcription
  const jobName = `job-${crypto.randomUUID()}`;

  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: "en-US",
      MediaFormat: mediaFormat,
      Media: { MediaFileUri: `s3://${BUCKET}/${key}` },
    })
  );

  // 3) Poll status
  let transcriptUrl = null;

  while (!transcriptUrl) {
    const job = await transcribe.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
    );

    const status = job.TranscriptionJob.TranscriptionJobStatus;

    if (status === "COMPLETED") {
      transcriptUrl = job.TranscriptionJob.Transcript.TranscriptFileUri;
      break;
    }

    if (status === "FAILED") {
      throw new Error(job.TranscriptionJob.FailureReason || "Transcription failed");
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  // 4) Fetch transcript JSON
  return new Promise((resolve, reject) => {
    https
      .get(transcriptUrl, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          resolve(json.results.transcripts[0].transcript);
        });
      })
      .on("error", reject);
  });
}

module.exports = { speechToText };

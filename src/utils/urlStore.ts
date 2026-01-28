// Upstash Redis store for URLs and tags (persists across serverless invocations)
import { Redis } from "@upstash/redis";

interface StoredData {
  url: string;
  tags: string;
}

// Initialize Redis client (will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
let redis: Redis | null = null;
const dataStore = new Map<string, StoredData>(); // Fallback for local dev

// Try to initialize Redis if credentials are available
if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log("[URLSTORE] Using Upstash Redis for storage");
} else {
  console.log("[URLSTORE] Using in-memory Map for storage (local dev mode)");
}

let dataCounter = 0;

export async function storeUrlAndTags(
  url: string,
  tags: string,
): Promise<string> {
  const id = `summary_${Date.now()}_${dataCounter++}`;
  const data: StoredData = { url, tags };

  if (redis) {
    // Store in Redis with 24 hour TTL
    await redis.setex(id, 86400, JSON.stringify(data));
    console.log(`[URLSTORE] Stored data in Redis with ID: ${id}`);
  } else {
    // Fallback to in-memory for local dev
    dataStore.set(id, data);
    console.log(`[URLSTORE] Stored data in memory with ID: ${id}`);
  }

  return id;
}

export async function retrieveData(
  id: string,
): Promise<StoredData | undefined> {
  if (redis) {
    const data = await redis.get<string>(id);
    if (data) {
      console.log(`[URLSTORE] Retrieved data from Redis for ID: ${id}`);
      return JSON.parse(data);
    }
    console.log(`[URLSTORE] No data found in Redis for ID: ${id}`);
    return undefined;
  } else {
    // Fallback to in-memory for local dev
    const data = dataStore.get(id);
    console.log(`[URLSTORE] Retrieved data from memory for ID: ${id}`);
    return data;
  }
}

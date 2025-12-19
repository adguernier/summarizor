// Simple in-memory store for URLs and tags (in production, use a proper database)
interface StoredData {
  url: string;
  tags: string;
}

const dataStore = new Map<string, StoredData>();
let dataCounter = 0;

export function storeUrlAndTags(url: string, tags: string): string {
  const id = (dataCounter++).toString();
  dataStore.set(id, { url, tags });
  return id;
}

export function retrieveData(id: string): StoredData | undefined {
  return dataStore.get(id);
}

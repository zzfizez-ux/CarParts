export class JsonBodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(message, maxBytes, {requireContentType = true} = {}) {
  const type = message.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (requireContentType && type !== "application/json") {
    throw new JsonBodyError(415, "Expected application/json");
  }
  if (Number(message.headers.get("content-length")) > maxBytes) {
    throw new JsonBodyError(413, "Request body too large");
  }
  const reader = message.body?.getReader();
  if (!reader) throw new JsonBodyError(400, "Missing JSON body");

  const decoder = new TextDecoder("utf-8", {fatal: true});
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new JsonBodyError(413, "Request body too large");
      }
      body += decoder.decode(value, {stream: true});
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof JsonBodyError) throw error;
    throw new JsonBodyError(400, "Invalid JSON body");
  } finally {
    reader.releaseLock();
  }
}

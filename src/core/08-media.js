// ============================================================
// v9.0 业务层 · 08-media（媒体解析 / 交付验真）
// 来源：由 legacy.js 整块迁出（v9.0 第六刀 · 种子闭包新增 0）
// ============================================================
const { version } = require("./00-host.js");
const { logWarn, logDebug } = require("./01-log.js");
const { ERROR_CODES } = require("./02-error-codes.js");

const MPEG_BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];

const MPEG_BR_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

const MPEG_SR_V1 = [44100, 48000, 32000];

const MPEG_SR_V2 = [22050, 24000, 16000];

const MPEG_SR_V25 = [11025, 12000, 8000];

function bAt(buf, i) {
  if (i < 0) return 0;
  return typeof buf === "string" ? buf.charCodeAt(i) & 0xFF : buf[i];
}

function asciiAt(buf, off, str) {
  for (let i = 0; i < str.length; i++) if (bAt(buf, off + i) !== str.charCodeAt(i)) return false;
  return true;
}

function u32At(buf, o) {
  return (((bAt(buf, o) << 24) >>> 0) + (bAt(buf, o + 1) << 16) + (bAt(buf, o + 2) << 8) + bAt(buf, o + 3));
}

function parseMpegFrameHeader(buf, off) {
  if (off + 4 > (buf.length || 0)) return null;
  const b0 = bAt(buf, off), b1 = bAt(buf, off + 1), b2 = bAt(buf, off + 2);
  if (b0 !== 0xFF || (b1 & 0xE0) !== 0xE0) return null;
  const verBits = (b1 >> 3) & 0x03;   // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=保留
  const layerBits = (b1 >> 1) & 0x03; // 1=LayerIII
  if (verBits === 1 || layerBits === 0) return null;
  const brIdx = (b2 >> 4) & 0x0F;
  const srIdx = (b2 >> 2) & 0x03;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const bitrateKbps = (verBits === 3 ? MPEG_BR_V1_L3 : MPEG_BR_V2_L3)[brIdx];
  const sampleRate = (verBits === 3 ? MPEG_SR_V1 : (verBits === 2 ? MPEG_SR_V2 : MPEG_SR_V25))[srIdx];
  return { bitrateKbps, sampleRate, samplesPerFrame: verBits === 3 ? 1152 : 576, version: verBits };
}

function parseFlacDuration(buf) {
  if ((buf.length || 0) < 8 || !asciiAt(buf, 0, "fLaC")) return null;
  let p = 4;
  let guard = 0;
  while (p + 4 <= buf.length && guard++ < 8) {
    const last = (bAt(buf, p) & 0x80) !== 0;
    const type = bAt(buf, p) & 0x7F;
    const len = (bAt(buf, p + 1) << 16) | (bAt(buf, p + 2) << 8) | bAt(buf, p + 3);
    if (type === 0) {
      const q = p + 4 + 10;
      if (q + 8 > buf.length) return null;
      const sampleRate = (bAt(buf, q) << 12) | (bAt(buf, q + 1) << 4) | (bAt(buf, q + 2) >> 4);
      const totalSamples = ((bAt(buf, q + 3) & 0x0F) * 4294967296) + (bAt(buf, q + 4) * 16777216) +
        (bAt(buf, q + 5) * 65536) + (bAt(buf, q + 6) * 256) + bAt(buf, q + 7);
      return (sampleRate > 0 && totalSamples > 0) ? +(totalSamples / sampleRate).toFixed(1) : null;
    }
    p += 4 + len;
    if (last) break;
  }
  return null;
}

function parseMp3Info(buf) {
  let off = 0;
  if ((buf.length || 0) >= 10 && asciiAt(buf, 0, "ID3")) {
    const size = (bAt(buf, 6) << 21) | (bAt(buf, 7) << 14) | (bAt(buf, 8) << 7) | bAt(buf, 9);
    off = 10 + size;
  }
  let h = null, hOff = -1;
  const limit = Math.min(buf.length - 4, off + 4096);
  for (let i = Math.max(off, 0); i < limit; i++) {
    h = parseMpegFrameHeader(buf, i);
    if (h) { hOff = i; break; }
  }
  if (!h) return null;
  const xingOff = hOff + 4 + (h.version === 3 ? 32 : 17);
  let durationSec = null;
  if (xingOff + 12 <= buf.length && (asciiAt(buf, xingOff, "Xing") || asciiAt(buf, xingOff, "Info"))) {
    const flags = u32At(buf, xingOff + 4);
    if (flags & 1) {
      const frames = u32At(buf, xingOff + 8);
      if (frames > 0) durationSec = +((frames * h.samplesPerFrame) / h.sampleRate).toFixed(1);
    }
  }
  return { bitrateKbps: h.bitrateKbps, sampleRate: h.sampleRate, durationSec };
}

function sniffAudioBytes(body, headers, totalBytes, fullBody = false) {
  const ct = String((headers && headers["content-type"]) || "").toLowerCase();
  const out = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null, totalBytes: 0 };
  // 只有 header 的 content-length（或明确大于探测块）才是完整文件大小；
  // 探测块自身的 bytes.length 不能当总字节，否则会把 1KB 探针算成 128k。
  const bodyLength = (body && body.length) || 0;
  const declaredBytes = Number(totalBytes) || 0;
  const headerBytes = Number(headers && headers["content-length"]) || 0;
  // Range 探针的 content-length 是「这一段」的长度，不是整文件；只有 content-range
  // 的总长度、或明确大于当前响应体的声明，才可当作完整文件大小。
  // 200 全量响应（无 content-range）时，content-length 就是整文件大小；
  // Range 探针仍只在声明/头明确大于响应体时才采用。
  out.totalBytes = (fullBody && declaredBytes > 0) || declaredBytes > bodyLength ? declaredBytes : (headerBytes > bodyLength ? headerBytes : 0);
  // D-29：能拿到响应体、里面却没有任何字节（或短到装不下任何音频头），是**确定不可播**，
  // 不是"拿不准"。旧逻辑在这里把 content-type 为 audio 的空体直接判成 audio ——
  // 206 + 0 字节会被当成"验真通过"交付出去：用户点到的是 0 字节 URL，播放器必报错，
  // 而音源认为成功、连失败缓存都不进，于是每次重试都重新外呼、每次都"成功"。
  // 16 字节的下限依据：FLAC 的 STREAMINFO 至少 34 字节；ID3 标签头 10 字节 + 帧头 4 字节；
  // MP3 单帧头 4 字节。任何真实音频文件的"开头 16 字节"都不可能短于这个量。
  if (!body || body.length < 16) {
    out.kind = "empty";
    return out;
  }
  // 1. 文本类优先判死
  if (asciiAt(body, 0, "#EXTM3U")) { out.kind = "playlist"; out.format = "m3u8"; return out; }
  let s = 0;
  while (s < body.length && s < 64 && (bAt(body, s) === 0x20 || bAt(body, s) === 0x0A || bAt(body, s) === 0x0D || bAt(body, s) === 0x09 || bAt(body, s) === 0xEF)) s++;
  if (bAt(body, s) === 0x3C) { // '<'
    if (asciiAt(body, s, "<html") || asciiAt(body, s, "<!DOCTYPE") || asciiAt(body, s, "<?xml") || asciiAt(body, s, "<HTML")) {
      out.kind = "html"; return out;
    }
  }
  if (bAt(body, s) === 0x7B || bAt(body, s) === 0x5B) { out.kind = "json"; return out; }

  // 2. 音频魔数
  if (asciiAt(body, 0, "fLaC")) {
    out.kind = "audio"; out.format = "flac";
    out.durationSec = parseFlacDuration(body);
    out.bitrateKbps = out.durationSec && totalBytes
      ? Math.round((totalBytes * 8) / out.durationSec / 1000)
      : 1000;
    return out;
  }
  if (asciiAt(body, 0, "OggS")) { out.kind = "audio"; out.format = "ogg"; return out; }
  if (asciiAt(body, 4, "ftyp")) { out.kind = "audio"; out.format = "m4a"; return out; }
  if (asciiAt(body, 0, "RIFF")) { out.kind = "audio"; out.format = "wav"; return out; }

  // 3. MP3（含 ID3v2 包裹）
  const mp3 = parseMp3Info(body);
  if (mp3) {
    out.kind = "audio"; out.format = "mp3";
    out.durationSec = mp3.durationSec;
    if (out.durationSec && totalBytes) {
      // 平均码率必须用「总字节 ÷ 时长」——首帧标称码率不可信（实测首帧标 80k 实为 128k）
      out.bitrateKbps = Math.round((totalBytes * 8) / out.durationSec / 1000);
    } else if (totalBytes && mp3.bitrateKbps) {
      out.durationSec = +((totalBytes * 8) / (mp3.bitrateKbps * 1000)).toFixed(1);
      out.bitrateKbps = mp3.bitrateKbps;
    } else {
      out.bitrateKbps = mp3.bitrateKbps;
    }
    return out;
  }

  // 4. 兜底：content-type 声称是音频就认（不因解析失败误杀）
  if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
    out.kind = "audio";
    out.format = ct.includes("flac") ? "flac" : (ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio");
    return out;
  }
  return out;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64Ascii(s) {
  let pad = 0;
  const origLen = s.length;   // 必须先按含 '=' 的原长算输出字节数：剥掉填充后再算会少 1~2 字节
  while (s.length && s.charAt(s.length - 1) === "=") { pad++; s = s.slice(0, -1); }
  const out = new Uint8Array(Math.floor(origLen / 4) * 3 - pad);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64_CHARS.indexOf(s.charAt(i));
    if (v < 0) return null;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xFF; }
  }
  return out;
}

function decodeMediaEnvelope(x) {
  if (!x || typeof x !== "object") return null;
  if (x.__lxMedia !== 2) return null;
  try {
    if (String(x.encoding || "").toLowerCase() !== "base64") return null;
    // 0 字节信封只带 byteLength，不应伪造 body/chunks；必须返回零长字节而不是 null。
    if (x.byteLength === 0 && x.body === undefined && x.chunks === undefined) return new Uint8Array(0);
    let parts = null;
    if (Array.isArray(x.chunks)) {
      if (!x.chunks.length) return null;
      for (let i = 0; i < x.chunks.length; i++) {
        if (typeof x.chunks[i] !== "string") return null;
      }
      parts = x.chunks;
    } else if (typeof x.body === "string") {
      parts = [x.body];
    } else {
      return null;
    }
    // 每片独立解码：base64 分片各自带 '=' 填充，拼成一个大串后中间的 '=' 非法。
    let total = 0;
    const decoded = [];
    for (let i = 0; i < parts.length; i++) {
      const s = String(parts[i]).replace(/\s+/g, "");
      if (!s.length) return x.byteLength === 0 ? new Uint8Array(0) : null;
      if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
      const part = decodeBase64Ascii(s);
      if (!part) return null;
      decoded.push(part);
      total += part.length;
    }
    if (typeof x.byteLength === "number" && Number.isFinite(x.byteLength) && total !== x.byteLength) return null;
    if (decoded.length === 1) return decoded[0];
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < decoded.length; i++) { bytes.set(decoded[i], offset); offset += decoded[i].length; }
    return bytes;
  } catch (e) { return null; }
}

function mediaEnvelopeErrorCode(x) {
  if (!x || typeof x !== "object" || x.__lxMedia !== 2) return null;
  if (String(x.encoding || "").toLowerCase() !== "base64") return ERROR_CODES.BAD_ENVELOPE;
  if (x.byteLength === 0 && x.body === undefined && x.chunks === undefined) return null;
  let parts = null;
  if (Array.isArray(x.chunks)) {
    if (!x.chunks.length) return ERROR_CODES.TRUNCATED_MEDIA;
    for (let i = 0; i < x.chunks.length; i++) {
      if (typeof x.chunks[i] !== "string") return ERROR_CODES.BAD_ENVELOPE;
      if (!String(x.chunks[i]).replace(/\s+/g, "").length) return ERROR_CODES.TRUNCATED_MEDIA;
    }
    const chunkBytes = Number(x.chunkBytes);
    if (Number.isFinite(chunkBytes) && chunkBytes > 0 && Number.isFinite(x.byteLength) &&
        x.chunks.length < Math.ceil(x.byteLength / chunkBytes)) return ERROR_CODES.TRUNCATED_MEDIA;
    parts = x.chunks;
  } else if (typeof x.body === "string") {
    if (!x.body.replace(/\s+/g, "").length) return ERROR_CODES.TRUNCATED_MEDIA;
    parts = [x.body];
  } else {
    return ERROR_CODES.TRUNCATED_MEDIA;
  }
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const b = String(parts[i]).replace(/\s+/g, "");
    if (b.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b)) return ERROR_CODES.BAD_ENVELOPE;
    const part = decodeBase64Ascii(b);
    if (!part) return ERROR_CODES.BAD_ENVELOPE;
    total += part.length;
  }
  if (typeof x.byteLength === "number" && Number.isFinite(x.byteLength) && total !== x.byteLength) return ERROR_CODES.BAD_ENVELOPE;
  return null;
}

function toBytes(x) {
  if (x == null) return null;
  try {
    if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(x)) {
      if (x instanceof Uint8Array) return x;
      return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
    }
    if (Array.isArray(x)) {
      if (!x.length) return null;
      for (let i = 0; i < x.length; i++) {
        const n = x[i];
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 255) return null;
      }
      return Uint8Array.from ? Uint8Array.from(x) : new Uint8Array(x);
    }
    if (typeof x === "object") {
      // P2：新桥信封（base64 单体或 256KB 分片）
      if (x.__lxMedia === 2) return decodeMediaEnvelope(x);
      // 旧桥产物：{ type:"Buffer", data:[…] }（真机实测形状）
      const t = String(x.type || "");
      if (/buffer/i.test(t) && Array.isArray(x.data)) return toBytes(x.data);
      if (Array.isArray(x.data)) return toBytes(x.data);
      if (x.data && typeof x.data === "object") return toBytes(x.data);
      return null;
    }
    if (typeof x === "string") {
      const s = x.replace(/\s+/g, "");
      if (s.length < 16 || s.length % 4 !== 0) return null;
      if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
      return decodeBase64Ascii(s);
    }
  } catch (e) { return null; }
  return null;
}

function kindOf(x) {
  if (x == null) return "unknown";
  const bytes = toBytes(x);
  if (bytes) {
    if (!bytes.length || bytes.length < 16) return "empty";
    const info = sniffAudioBytes(bytes, {}, bytes.length);
    if (info && info.kind) return info.kind; // audio/playlist/html/json/empty/unknown
    return "unknown";
  }
  if (typeof x === "string") {
    const s = x.trim();
    if (s.indexOf("#EXTM3U") === 0) return "playlist";
    if (s.indexOf("<") === 0) return "html";
    if (s.indexOf("{") === 0 || s.indexOf("[") === 0) return "json";
    // 既不是 base64、又不是 JSON/HTML/播放列表，而且短到不足 16 字节：不可能是音频体
    return s.length < 16 ? "empty" : "unknown";
  }
  if (typeof x === "object") {
    if (x.code !== undefined || x.msg !== undefined || x.error !== undefined || x.url !== undefined) return "json";
    return "unknown";
  }
  return "unknown";
}

function totalBytesOf(delivery) {
  if (!delivery) return 0;
  if (delivery.totalBytes) return Number(delivery.totalBytes) || 0;
  const h = delivery.headers || {};
  const cr = String(h["content-range"] || "");
  const m = cr.match(/\/\s*(\d+)/);
  if (m) return parseInt(m[1], 10) || 0;
  return parseInt(String(h["content-length"] || "0"), 10) || 0;
}

module.exports = {
  parseFlacDuration,
  parseMp3Info,
  parseMpegFrameHeader,
  u32At,
  asciiAt,
  bAt,
  MPEG_BR_V1_L3,
  MPEG_BR_V2_L3,
  MPEG_SR_V1,
  MPEG_SR_V2,
  MPEG_SR_V25,
  decodeBase64Ascii,
  B64_CHARS,
  decodeMediaEnvelope,
  mediaEnvelopeErrorCode,
  sniffAudioBytes,
  kindOf,
  totalBytesOf,
  toBytes,
};

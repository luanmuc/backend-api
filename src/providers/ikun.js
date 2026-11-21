// ikun: ikun
module.exports = {
  "id": "ikun",
  "name": "ikun",
  "lifecycle": "active",
  "platforms": [
    "kw",
    "wy"
  ],
  "chain": {
    "kw": 7,
    "wy": 5
  },
  "upstreamGroup": "ikun",
  "auth": "optional",
  "maxQuality": "flac",
  // 2026-11-21 实测：kw 到 flac，wy 只到 mp3（320k 档返 audio/mpeg）。
  // 声明成统一 flac 会让 wy 的 flac 请求把 ikun 选进候选、必然降档。
  "maxQualityByPlatform": {
    "wy": "320k"
  },
  "qualitys": [
    "128k",
    "320k",
    "flac"
  ],
  "coldStart": false,
  "reviewAt": null
};

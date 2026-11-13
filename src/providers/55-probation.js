// 观察源：默认关闭、只探测、不进链
module.exports = {
  "suyinQQ": {
    "id": "suyinQQ",
    "name": "溯音QQ",
    "lifecycle": "probation",
    "platforms": [
      "tx"
    ],
    "chain": {},
    "upstreamGroup": "oiapi-qq",
    "auth": "none",
    "maxQuality": "flac",
    "qualitys": [
      "128k",
      "320k",
      "flac"
    ],
    "coldStart": false,
    "reviewAt": "2026-11-19"
  },
  "suyinMigu": {
    "id": "suyinMigu",
    "name": "溯音咪咕",
    "lifecycle": "probation",
    "platforms": [
      "mg"
    ],
    "chain": {},
    "upstreamGroup": "xcvts-migu",
    "auth": "none",
    "maxQuality": "flac",
    "qualitys": [
      "128k",
      "320k",
      "flac"
    ],
    "coldStart": false,
    "reviewAt": "2026-11-26"
  }
};

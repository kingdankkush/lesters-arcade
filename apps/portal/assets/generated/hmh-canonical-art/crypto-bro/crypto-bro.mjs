// Canonical hand-made art manifest for crypto-bro (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_CRYPTO_BRO = Object.freeze({
  "id": "crypto-bro",
  "role": "enemy",
  "frameSize": [
    88,
    88
  ],
  "anchor": "bottom-center",
  "directions": [
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
    "north",
    "north-east"
  ],
  "defaultDirection": "south",
  "targetFps": 60,
  "source": "Justin canonical hand-made art (background-removed, cropped, rescaled)",
  "look": "",
  "stateAliases": {
    "shoot": "attack",
    "melee": "attack"
  },
  "states": {
    "idle": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/crypto-bro/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/idle/idle-01.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/idle/idle-02.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/idle/idle-03.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-04.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/walk/walk-05.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-00.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-01.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-02.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-03.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-04.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/run/run-05.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-01.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-02.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-03.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-04.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-05.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/jump/jump-06.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-00.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-01.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-02.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-03.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-04.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-05.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-06.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-07.png",
          "./assets/generated/hmh-canonical-art/crypto-bro/attack/attack-08.png"
        ]
      }
    }
  }
});

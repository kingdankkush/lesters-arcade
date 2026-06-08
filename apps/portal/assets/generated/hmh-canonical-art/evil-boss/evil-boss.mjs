// Canonical hand-made art manifest for evil-boss (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_EVIL_BOSS = Object.freeze({
  "id": "evil-boss",
  "role": "boss",
  "frameSize": [
    164,
    150
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
          "./assets/generated/hmh-canonical-art/evil-boss/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/evil-boss/idle/idle-01.png",
          "./assets/generated/hmh-canonical-art/evil-boss/idle/idle-02.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-boss/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/evil-boss/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/evil-boss/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/evil-boss/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/evil-boss/walk/walk-04.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-00.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-01.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-02.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-03.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-04.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-05.png",
          "./assets/generated/hmh-canonical-art/evil-boss/run/run-06.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-boss/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/evil-boss/jump/jump-01.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-boss/attack/attack-00.png"
        ]
      }
    }
  }
});

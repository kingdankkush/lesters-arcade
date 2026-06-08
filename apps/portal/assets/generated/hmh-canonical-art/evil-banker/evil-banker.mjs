// Canonical hand-made art manifest for evil-banker (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_EVIL_BANKER = Object.freeze({
  "id": "evil-banker",
  "role": "enemy",
  "frameSize": [
    83,
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
          "./assets/generated/hmh-canonical-art/evil-banker/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/evil-banker/idle/idle-01.png",
          "./assets/generated/hmh-canonical-art/evil-banker/idle/idle-02.png",
          "./assets/generated/hmh-canonical-art/evil-banker/idle/idle-03.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-04.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-05.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-06.png",
          "./assets/generated/hmh-canonical-art/evil-banker/walk/walk-07.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-00.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-01.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-02.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-03.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-04.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-05.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-06.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-07.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-08.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-09.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-10.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-11.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-12.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-13.png",
          "./assets/generated/hmh-canonical-art/evil-banker/run/run-14.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-01.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-02.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-03.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-04.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-05.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-06.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-07.png",
          "./assets/generated/hmh-canonical-art/evil-banker/jump/jump-08.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-00.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-01.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-02.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-03.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-04.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-05.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-06.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-07.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-08.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-09.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-10.png",
          "./assets/generated/hmh-canonical-art/evil-banker/attack/attack-11.png"
        ]
      }
    },
    "health-75": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/health-75/health-75-00.png"
        ]
      }
    },
    "health-50": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/evil-banker/health-50/health-50-00.png"
        ]
      }
    }
  }
});

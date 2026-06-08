// Canonical hand-made art manifest for gas-beast (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_GAS_BEAST = Object.freeze({
  "id": "gas-beast",
  "role": "enemy",
  "frameSize": [
    223,
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
          "./assets/generated/hmh-canonical-art/gas-beast/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/gas-beast/idle/idle-01.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-04.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-05.png",
          "./assets/generated/hmh-canonical-art/gas-beast/walk/walk-06.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-00.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-01.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-02.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-03.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-04.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-05.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-06.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-07.png",
          "./assets/generated/hmh-canonical-art/gas-beast/run/run-08.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-01.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-02.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-03.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-04.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-05.png",
          "./assets/generated/hmh-canonical-art/gas-beast/jump/jump-06.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/gas-beast/attack/attack-00.png",
          "./assets/generated/hmh-canonical-art/gas-beast/attack/attack-01.png",
          "./assets/generated/hmh-canonical-art/gas-beast/attack/attack-02.png",
          "./assets/generated/hmh-canonical-art/gas-beast/attack/attack-03.png"
        ]
      }
    }
  }
});

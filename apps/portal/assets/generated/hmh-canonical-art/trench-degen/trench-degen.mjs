// Canonical hand-made art manifest for trench-degen (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_TRENCH_DEGEN = Object.freeze({
  "id": "trench-degen",
  "role": "enemy",
  "frameSize": [
    69,
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
          "./assets/generated/hmh-canonical-art/trench-degen/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/trench-degen/idle/idle-01.png",
          "./assets/generated/hmh-canonical-art/trench-degen/idle/idle-02.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/trench-degen/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/trench-degen/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/trench-degen/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/trench-degen/walk/walk-04.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-00.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-01.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-02.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-03.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-04.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-05.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-06.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-07.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-08.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-09.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-10.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-11.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-12.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-13.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-14.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-15.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-16.png",
          "./assets/generated/hmh-canonical-art/trench-degen/run/run-17.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-01.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-02.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-03.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-04.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-05.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-06.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-07.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-08.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-09.png",
          "./assets/generated/hmh-canonical-art/trench-degen/jump/jump-10.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-00.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-01.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-02.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-03.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-04.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-05.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-06.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-07.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-08.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-09.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-10.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-11.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-12.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-13.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-14.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-15.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-16.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-17.png",
          "./assets/generated/hmh-canonical-art/trench-degen/attack/attack-18.png"
        ]
      }
    },
    "health-75": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/health-75/health-75-00.png"
        ]
      }
    },
    "health-50": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/health-50/health-50-00.png"
        ]
      }
    },
    "health-25": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/trench-degen/health-25/health-25-00.png"
        ]
      }
    }
  }
});

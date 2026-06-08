// Canonical hand-made art manifest for lester (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_LESTER = Object.freeze({
  "id": "lester",
  "role": "hero",
  "frameSize": [
    79,
    96
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
  "look": "blue spherical head, white Litecoin L logo, two eyes + mouth",
  "stateAliases": {},
  "states": {
    "idle": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/idle/idle-00.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-01.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-02.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-03.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-04.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-05.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-06.png",
          "./assets/generated/hmh-canonical-art/lester/idle/idle-07.png"
        ]
      }
    },
    "walk": {
      "fps": 10,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/walk/walk-00.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-01.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-02.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-03.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-04.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-05.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-06.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-07.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-08.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-09.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-10.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-11.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-12.png",
          "./assets/generated/hmh-canonical-art/lester/walk/walk-13.png"
        ]
      }
    },
    "run": {
      "fps": 14,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/run/run-00.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-01.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-02.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-03.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-04.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-05.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-06.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-07.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-08.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-09.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-10.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-11.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-12.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-13.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-14.png",
          "./assets/generated/hmh-canonical-art/lester/run/run-15.png"
        ]
      }
    },
    "jump": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/jump/jump-00.png",
          "./assets/generated/hmh-canonical-art/lester/jump/jump-01.png"
        ]
      }
    },
    "shoot": {
      "fps": 16,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/shoot/shoot-00.png"
        ]
      }
    },
    "melee": {
      "fps": 16,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/lester/melee/melee-00.png",
          "./assets/generated/hmh-canonical-art/lester/melee/melee-01.png",
          "./assets/generated/hmh-canonical-art/lester/melee/melee-02.png",
          "./assets/generated/hmh-canonical-art/lester/melee/melee-03.png"
        ]
      }
    }
  }
});

// Canonical hand-made art manifest for warren-boss (sprite-pipeline schema).
// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
export const HMH_CANON_WARREN_BOSS = Object.freeze({
  "id": "warren-boss",
  "role": "boss",
  "frameSize": [
    87,
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
  "stateAliases": {},
  "states": {
    "idle": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/warren-boss/idle/idle-00.png"
        ]
      }
    },
    "health-75": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/warren-boss/health-75/health-75-00.png"
        ]
      }
    },
    "health-50": {
      "fps": 6,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-canonical-art/warren-boss/health-50/health-50-00.png"
        ]
      }
    }
  }
});

export const HMH_BONUS_WHALE_DUMPER = Object.freeze({
  "id": "whale-dumper",
  "role": "boss",
  "frameSize": [
    160,
    160
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
  "source": "PixelLab generated bonus enemy (not a canonical character)",
  "stateAliases": {
    "run": "walk",
    "melee-counter": "hit"
  },
  "states": {
    "walk": {
      "fps": 12,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-04.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-05.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/walk/south-06.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-04.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-05.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack/south-06.png"
        ]
      }
    },
    "attack-tell": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack-tell/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack-tell/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack-tell/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack-tell/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/attack-tell/south-04.png"
        ]
      }
    },
    "idle": {
      "fps": 8,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/idle/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/idle/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/idle/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/idle/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/idle/south-04.png"
        ]
      }
    },
    "death": {
      "fps": 12,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-04.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-05.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-06.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-07.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/death/south-08.png"
        ]
      }
    },
    "special": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-00.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-01.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-02.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-03.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-04.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-05.png",
          "./assets/generated/hmh-bonus-enemies/whale-dumper/special/south-06.png"
        ]
      }
    }
  }
});

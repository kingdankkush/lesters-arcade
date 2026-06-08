export const HMH_BONUS_FUD_GOBLIN = Object.freeze({
  "id": "fud-goblin",
  "role": "enemy",
  "frameSize": [
    92,
    92
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
    "death": {
      "fps": 12,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-00.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-01.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-02.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-03.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-04.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-05.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/death/south-06.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack/south-00.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack/south-01.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack/south-02.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack/south-03.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack/south-04.png"
        ]
      }
    },
    "walk": {
      "fps": 12,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-00.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-01.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-02.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-03.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-04.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-05.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/walk/south-06.png"
        ]
      }
    },
    "attack-tell": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack-tell/south-00.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack-tell/south-01.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack-tell/south-02.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack-tell/south-03.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/attack-tell/south-04.png"
        ]
      }
    },
    "idle": {
      "fps": 8,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/fud-goblin/idle/south-00.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/idle/south-01.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/idle/south-02.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/idle/south-03.png",
          "./assets/generated/hmh-bonus-enemies/fud-goblin/idle/south-04.png"
        ]
      }
    }
  }
});

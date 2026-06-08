export const HMH_BONUS_GAS_FEE_WISP = Object.freeze({
  "id": "gas-fee-wisp",
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
    "walk": {
      "fps": 12,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-00.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-01.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-02.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-03.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-04.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-05.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/walk/south-06.png"
        ]
      }
    },
    "death": {
      "fps": 12,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-00.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-01.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-02.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-03.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-04.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-05.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/death/south-06.png"
        ]
      }
    },
    "attack-tell": {
      "fps": 10,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack-tell/south-00.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack-tell/south-01.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack-tell/south-02.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack-tell/south-03.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack-tell/south-04.png"
        ]
      }
    },
    "idle": {
      "fps": 8,
      "loop": true,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/idle/south-00.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/idle/south-01.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/idle/south-02.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/idle/south-03.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/idle/south-04.png"
        ]
      }
    },
    "attack": {
      "fps": 14,
      "loop": false,
      "frames": {
        "south": [
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack/south-00.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack/south-01.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack/south-02.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack/south-03.png",
          "./assets/generated/hmh-bonus-enemies/gas-fee-wisp/attack/south-04.png"
        ]
      }
    }
  }
});

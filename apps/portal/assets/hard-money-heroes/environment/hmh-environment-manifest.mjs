export const HMH_ENVIRONMENT_ASSET_MANIFEST = Object.freeze({
  "id": "hard-money-heroes-level1-environment-assets-v1",
  "generatedFrom": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets",
  "inventory": "docs/game-design/hard-money-heroes-environment-asset-inventory.json",
  "contactSheets": [
    "docs/game-design/hmh-environment-contact-sheets/sheet-01.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-02.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-03.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-04.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-05.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-06.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-07.png",
    "docs/game-design/hmh-environment-contact-sheets/sheet-08.png"
  ],
  "assetCount": 148,
  "runtimeAssetCount": 148,
  "stageOrder": [
    "desert_approach",
    "ghost_town",
    "country_road",
    "residential_edge",
    "inner_city"
  ],
  "levelOneStages": [
    {
      "id": "desert_approach",
      "title": "Stage 1-2 // Desert Rocky Mountain Approach",
      "stageRange": [
        1,
        2
      ],
      "narrativeRole": "open the level outside Litecoin City with hot desert, rocky mountains, cactus silhouettes, dust, and long approach roads",
      "palette": [
        "#2d160c",
        "#7b3f1d",
        "#d88945",
        "#f6c66f",
        "#4b6a7c"
      ],
      "ambient": [
        "heat-shimmer",
        "dust-motes",
        "cactus-wind-sway"
      ],
      "propMood": "rocks, cactus shapes, mine-town signs, low ruined cover",
      "assetCount": 42,
      "layerCount": 4,
      "propCount": 3,
      "layers": [
        {
          "id": "desert_approach-distant-skyline",
          "role": "background",
          "y": 0,
          "h": 128,
          "speed": 0.1,
          "opacity": 0.88,
          "animation": "slow-drift",
          "assetId": "env-001-03-23-57-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-001-03-23-57-pm.png",
          "sourceIndex": 1,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_23_57 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "desert_approach-far-midground",
          "role": "parallax",
          "y": 62,
          "h": 150,
          "speed": 0.22,
          "opacity": 0.92,
          "animation": "heat-or-haze",
          "assetId": "env-015-03-29-11-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-015-03-29-11-pm.png",
          "sourceIndex": 15,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_29_11 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "desert_approach-near-buildings",
          "role": "parallax",
          "y": 122,
          "h": 152,
          "speed": 0.44,
          "opacity": 0.98,
          "animation": "ambient-flicker",
          "assetId": "env-039-03-39-37-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-039-03-39-37-pm.png",
          "sourceIndex": 39,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_39_37 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "desert_approach-ground-street",
          "role": "road-ground",
          "y": 214,
          "h": 116,
          "speed": 0.82,
          "opacity": 1.0,
          "animation": "ground-scroll",
          "assetId": "env-042-03-41-13-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-042-03-41-13-pm.png",
          "sourceIndex": 42,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_41_13 PM.png",
          "naturalSize": [
            373,
            560
          ]
        }
      ],
      "props": [
        {
          "id": "desert_approach-prop-1",
          "assetId": "env-034-03-36-49-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-034-03-36-49-pm.png",
          "sourceIndex": 34,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_36_49 PM.png",
          "role": "ambient-structure-prop",
          "naturalSize": [
            512,
            512
          ],
          "draw": {
            "width": 168,
            "height": 168,
            "groundOffset": 8,
            "spacing": 260,
            "slotOffset": 118,
            "scrollSpeed": 0.34
          },
          "animation": "heat-shimmer-and-cactus-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "desert_approach-prop-2",
          "assetId": "env-030-03-35-24-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-030-03-35-24-pm.png",
          "sourceIndex": 30,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_35_24 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            640,
            480
          ],
          "draw": {
            "width": 157,
            "height": 118,
            "groundOffset": 12,
            "spacing": 316,
            "slotOffset": 212,
            "scrollSpeed": 0.39
          },
          "animation": "heat-shimmer-and-cactus-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "desert_approach-prop-3",
          "assetId": "env-042-03-41-13-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-042-03-41-13-pm.png",
          "sourceIndex": 42,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_41_13 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            373,
            560
          ],
          "draw": {
            "width": 79,
            "height": 118,
            "groundOffset": 8,
            "spacing": 372,
            "slotOffset": 306,
            "scrollSpeed": 0.44
          },
          "animation": "heat-shimmer-and-cactus-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        }
      ],
      "ground": {
        "y": 276,
        "roadColor": "#7b3f1d",
        "stripeColor": "#e8a94f",
        "dustColor": "#d88945"
      },
      "proportionGuide": {
        "heroDrawSize": [
          104,
          104
        ],
        "enemyDrawSize": [
          78,
          78
        ],
        "buildingPropHeightRange": [
          118,
          168
        ],
        "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable"
      }
    },
    {
      "id": "ghost_town",
      "title": "Stage 3-5 // Ghost Town Main Street",
      "stageRange": [
        3,
        5
      ],
      "narrativeRole": "push through the abandoned frontier town: saloons, sheriff/bank facades, wooden porches, lamps, and shootout cover",
      "palette": [
        "#1f1714",
        "#6c3f25",
        "#b87945",
        "#f1b15a",
        "#17253b"
      ],
      "ambient": [
        "lantern-flicker",
        "dust-motes",
        "loose-sign-sway"
      ],
      "propMood": "saloon boards, banks, lamps, wooden cover, haunted town facades",
      "assetCount": 36,
      "layerCount": 4,
      "propCount": 3,
      "layers": [
        {
          "id": "ghost_town-distant-skyline",
          "role": "background",
          "y": 0,
          "h": 128,
          "speed": 0.1,
          "opacity": 0.88,
          "animation": "slow-drift",
          "assetId": "env-062-03-56-31-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-062-03-56-31-pm.png",
          "sourceIndex": 62,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_56_31 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "ghost_town-far-midground",
          "role": "parallax",
          "y": 62,
          "h": 150,
          "speed": 0.22,
          "opacity": 0.92,
          "animation": "heat-or-haze",
          "assetId": "env-076-04-03-07-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-076-04-03-07-pm.png",
          "sourceIndex": 76,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_03_07 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "ghost_town-near-buildings",
          "role": "parallax",
          "y": 122,
          "h": 152,
          "speed": 0.44,
          "opacity": 0.98,
          "animation": "ambient-flicker",
          "assetId": "env-055-03-53-58-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-055-03-53-58-pm.png",
          "sourceIndex": 55,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_53_58 PM.png",
          "naturalSize": [
            640,
            480
          ]
        },
        {
          "id": "ghost_town-ground-street",
          "role": "road-ground",
          "y": 214,
          "h": 116,
          "speed": 0.82,
          "opacity": 1.0,
          "animation": "ground-scroll",
          "assetId": "env-073-04-02-22-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-073-04-02-22-pm.png",
          "sourceIndex": 73,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_02_22 PM.png",
          "naturalSize": [
            512,
            341
          ]
        }
      ],
      "props": [
        {
          "id": "ghost_town-prop-1",
          "assetId": "env-059-03-54-15-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-059-03-54-15-pm.png",
          "sourceIndex": 59,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_54_15 PM.png",
          "role": "ambient-structure-prop",
          "naturalSize": [
            512,
            341
          ],
          "draw": {
            "width": 240,
            "height": 160,
            "groundOffset": 8,
            "spacing": 260,
            "slotOffset": 118,
            "scrollSpeed": 0.34
          },
          "animation": "lantern-flicker-and-sign-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "ghost_town-prop-2",
          "assetId": "env-043-03-42-02-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-043-03-42-02-pm.png",
          "sourceIndex": 43,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_42_02 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            373,
            560
          ],
          "draw": {
            "width": 79,
            "height": 118,
            "groundOffset": 12,
            "spacing": 316,
            "slotOffset": 212,
            "scrollSpeed": 0.39
          },
          "animation": "lantern-flicker-and-sign-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "ghost_town-prop-3",
          "assetId": "env-044-03-42-37-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-044-03-42-37-pm.png",
          "sourceIndex": 44,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 03_42_37 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            820,
            410
          ],
          "draw": {
            "width": 236,
            "height": 118,
            "groundOffset": 8,
            "spacing": 372,
            "slotOffset": 306,
            "scrollSpeed": 0.44
          },
          "animation": "lantern-flicker-and-sign-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        }
      ],
      "ground": {
        "y": 276,
        "roadColor": "#6c3f25",
        "stripeColor": "#e8a94f",
        "dustColor": "#b87945"
      },
      "proportionGuide": {
        "heroDrawSize": [
          104,
          104
        ],
        "enemyDrawSize": [
          78,
          78
        ],
        "buildingPropHeightRange": [
          118,
          168
        ],
        "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable"
      }
    },
    {
      "id": "country_road",
      "title": "Stage 6-8 // Country Road Cutback",
      "stageRange": [
        6,
        8
      ],
      "narrativeRole": "leave town, re-enter countryside roads, trees, fences, scrub, and vehicle lanes before the city edge",
      "palette": [
        "#172018",
        "#2f4a2e",
        "#8b6a3c",
        "#d6a45e",
        "#6e8a79"
      ],
      "ambient": [
        "tree-wind-sway",
        "grass-bob",
        "road-dust"
      ],
      "propMood": "trees, road barriers, fences, shrubs, roadside cover",
      "assetCount": 26,
      "layerCount": 4,
      "propCount": 3,
      "layers": [
        {
          "id": "country_road-distant-skyline",
          "role": "background",
          "y": 0,
          "h": 128,
          "speed": 0.1,
          "opacity": 0.88,
          "animation": "slow-drift",
          "assetId": "env-079-04-03-49-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-079-04-03-49-pm.png",
          "sourceIndex": 79,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_03_49 PM.png",
          "naturalSize": [
            960,
            240
          ]
        },
        {
          "id": "country_road-far-midground",
          "role": "parallax",
          "y": 62,
          "h": 150,
          "speed": 0.22,
          "opacity": 0.92,
          "animation": "heat-or-haze",
          "assetId": "env-093-04-14-46-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-093-04-14-46-pm.png",
          "sourceIndex": 93,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_14_46 PM.png",
          "naturalSize": [
            960,
            240
          ]
        },
        {
          "id": "country_road-near-buildings",
          "role": "parallax",
          "y": 122,
          "h": 152,
          "speed": 0.44,
          "opacity": 0.98,
          "animation": "ambient-flicker",
          "assetId": "env-095-04-15-11-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-095-04-15-11-pm.png",
          "sourceIndex": 95,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_15_11 PM.png",
          "naturalSize": [
            640,
            640
          ]
        },
        {
          "id": "country_road-ground-street",
          "role": "road-ground",
          "y": 214,
          "h": 116,
          "speed": 0.82,
          "opacity": 1.0,
          "animation": "ground-scroll",
          "assetId": "env-096-04-15-23-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-096-04-15-23-pm.png",
          "sourceIndex": 96,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_15_23 PM.png",
          "naturalSize": [
            341,
            512
          ]
        }
      ],
      "props": [
        {
          "id": "country_road-prop-1",
          "assetId": "env-096-04-15-23-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-096-04-15-23-pm.png",
          "sourceIndex": 96,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_15_23 PM.png",
          "role": "ambient-structure-prop",
          "naturalSize": [
            341,
            512
          ],
          "draw": {
            "width": 112,
            "height": 168,
            "groundOffset": 8,
            "spacing": 260,
            "slotOffset": 118,
            "scrollSpeed": 0.34
          },
          "animation": "tree-and-bush-wind-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "country_road-prop-2",
          "assetId": "env-092-04-14-36-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-092-04-14-36-pm.png",
          "sourceIndex": 92,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_14_36 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            373,
            560
          ],
          "draw": {
            "width": 79,
            "height": 118,
            "groundOffset": 12,
            "spacing": 316,
            "slotOffset": 212,
            "scrollSpeed": 0.39
          },
          "animation": "tree-and-bush-wind-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "country_road-prop-3",
          "assetId": "env-082-04-04-38-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/country_road/env-082-04-04-38-pm.png",
          "sourceIndex": 82,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_04_38 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            820,
            547
          ],
          "draw": {
            "width": 177,
            "height": 118,
            "groundOffset": 8,
            "spacing": 372,
            "slotOffset": 306,
            "scrollSpeed": 0.44
          },
          "animation": "tree-and-bush-wind-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        }
      ],
      "ground": {
        "y": 276,
        "roadColor": "#2f4a2e",
        "stripeColor": "#ffe84d",
        "dustColor": "#8b6a3c"
      },
      "proportionGuide": {
        "heroDrawSize": [
          104,
          104
        ],
        "enemyDrawSize": [
          78,
          78
        ],
        "buildingPropHeightRange": [
          118,
          168
        ],
        "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable"
      }
    },
    {
      "id": "residential_edge",
      "title": "Stage 9-10 // Residential Edge",
      "stageRange": [
        9,
        10
      ],
      "narrativeRole": "suburban edge of Litecoin City: houses, yards, parked-car cover, power poles, and neighborhood lights",
      "palette": [
        "#111827",
        "#29465a",
        "#8f6a3d",
        "#d2a15f",
        "#84c7d5"
      ],
      "ambient": [
        "window-light-flicker",
        "bush-wind-sway",
        "porch-lamp-glow"
      ],
      "propMood": "houses, porches, shrubs, street lamps, residential cover",
      "assetCount": 22,
      "layerCount": 4,
      "propCount": 3,
      "layers": [
        {
          "id": "residential_edge-distant-skyline",
          "role": "background",
          "y": 0,
          "h": 128,
          "speed": 0.1,
          "opacity": 0.88,
          "animation": "slow-drift",
          "assetId": "env-107-04-18-33-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-107-04-18-33-pm.png",
          "sourceIndex": 107,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_18_33 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "residential_edge-far-midground",
          "role": "parallax",
          "y": 62,
          "h": 150,
          "speed": 0.22,
          "opacity": 0.92,
          "animation": "heat-or-haze",
          "assetId": "env-122-04-22-30-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-122-04-22-30-pm.png",
          "sourceIndex": 122,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_22_30 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "residential_edge-near-buildings",
          "role": "parallax",
          "y": 122,
          "h": 152,
          "speed": 0.44,
          "opacity": 0.98,
          "animation": "ambient-flicker",
          "assetId": "env-120-04-21-57-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-120-04-21-57-pm.png",
          "sourceIndex": 120,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_21_57 PM.png",
          "naturalSize": [
            640,
            480
          ]
        },
        {
          "id": "residential_edge-ground-street",
          "role": "road-ground",
          "y": 214,
          "h": 116,
          "speed": 0.82,
          "opacity": 1.0,
          "animation": "ground-scroll",
          "assetId": "env-123-04-22-41-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-123-04-22-41-pm.png",
          "sourceIndex": 123,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_22_41 PM.png",
          "naturalSize": [
            512,
            341
          ]
        }
      ],
      "props": [
        {
          "id": "residential_edge-prop-1",
          "assetId": "env-105-04-18-04-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-105-04-18-04-pm.png",
          "sourceIndex": 105,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_18_04 PM.png",
          "role": "ambient-structure-prop",
          "naturalSize": [
            512,
            341
          ],
          "draw": {
            "width": 240,
            "height": 160,
            "groundOffset": 8,
            "spacing": 260,
            "slotOffset": 118,
            "scrollSpeed": 0.34
          },
          "animation": "window-flicker-and-bush-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "residential_edge-prop-2",
          "assetId": "env-106-04-18-17-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-106-04-18-17-pm.png",
          "sourceIndex": 106,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_18_17 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            640,
            480
          ],
          "draw": {
            "width": 157,
            "height": 118,
            "groundOffset": 12,
            "spacing": 316,
            "slotOffset": 212,
            "scrollSpeed": 0.39
          },
          "animation": "window-flicker-and-bush-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "residential_edge-prop-3",
          "assetId": "env-121-04-22-15-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-121-04-22-15-pm.png",
          "sourceIndex": 121,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_22_15 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            820,
            461
          ],
          "draw": {
            "width": 210,
            "height": 118,
            "groundOffset": 8,
            "spacing": 372,
            "slotOffset": 306,
            "scrollSpeed": 0.44
          },
          "animation": "window-flicker-and-bush-sway",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        }
      ],
      "ground": {
        "y": 276,
        "roadColor": "#29465a",
        "stripeColor": "#e8a94f",
        "dustColor": "#8f6a3d"
      },
      "proportionGuide": {
        "heroDrawSize": [
          104,
          104
        ],
        "enemyDrawSize": [
          78,
          78
        ],
        "buildingPropHeightRange": [
          118,
          168
        ],
        "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable"
      }
    },
    {
      "id": "inner_city",
      "title": "Stage 11-13 // Inner City Boss Push",
      "stageRange": [
        11,
        13
      ],
      "narrativeRole": "dense inner-city run-up where old frontier dust becomes neon financial panic, billboards, towers, and boss pressure",
      "palette": [
        "#050913",
        "#14244a",
        "#345dcc",
        "#19f7ff",
        "#ff7b2f"
      ],
      "ambient": [
        "neon-flicker",
        "sign-spark",
        "window-light-pulse"
      ],
      "propMood": "downtown buildings, streetlights, signs, parked cars, billboard cover",
      "assetCount": 22,
      "layerCount": 4,
      "propCount": 3,
      "layers": [
        {
          "id": "inner_city-distant-skyline",
          "role": "background",
          "y": 0,
          "h": 128,
          "speed": 0.1,
          "opacity": 0.88,
          "animation": "slow-drift",
          "assetId": "env-127-04-24-12-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-127-04-24-12-pm.png",
          "sourceIndex": 127,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_24_12 PM.png",
          "naturalSize": [
            960,
            320
          ]
        },
        {
          "id": "inner_city-far-midground",
          "role": "parallax",
          "y": 62,
          "h": 150,
          "speed": 0.22,
          "opacity": 0.92,
          "animation": "heat-or-haze",
          "assetId": "env-138-04-28-53-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-138-04-28-53-pm.png",
          "sourceIndex": 138,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_28_53 PM.png",
          "naturalSize": [
            820,
            461
          ]
        },
        {
          "id": "inner_city-near-buildings",
          "role": "parallax",
          "y": 122,
          "h": 152,
          "speed": 0.44,
          "opacity": 0.98,
          "animation": "ambient-flicker",
          "assetId": "env-140-04-29-50-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-140-04-29-50-pm.png",
          "sourceIndex": 140,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_29_50 PM.png",
          "naturalSize": [
            640,
            480
          ]
        },
        {
          "id": "inner_city-ground-street",
          "role": "road-ground",
          "y": 214,
          "h": 116,
          "speed": 0.82,
          "opacity": 1.0,
          "animation": "ground-scroll",
          "assetId": "env-134-04-27-30-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-134-04-27-30-pm.png",
          "sourceIndex": 134,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_27_30 PM.png",
          "naturalSize": [
            448,
            560
          ]
        }
      ],
      "props": [
        {
          "id": "inner_city-prop-1",
          "assetId": "env-129-04-25-56-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-129-04-25-56-pm.png",
          "sourceIndex": 129,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_25_56 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            640,
            480
          ],
          "draw": {
            "width": 157,
            "height": 118,
            "groundOffset": 8,
            "spacing": 260,
            "slotOffset": 118,
            "scrollSpeed": 0.34
          },
          "animation": "neon-flicker-and-sign-spark",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "inner_city-prop-2",
          "assetId": "env-148-04-33-20-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-148-04-33-20-pm.png",
          "sourceIndex": 148,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_33_20 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            640,
            640
          ],
          "draw": {
            "width": 118,
            "height": 118,
            "groundOffset": 12,
            "spacing": 316,
            "slotOffset": 212,
            "scrollSpeed": 0.39
          },
          "animation": "neon-flicker-and-sign-spark",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        },
        {
          "id": "inner_city-prop-3",
          "assetId": "env-142-04-30-03-pm",
          "src": "./assets/hard-money-heroes/environment/runtime/inner_city/env-142-04-30-03-pm.png",
          "sourceIndex": 142,
          "sourceFilename": "ChatGPT Image Jun 6, 2026, 04_30_03 PM.png",
          "role": "scenic-prop-card",
          "naturalSize": [
            820,
            410
          ],
          "draw": {
            "width": 236,
            "height": 118,
            "groundOffset": 8,
            "spacing": 372,
            "slotOffset": 306,
            "scrollSpeed": 0.44
          },
          "animation": "neon-flicker-and-sign-spark",
          "collision": "visual-only; gameplay cover props remain deterministic combat objects"
        }
      ],
      "ground": {
        "y": 276,
        "roadColor": "#14244a",
        "stripeColor": "#ffe84d",
        "dustColor": "#345dcc"
      },
      "proportionGuide": {
        "heroDrawSize": [
          104,
          104
        ],
        "enemyDrawSize": [
          78,
          78
        ],
        "buildingPropHeightRange": [
          118,
          168
        ],
        "bossArenaBackdrops": "drawn behind collision props so Warren/boss sprites stay foreground-readable"
      }
    }
  ],
  "assets": [
    {
      "id": "env-001-03-23-57-pm",
      "index": 1,
      "filename": "ChatGPT Image Jun 6, 2026, 03_23_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_23_57 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        201,
        200,
        151
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-001-03-23-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-001-03-23-57-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-002-03-24-02-pm",
      "index": 2,
      "filename": "ChatGPT Image Jun 6, 2026, 03_24_02 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_24_02 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        243,
        230,
        226
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-002-03-24-02-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-002-03-24-02-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-003-03-24-07-pm",
      "index": 3,
      "filename": "ChatGPT Image Jun 6, 2026, 03_24_07 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_24_07 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        210,
        182,
        168
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-003-03-24-07-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-003-03-24-07-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-004-03-24-13-pm",
      "index": 4,
      "filename": "ChatGPT Image Jun 6, 2026, 03_24_13 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_24_13 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        224,
        220,
        215
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-004-03-24-13-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-004-03-24-13-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-005-03-24-39-pm",
      "index": 5,
      "filename": "ChatGPT Image Jun 6, 2026, 03_24_39 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_24_39 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        187,
        177,
        169
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-005-03-24-39-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-005-03-24-39-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-006-03-25-07-pm",
      "index": 6,
      "filename": "ChatGPT Image Jun 6, 2026, 03_25_07 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_25_07 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        201,
        184,
        173
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-006-03-25-07-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-006-03-25-07-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-007-03-26-13-pm",
      "index": 7,
      "filename": "ChatGPT Image Jun 6, 2026, 03_26_13 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_26_13 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        221,
        216,
        209
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-007-03-26-13-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-007-03-26-13-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-008-03-26-50-pm",
      "index": 8,
      "filename": "ChatGPT Image Jun 6, 2026, 03_26_50 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_26_50 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        187,
        179,
        172
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-008-03-26-50-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-008-03-26-50-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-009-03-27-25-pm",
      "index": 9,
      "filename": "ChatGPT Image Jun 6, 2026, 03_27_25 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_27_25 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        189,
        168,
        155
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-009-03-27-25-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-009-03-27-25-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-010-03-28-19-pm",
      "index": 10,
      "filename": "ChatGPT Image Jun 6, 2026, 03_28_19 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_28_19 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        203,
        191,
        120
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-010-03-28-19-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-010-03-28-19-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-011-03-28-30-pm",
      "index": 11,
      "filename": "ChatGPT Image Jun 6, 2026, 03_28_30 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_28_30 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        231,
        222,
        220
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-011-03-28-30-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-011-03-28-30-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-012-03-28-34-pm",
      "index": 12,
      "filename": "ChatGPT Image Jun 6, 2026, 03_28_34 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_28_34 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        216,
        187,
        173
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-012-03-28-34-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-012-03-28-34-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-013-03-28-38-pm",
      "index": 13,
      "filename": "ChatGPT Image Jun 6, 2026, 03_28_38 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_28_38 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        219,
        218,
        213
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-013-03-28-38-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-013-03-28-38-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-014-03-28-42-pm",
      "index": 14,
      "filename": "ChatGPT Image Jun 6, 2026, 03_28_42 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_28_42 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        212,
        204,
        194
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-014-03-28-42-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-014-03-28-42-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-015-03-29-11-pm",
      "index": 15,
      "filename": "ChatGPT Image Jun 6, 2026, 03_29_11 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_29_11 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        199,
        174,
        161
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-015-03-29-11-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-015-03-29-11-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-016-03-29-16-pm",
      "index": 16,
      "filename": "ChatGPT Image Jun 6, 2026, 03_29_16 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_29_16 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        214,
        164,
        92
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-016-03-29-16-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-016-03-29-16-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-017-03-30-31-pm",
      "index": 17,
      "filename": "ChatGPT Image Jun 6, 2026, 03_30_31 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_30_31 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        213,
        205,
        196
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-017-03-30-31-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-017-03-30-31-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-018-03-31-16-pm",
      "index": 18,
      "filename": "ChatGPT Image Jun 6, 2026, 03_31_16 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_31_16 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        219,
        190,
        176
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-018-03-31-16-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-018-03-31-16-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-019-03-31-20-pm",
      "index": 19,
      "filename": "ChatGPT Image Jun 6, 2026, 03_31_20 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_31_20 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        232,
        222,
        221
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-019-03-31-20-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-019-03-31-20-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-020-03-31-24-pm",
      "index": 20,
      "filename": "ChatGPT Image Jun 6, 2026, 03_31_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_31_24 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        91,
        71,
        118
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-020-03-31-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-020-03-31-24-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-021-03-31-45-pm",
      "index": 21,
      "filename": "ChatGPT Image Jun 6, 2026, 03_31_45 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_31_45 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        219,
        219,
        213
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-021-03-31-45-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-021-03-31-45-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-022-03-31-51-pm",
      "index": 22,
      "filename": "ChatGPT Image Jun 6, 2026, 03_31_51 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_31_51 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        191,
        170,
        154
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-022-03-31-51-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-022-03-31-51-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-023-03-32-57-pm",
      "index": 23,
      "filename": "ChatGPT Image Jun 6, 2026, 03_32_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_32_57 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        208,
        200,
        190
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-023-03-32-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-023-03-32-57-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-024-03-33-30-pm",
      "index": 24,
      "filename": "ChatGPT Image Jun 6, 2026, 03_33_30 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_33_30 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        222,
        218,
        215
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-024-03-33-30-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-024-03-33-30-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-025-03-33-53-pm",
      "index": 25,
      "filename": "ChatGPT Image Jun 6, 2026, 03_33_53 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_33_53 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        204,
        188,
        180
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-025-03-33-53-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-025-03-33-53-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-026-03-34-17-pm",
      "index": 26,
      "filename": "ChatGPT Image Jun 6, 2026, 03_34_17 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_34_17 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        173,
        171,
        163
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-026-03-34-17-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-026-03-34-17-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-027-03-34-33-pm",
      "index": 27,
      "filename": "ChatGPT Image Jun 6, 2026, 03_34_33 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_34_33 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        181,
        175,
        170
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-027-03-34-33-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-027-03-34-33-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-028-03-34-50-pm",
      "index": 28,
      "filename": "ChatGPT Image Jun 6, 2026, 03_34_50 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_34_50 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        153,
        136,
        129
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-028-03-34-50-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-028-03-34-50-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-029-03-35-13-pm",
      "index": 29,
      "filename": "ChatGPT Image Jun 6, 2026, 03_35_13 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_35_13 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        224,
        220,
        217
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-029-03-35-13-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-029-03-35-13-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-030-03-35-24-pm",
      "index": 30,
      "filename": "ChatGPT Image Jun 6, 2026, 03_35_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_35_24 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        205,
        203,
        199
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-030-03-35-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-030-03-35-24-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-031-03-35-53-pm",
      "index": 31,
      "filename": "ChatGPT Image Jun 6, 2026, 03_35_53 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_35_53 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        194,
        187,
        177
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-031-03-35-53-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-031-03-35-53-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-032-03-36-23-pm",
      "index": 32,
      "filename": "ChatGPT Image Jun 6, 2026, 03_36_23 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_36_23 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        220,
        217,
        213
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-032-03-36-23-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-032-03-36-23-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-033-03-36-43-pm",
      "index": 33,
      "filename": "ChatGPT Image Jun 6, 2026, 03_36_43 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_36_43 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        153,
        151,
        146
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-033-03-36-43-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-033-03-36-43-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-034-03-36-49-pm",
      "index": 34,
      "filename": "ChatGPT Image Jun 6, 2026, 03_36_49 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_36_49 PM.png",
      "width": 1024,
      "height": 1024,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 638389,
      "opaquePixels": 410187,
      "alphaCoverage": 0.3912,
      "alphaBBox": [
        80,
        55,
        928,
        954
      ],
      "averageRgb": [
        111,
        82,
        54
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 512,
      "runtimeHeight": 512,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-034-03-36-49-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-034-03-36-49-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-035-03-37-22-pm",
      "index": 35,
      "filename": "ChatGPT Image Jun 6, 2026, 03_37_22 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_37_22 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        206,
        196,
        185
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-035-03-37-22-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-035-03-37-22-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-036-03-37-53-pm",
      "index": 36,
      "filename": "ChatGPT Image Jun 6, 2026, 03_37_53 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_37_53 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        193,
        190,
        182
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-036-03-37-53-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-036-03-37-53-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-037-03-38-16-pm",
      "index": 37,
      "filename": "ChatGPT Image Jun 6, 2026, 03_38_16 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_38_16 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        202,
        195,
        186
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-037-03-38-16-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-037-03-38-16-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-038-03-38-36-pm",
      "index": 38,
      "filename": "ChatGPT Image Jun 6, 2026, 03_38_36 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_38_36 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        222,
        218,
        214
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-038-03-38-36-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-038-03-38-36-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-039-03-39-37-pm",
      "index": 39,
      "filename": "ChatGPT Image Jun 6, 2026, 03_39_37 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_39_37 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        229,
        226,
        223
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-039-03-39-37-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-039-03-39-37-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-040-03-39-42-pm",
      "index": 40,
      "filename": "ChatGPT Image Jun 6, 2026, 03_39_42 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_39_42 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        214,
        201,
        183
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-040-03-39-42-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-040-03-39-42-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-041-03-40-06-pm",
      "index": 41,
      "filename": "ChatGPT Image Jun 6, 2026, 03_40_06 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_40_06 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        205,
        193,
        181
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-041-03-40-06-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-041-03-40-06-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-042-03-41-13-pm",
      "index": 42,
      "filename": "ChatGPT Image Jun 6, 2026, 03_41_13 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_41_13 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        176,
        165,
        156
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "desert_approach",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/desert_approach/env-042-03-41-13-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/desert_approach/env-042-03-41-13-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-043-03-42-02-pm",
      "index": 43,
      "filename": "ChatGPT Image Jun 6, 2026, 03_42_02 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_42_02 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        207,
        203,
        199
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-043-03-42-02-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-043-03-42-02-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-044-03-42-37-pm",
      "index": 44,
      "filename": "ChatGPT Image Jun 6, 2026, 03_42_37 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_42_37 PM.png",
      "width": 1774,
      "height": 887,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573538,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1774,
        887
      ],
      "averageRgb": [
        206,
        202,
        195
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 820,
      "runtimeHeight": 410,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-044-03-42-37-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-044-03-42-37-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-045-03-42-48-pm",
      "index": 45,
      "filename": "ChatGPT Image Jun 6, 2026, 03_42_48 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_42_48 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        208,
        196,
        182
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-045-03-42-48-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-045-03-42-48-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-046-03-42-56-pm",
      "index": 46,
      "filename": "ChatGPT Image Jun 6, 2026, 03_42_56 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_42_56 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        177,
        163,
        149
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-046-03-42-56-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-046-03-42-56-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-047-03-43-41-pm",
      "index": 47,
      "filename": "ChatGPT Image Jun 6, 2026, 03_43_41 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_43_41 PM.png",
      "width": 1086,
      "height": 1448,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1086,
        1448
      ],
      "averageRgb": [
        202,
        196,
        190
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 420,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-047-03-43-41-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-047-03-43-41-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-048-03-43-51-pm",
      "index": 48,
      "filename": "ChatGPT Image Jun 6, 2026, 03_43_51 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_43_51 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        207,
        202,
        197
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-048-03-43-51-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-048-03-43-51-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-049-03-43-55-pm",
      "index": 49,
      "filename": "ChatGPT Image Jun 6, 2026, 03_43_55 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_43_55 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        131,
        112,
        97
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-049-03-43-55-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-049-03-43-55-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-050-03-43-59-pm",
      "index": 50,
      "filename": "ChatGPT Image Jun 6, 2026, 03_43_59 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_43_59 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        149,
        135,
        125
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-050-03-43-59-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-050-03-43-59-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-051-03-44-04-pm",
      "index": 51,
      "filename": "ChatGPT Image Jun 6, 2026, 03_44_04 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_44_04 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        162,
        146,
        132
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-051-03-44-04-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-051-03-44-04-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-052-03-44-08-pm",
      "index": 52,
      "filename": "ChatGPT Image Jun 6, 2026, 03_44_08 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_44_08 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        190,
        174,
        159
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-052-03-44-08-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-052-03-44-08-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-053-03-50-02-pm",
      "index": 53,
      "filename": "ChatGPT Image Jun 6, 2026, 03_50_02 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_50_02 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        219,
        212,
        198
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-053-03-50-02-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-053-03-50-02-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-054-03-53-55-pm",
      "index": 54,
      "filename": "ChatGPT Image Jun 6, 2026, 03_53_55 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_53_55 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        151,
        136,
        129
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-054-03-53-55-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-054-03-53-55-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-055-03-53-58-pm",
      "index": 55,
      "filename": "ChatGPT Image Jun 6, 2026, 03_53_58 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_53_58 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        176,
        165,
        156
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-055-03-53-58-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-055-03-53-58-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-056-03-54-02-pm",
      "index": 56,
      "filename": "ChatGPT Image Jun 6, 2026, 03_54_02 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_54_02 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        155,
        139,
        130
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-056-03-54-02-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-056-03-54-02-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-057-03-54-05-pm",
      "index": 57,
      "filename": "ChatGPT Image Jun 6, 2026, 03_54_05 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_54_05 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        166,
        153,
        142
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-057-03-54-05-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-057-03-54-05-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-058-03-54-11-pm",
      "index": 58,
      "filename": "ChatGPT Image Jun 6, 2026, 03_54_11 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_54_11 PM.png",
      "width": 1086,
      "height": 1448,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1086,
        1448
      ],
      "averageRgb": [
        177,
        168,
        159
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 420,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-058-03-54-11-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-058-03-54-11-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-059-03-54-15-pm",
      "index": 59,
      "filename": "ChatGPT Image Jun 6, 2026, 03_54_15 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_54_15 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 621497,
      "opaquePixels": 951367,
      "alphaCoverage": 0.6049,
      "alphaBBox": [
        0,
        1,
        1525,
        1023
      ],
      "averageRgb": [
        123,
        96,
        63
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 512,
      "runtimeHeight": 341,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-059-03-54-15-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-059-03-54-15-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-060-03-56-24-pm",
      "index": 60,
      "filename": "ChatGPT Image Jun 6, 2026, 03_56_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_56_24 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        155,
        140,
        128
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-060-03-56-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-060-03-56-24-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-061-03-56-28-pm",
      "index": 61,
      "filename": "ChatGPT Image Jun 6, 2026, 03_56_28 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_56_28 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        128,
        125,
        114
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-061-03-56-28-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-061-03-56-28-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-062-03-56-31-pm",
      "index": 62,
      "filename": "ChatGPT Image Jun 6, 2026, 03_56_31 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_56_31 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        173,
        167,
        154
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-062-03-56-31-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-062-03-56-31-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-063-03-56-35-pm",
      "index": 63,
      "filename": "ChatGPT Image Jun 6, 2026, 03_56_35 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_56_35 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        137,
        125,
        114
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-063-03-56-35-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-063-03-56-35-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-064-03-59-15-pm",
      "index": 64,
      "filename": "ChatGPT Image Jun 6, 2026, 03_59_15 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_59_15 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        187,
        151,
        125
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-064-03-59-15-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-064-03-59-15-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-065-03-59-38-pm",
      "index": 65,
      "filename": "ChatGPT Image Jun 6, 2026, 03_59_38 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_59_38 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        182,
        168,
        148
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-065-03-59-38-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-065-03-59-38-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-066-03-59-57-pm",
      "index": 66,
      "filename": "ChatGPT Image Jun 6, 2026, 03_59_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 03_59_57 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        142,
        138,
        135
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-066-03-59-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-066-03-59-57-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-067-04-00-15-pm",
      "index": 67,
      "filename": "ChatGPT Image Jun 6, 2026, 04_00_15 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_00_15 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        200,
        193,
        181
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-067-04-00-15-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-067-04-00-15-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-068-04-00-34-pm",
      "index": 68,
      "filename": "ChatGPT Image Jun 6, 2026, 04_00_34 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_00_34 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        192,
        174,
        152
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-068-04-00-34-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-068-04-00-34-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-069-04-01-01-pm",
      "index": 69,
      "filename": "ChatGPT Image Jun 6, 2026, 04_01_01 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_01_01 PM.png",
      "width": 1916,
      "height": 821,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573036,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1916,
        821
      ],
      "averageRgb": [
        201,
        169,
        148
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 411,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-069-04-01-01-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-069-04-01-01-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-070-04-01-23-pm",
      "index": 70,
      "filename": "ChatGPT Image Jun 6, 2026, 04_01_23 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_01_23 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        147,
        144,
        141
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-070-04-01-23-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-070-04-01-23-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-071-04-01-55-pm",
      "index": 71,
      "filename": "ChatGPT Image Jun 6, 2026, 04_01_55 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_01_55 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        212,
        206,
        196
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-071-04-01-55-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-071-04-01-55-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-072-04-02-07-pm",
      "index": 72,
      "filename": "ChatGPT Image Jun 6, 2026, 04_02_07 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_02_07 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        194,
        175,
        151
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-072-04-02-07-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-072-04-02-07-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-073-04-02-22-pm",
      "index": 73,
      "filename": "ChatGPT Image Jun 6, 2026, 04_02_22 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_02_22 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 859157,
      "opaquePixels": 713707,
      "alphaCoverage": 0.4538,
      "alphaBBox": [
        0,
        3,
        1536,
        1023
      ],
      "averageRgb": [
        101,
        77,
        52
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 512,
      "runtimeHeight": 341,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-073-04-02-22-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-073-04-02-22-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-074-04-02-39-pm",
      "index": 74,
      "filename": "ChatGPT Image Jun 6, 2026, 04_02_39 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_02_39 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        232,
        189,
        136
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-074-04-02-39-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-074-04-02-39-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-075-04-02-57-pm",
      "index": 75,
      "filename": "ChatGPT Image Jun 6, 2026, 04_02_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_02_57 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        210,
        177,
        157
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-075-04-02-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-075-04-02-57-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-076-04-03-07-pm",
      "index": 76,
      "filename": "ChatGPT Image Jun 6, 2026, 04_03_07 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_03_07 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        138,
        114,
        99
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-076-04-03-07-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-076-04-03-07-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-077-04-03-22-pm",
      "index": 77,
      "filename": "ChatGPT Image Jun 6, 2026, 04_03_22 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_03_22 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        179,
        147,
        119
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-077-04-03-22-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-077-04-03-22-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-078-04-03-32-pm",
      "index": 78,
      "filename": "ChatGPT Image Jun 6, 2026, 04_03_32 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_03_32 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        237,
        200,
        156
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "ghost_town",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/ghost_town/env-078-04-03-32-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/ghost_town/env-078-04-03-32-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-079-04-03-49-pm",
      "index": 79,
      "filename": "ChatGPT Image Jun 6, 2026, 04_03_49 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_03_49 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        212,
        174,
        154
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-079-04-03-49-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-079-04-03-49-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-080-04-04-04-pm",
      "index": 80,
      "filename": "ChatGPT Image Jun 6, 2026, 04_04_04 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_04_04 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        139,
        114,
        98
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-080-04-04-04-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-080-04-04-04-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-081-04-04-22-pm",
      "index": 81,
      "filename": "ChatGPT Image Jun 6, 2026, 04_04_22 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_04_22 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        237,
        200,
        156
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-081-04-04-22-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-081-04-04-22-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-082-04-04-38-pm",
      "index": 82,
      "filename": "ChatGPT Image Jun 6, 2026, 04_04_38 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_04_38 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1536,
        1024
      ],
      "averageRgb": [
        123,
        118,
        112
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 820,
      "runtimeHeight": 547,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-082-04-04-38-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-082-04-04-38-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-083-04-05-44-pm",
      "index": 83,
      "filename": "ChatGPT Image Jun 6, 2026, 04_05_44 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_05_44 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        167,
        140,
        118
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-083-04-05-44-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-083-04-05-44-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-084-04-05-47-pm",
      "index": 84,
      "filename": "ChatGPT Image Jun 6, 2026, 04_05_47 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_05_47 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        166,
        136,
        121
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-084-04-05-47-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-084-04-05-47-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-085-04-05-50-pm",
      "index": 85,
      "filename": "ChatGPT Image Jun 6, 2026, 04_05_50 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_05_50 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        138,
        111,
        95
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-085-04-05-50-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-085-04-05-50-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-086-04-12-59-pm",
      "index": 86,
      "filename": "ChatGPT Image Jun 6, 2026, 04_12_59 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_12_59 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        173,
        129,
        102
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-086-04-12-59-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-086-04-12-59-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-087-04-13-20-pm",
      "index": 87,
      "filename": "ChatGPT Image Jun 6, 2026, 04_13_20 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_13_20 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        169,
        133,
        118
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-087-04-13-20-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-087-04-13-20-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-088-04-13-33-pm",
      "index": 88,
      "filename": "ChatGPT Image Jun 6, 2026, 04_13_33 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_13_33 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        211,
        195,
        179
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-088-04-13-33-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-088-04-13-33-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-089-04-13-48-pm",
      "index": 89,
      "filename": "ChatGPT Image Jun 6, 2026, 04_13_48 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_13_48 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        179,
        172,
        165
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-089-04-13-48-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-089-04-13-48-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-090-04-14-05-pm",
      "index": 90,
      "filename": "ChatGPT Image Jun 6, 2026, 04_14_05 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_14_05 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        205,
        193,
        178
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-090-04-14-05-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-090-04-14-05-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-091-04-14-24-pm",
      "index": 91,
      "filename": "ChatGPT Image Jun 6, 2026, 04_14_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_14_24 PM.png",
      "width": 948,
      "height": 1659,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572732,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        948,
        1659
      ],
      "averageRgb": [
        168,
        121,
        93
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 320,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-091-04-14-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-091-04-14-24-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-092-04-14-36-pm",
      "index": 92,
      "filename": "ChatGPT Image Jun 6, 2026, 04_14_36 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_14_36 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1024,
        1536
      ],
      "averageRgb": [
        166,
        132,
        117
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 373,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-092-04-14-36-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-092-04-14-36-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-093-04-14-46-pm",
      "index": 93,
      "filename": "ChatGPT Image Jun 6, 2026, 04_14_46 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_14_46 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        205,
        185,
        163
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-093-04-14-46-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-093-04-14-46-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-094-04-14-57-pm",
      "index": 94,
      "filename": "ChatGPT Image Jun 6, 2026, 04_14_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_14_57 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        183,
        180,
        176
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-094-04-14-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-094-04-14-57-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-095-04-15-11-pm",
      "index": 95,
      "filename": "ChatGPT Image Jun 6, 2026, 04_15_11 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_15_11 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        211,
        194,
        183
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-095-04-15-11-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-095-04-15-11-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-096-04-15-23-pm",
      "index": 96,
      "filename": "ChatGPT Image Jun 6, 2026, 04_15_23 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_15_23 PM.png",
      "width": 1024,
      "height": 1536,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 1317503,
      "opaquePixels": 255361,
      "alphaCoverage": 0.1624,
      "alphaBBox": [
        0,
        48,
        1024,
        1527
      ],
      "averageRgb": [
        91,
        82,
        67
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "country_road",
      "runtimeWidth": 341,
      "runtimeHeight": 512,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-096-04-15-23-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-096-04-15-23-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-097-04-15-38-pm",
      "index": 97,
      "filename": "ChatGPT Image Jun 6, 2026, 04_15_38 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_15_38 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        222,
        217,
        211
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-097-04-15-38-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-097-04-15-38-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-098-04-15-51-pm",
      "index": 98,
      "filename": "ChatGPT Image Jun 6, 2026, 04_15_51 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_15_51 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        130,
        97,
        70
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-098-04-15-51-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-098-04-15-51-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-099-04-16-07-pm",
      "index": 99,
      "filename": "ChatGPT Image Jun 6, 2026, 04_16_07 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_16_07 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        155,
        127,
        99
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-099-04-16-07-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-099-04-16-07-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-100-04-16-22-pm",
      "index": 100,
      "filename": "ChatGPT Image Jun 6, 2026, 04_16_22 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_16_22 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        191,
        184,
        177
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-100-04-16-22-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-100-04-16-22-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-101-04-16-37-pm",
      "index": 101,
      "filename": "ChatGPT Image Jun 6, 2026, 04_16_37 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_16_37 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        170,
        154,
        148
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-101-04-16-37-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-101-04-16-37-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-102-04-17-01-pm",
      "index": 102,
      "filename": "ChatGPT Image Jun 6, 2026, 04_17_01 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_17_01 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        184,
        177,
        167
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "country_road",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-102-04-17-01-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-102-04-17-01-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-103-04-17-41-pm",
      "index": 103,
      "filename": "ChatGPT Image Jun 6, 2026, 04_17_41 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_17_41 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        125,
        93,
        65
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-103-04-17-41-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-103-04-17-41-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-104-04-17-48-pm",
      "index": 104,
      "filename": "ChatGPT Image Jun 6, 2026, 04_17_48 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_17_48 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        162,
        130,
        106
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "country_road",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/country_road/env-104-04-17-48-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/country_road/env-104-04-17-48-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-105-04-18-04-pm",
      "index": 105,
      "filename": "ChatGPT Image Jun 6, 2026, 04_18_04 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_18_04 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 1014255,
      "opaquePixels": 558609,
      "alphaCoverage": 0.3552,
      "alphaBBox": [
        12,
        1,
        1504,
        1023
      ],
      "averageRgb": [
        89,
        67,
        46
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 512,
      "runtimeHeight": 341,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-105-04-18-04-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-105-04-18-04-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-106-04-18-17-pm",
      "index": 106,
      "filename": "ChatGPT Image Jun 6, 2026, 04_18_17 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_18_17 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        187,
        181,
        173
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-106-04-18-17-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-106-04-18-17-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-107-04-18-33-pm",
      "index": 107,
      "filename": "ChatGPT Image Jun 6, 2026, 04_18_33 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_18_33 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        160,
        160,
        154
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-107-04-18-33-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-107-04-18-33-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-108-04-18-54-pm",
      "index": 108,
      "filename": "ChatGPT Image Jun 6, 2026, 04_18_54 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_18_54 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        173,
        165,
        155
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-108-04-18-54-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-108-04-18-54-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-109-04-19-08-pm",
      "index": 109,
      "filename": "ChatGPT Image Jun 6, 2026, 04_19_08 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_19_08 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        217,
        204,
        187
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-109-04-19-08-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-109-04-19-08-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-110-04-19-29-pm",
      "index": 110,
      "filename": "ChatGPT Image Jun 6, 2026, 04_19_29 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_19_29 PM.png",
      "width": 1086,
      "height": 1448,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1086,
        1448
      ],
      "averageRgb": [
        184,
        171,
        161
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 420,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-110-04-19-29-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-110-04-19-29-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-111-04-19-43-pm",
      "index": 111,
      "filename": "ChatGPT Image Jun 6, 2026, 04_19_43 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_19_43 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        178,
        171,
        166
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-111-04-19-43-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-111-04-19-43-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-112-04-19-58-pm",
      "index": 112,
      "filename": "ChatGPT Image Jun 6, 2026, 04_19_58 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_19_58 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        214,
        197,
        186
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-112-04-19-58-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-112-04-19-58-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-113-04-20-12-pm",
      "index": 113,
      "filename": "ChatGPT Image Jun 6, 2026, 04_20_12 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_20_12 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        186,
        182,
        178
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-113-04-20-12-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-113-04-20-12-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-114-04-20-24-pm",
      "index": 114,
      "filename": "ChatGPT Image Jun 6, 2026, 04_20_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_20_24 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        195,
        191,
        189
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-114-04-20-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-114-04-20-24-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-115-04-20-40-pm",
      "index": 115,
      "filename": "ChatGPT Image Jun 6, 2026, 04_20_40 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_20_40 PM.png",
      "width": 1086,
      "height": 1448,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1086,
        1448
      ],
      "averageRgb": [
        220,
        216,
        213
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 420,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-115-04-20-40-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-115-04-20-40-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-116-04-20-44-pm",
      "index": 116,
      "filename": "ChatGPT Image Jun 6, 2026, 04_20_44 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_20_44 PM.png",
      "width": 1086,
      "height": 1448,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1086,
        1448
      ],
      "averageRgb": [
        222,
        216,
        210
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 420,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-116-04-20-44-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-116-04-20-44-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-117-04-20-57-pm",
      "index": 117,
      "filename": "ChatGPT Image Jun 6, 2026, 04_20_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_20_57 PM.png",
      "width": 2508,
      "height": 627,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2508,
        627
      ],
      "averageRgb": [
        183,
        180,
        176
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 240,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-117-04-20-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-117-04-20-57-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-118-04-21-11-pm",
      "index": 118,
      "filename": "ChatGPT Image Jun 6, 2026, 04_21_11 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_21_11 PM.png",
      "width": 1916,
      "height": 821,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573036,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1916,
        821
      ],
      "averageRgb": [
        146,
        133,
        125
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 411,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-118-04-21-11-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-118-04-21-11-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-119-04-21-39-pm",
      "index": 119,
      "filename": "ChatGPT Image Jun 6, 2026, 04_21_39 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_21_39 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        239,
        233,
        226
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-119-04-21-39-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-119-04-21-39-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-120-04-21-57-pm",
      "index": 120,
      "filename": "ChatGPT Image Jun 6, 2026, 04_21_57 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_21_57 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        233,
        226,
        217
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-120-04-21-57-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-120-04-21-57-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-121-04-22-15-pm",
      "index": 121,
      "filename": "ChatGPT Image Jun 6, 2026, 04_22_15 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_22_15 PM.png",
      "width": 1672,
      "height": 941,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573352,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1672,
        941
      ],
      "averageRgb": [
        209,
        206,
        203
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 820,
      "runtimeHeight": 461,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-121-04-22-15-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-121-04-22-15-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-122-04-22-30-pm",
      "index": 122,
      "filename": "ChatGPT Image Jun 6, 2026, 04_22_30 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_22_30 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        161,
        149,
        142
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-122-04-22-30-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-122-04-22-30-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-123-04-22-41-pm",
      "index": 123,
      "filename": "ChatGPT Image Jun 6, 2026, 04_22_41 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_22_41 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGBA",
      "hasAlphaChannel": true,
      "transparentPixels": 1421098,
      "opaquePixels": 151766,
      "alphaCoverage": 0.0965,
      "alphaBBox": [
        0,
        0,
        1536,
        1023
      ],
      "averageRgb": [
        106,
        90,
        68
      ],
      "heuristicRole": "building-or-large-structure",
      "runtimeRole": "structure-prop",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 512,
      "runtimeHeight": 341,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-123-04-22-41-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-123-04-22-41-pm.png",
      "recommendedRuntimeUse": "structure-prop"
    },
    {
      "id": "env-124-04-23-37-pm",
      "index": 124,
      "filename": "ChatGPT Image Jun 6, 2026, 04_23_37 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_23_37 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        183,
        172,
        166
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-124-04-23-37-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-124-04-23-37-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-125-04-23-42-pm",
      "index": 125,
      "filename": "ChatGPT Image Jun 6, 2026, 04_23_42 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_23_42 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        236,
        230,
        224
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-125-04-23-42-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-125-04-23-42-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-126-04-23-47-pm",
      "index": 126,
      "filename": "ChatGPT Image Jun 6, 2026, 04_23_47 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_23_47 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        237,
        231,
        225
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "residential_edge",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/residential_edge/env-126-04-23-47-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/residential_edge/env-126-04-23-47-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-127-04-24-12-pm",
      "index": 127,
      "filename": "ChatGPT Image Jun 6, 2026, 04_24_12 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_24_12 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        215,
        193,
        165
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-127-04-24-12-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-127-04-24-12-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-128-04-24-35-pm",
      "index": 128,
      "filename": "ChatGPT Image Jun 6, 2026, 04_24_35 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_24_35 PM.png",
      "width": 1536,
      "height": 1024,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572864,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1536,
        1024
      ],
      "averageRgb": [
        237,
        232,
        227
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 820,
      "runtimeHeight": 547,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-128-04-24-35-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-128-04-24-35-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-129-04-25-56-pm",
      "index": 129,
      "filename": "ChatGPT Image Jun 6, 2026, 04_25_56 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_25_56 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        186,
        173,
        164
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-129-04-25-56-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-129-04-25-56-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-130-04-26-01-pm",
      "index": 130,
      "filename": "ChatGPT Image Jun 6, 2026, 04_26_01 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_26_01 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        191,
        178,
        162
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-130-04-26-01-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-130-04-26-01-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-131-04-26-18-pm",
      "index": 131,
      "filename": "ChatGPT Image Jun 6, 2026, 04_26_18 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_26_18 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        168,
        157,
        150
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-131-04-26-18-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-131-04-26-18-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-132-04-26-24-pm",
      "index": 132,
      "filename": "ChatGPT Image Jun 6, 2026, 04_26_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_26_24 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        199,
        184,
        168
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-132-04-26-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-132-04-26-24-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-133-04-27-24-pm",
      "index": 133,
      "filename": "ChatGPT Image Jun 6, 2026, 04_27_24 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_27_24 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        194,
        160,
        130
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-133-04-27-24-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-133-04-27-24-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-134-04-27-30-pm",
      "index": 134,
      "filename": "ChatGPT Image Jun 6, 2026, 04_27_30 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_27_30 PM.png",
      "width": 1122,
      "height": 1402,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1122,
        1402
      ],
      "averageRgb": [
        192,
        182,
        171
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "vertical-background-or-large-prop-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 448,
      "runtimeHeight": 560,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-134-04-27-30-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-134-04-27-30-pm.png",
      "recommendedRuntimeUse": "vertical-background-or-large-prop-reference"
    },
    {
      "id": "env-135-04-27-35-pm",
      "index": 135,
      "filename": "ChatGPT Image Jun 6, 2026, 04_27_35 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_27_35 PM.png",
      "width": 1672,
      "height": 941,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573352,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1672,
        941
      ],
      "averageRgb": [
        150,
        137,
        127
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 820,
      "runtimeHeight": 461,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-135-04-27-35-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-135-04-27-35-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-136-04-27-40-pm",
      "index": 136,
      "filename": "ChatGPT Image Jun 6, 2026, 04_27_40 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_27_40 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        168,
        156,
        146
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-136-04-27-40-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-136-04-27-40-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-137-04-27-48-pm",
      "index": 137,
      "filename": "ChatGPT Image Jun 6, 2026, 04_27_48 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_27_48 PM.png",
      "width": 2244,
      "height": 701,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573044,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2244,
        701
      ],
      "averageRgb": [
        189,
        176,
        159
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-parallax-or-road-strip",
      "suggestedStage": "inner_city",
      "runtimeWidth": 960,
      "runtimeHeight": 300,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-137-04-27-48-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-137-04-27-48-pm.png",
      "recommendedRuntimeUse": "wide-parallax-or-road-strip"
    },
    {
      "id": "env-138-04-28-53-pm",
      "index": 138,
      "filename": "ChatGPT Image Jun 6, 2026, 04_28_53 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_28_53 PM.png",
      "width": 1672,
      "height": 941,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573352,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1672,
        941
      ],
      "averageRgb": [
        243,
        237,
        227
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 820,
      "runtimeHeight": 461,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-138-04-28-53-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-138-04-28-53-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-139-04-29-08-pm",
      "index": 139,
      "filename": "ChatGPT Image Jun 6, 2026, 04_29_08 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_29_08 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        249,
        243,
        237
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-139-04-29-08-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-139-04-29-08-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-140-04-29-50-pm",
      "index": 140,
      "filename": "ChatGPT Image Jun 6, 2026, 04_29_50 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_29_50 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        237,
        234,
        231
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-140-04-29-50-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-140-04-29-50-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-141-04-29-55-pm",
      "index": 141,
      "filename": "ChatGPT Image Jun 6, 2026, 04_29_55 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_29_55 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        221,
        218,
        215
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-141-04-29-55-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-141-04-29-55-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-142-04-30-03-pm",
      "index": 142,
      "filename": "ChatGPT Image Jun 6, 2026, 04_30_03 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_30_03 PM.png",
      "width": 1774,
      "height": 887,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1573538,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1774,
        887
      ],
      "averageRgb": [
        224,
        210,
        197
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "scenic-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 820,
      "runtimeHeight": 410,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-142-04-30-03-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-142-04-30-03-pm.png",
      "recommendedRuntimeUse": "scenic-background"
    },
    {
      "id": "env-143-04-30-08-pm",
      "index": 143,
      "filename": "ChatGPT Image Jun 6, 2026, 04_30_08 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_30_08 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        215,
        212,
        211
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-143-04-30-08-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-143-04-30-08-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-144-04-32-52-pm",
      "index": 144,
      "filename": "ChatGPT Image Jun 6, 2026, 04_32_52 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_32_52 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        247,
        238,
        226
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-144-04-32-52-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-144-04-32-52-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-145-04-32-56-pm",
      "index": 145,
      "filename": "ChatGPT Image Jun 6, 2026, 04_32_56 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_32_56 PM.png",
      "width": 1448,
      "height": 1086,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1448,
        1086
      ],
      "averageRgb": [
        248,
        246,
        243
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 480,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-145-04-32-56-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-145-04-32-56-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-146-04-33-08-pm",
      "index": 146,
      "filename": "ChatGPT Image Jun 6, 2026, 04_33_08 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_33_08 PM.png",
      "width": 2172,
      "height": 724,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572528,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        2172,
        724
      ],
      "averageRgb": [
        234,
        232,
        230
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "wide-background",
      "suggestedStage": "inner_city",
      "runtimeWidth": 960,
      "runtimeHeight": 320,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-146-04-33-08-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-146-04-33-08-pm.png",
      "recommendedRuntimeUse": "wide-background"
    },
    {
      "id": "env-147-04-33-13-pm",
      "index": 147,
      "filename": "ChatGPT Image Jun 6, 2026, 04_33_13 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_33_13 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        245,
        243,
        239
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-147-04-33-13-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-147-04-33-13-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    },
    {
      "id": "env-148-04-33-20-pm",
      "index": 148,
      "filename": "ChatGPT Image Jun 6, 2026, 04_33_20 PM.png",
      "sourcePath": "C:\\Users\\just_\\Desktop\\My Stuff\\Lester's Arcade\\Hard Money Heroes\\Art Assets\\Level Environment Assets\\ChatGPT Image Jun 6, 2026, 04_33_20 PM.png",
      "width": 1254,
      "height": 1254,
      "mode": "RGB",
      "hasAlphaChannel": false,
      "transparentPixels": 0,
      "opaquePixels": 1572516,
      "alphaCoverage": 1.0,
      "alphaBBox": [
        0,
        0,
        1254,
        1254
      ],
      "averageRgb": [
        247,
        244,
        237
      ],
      "heuristicRole": "full-background-or-large-tileset",
      "runtimeRole": "square-tileset-or-building-reference",
      "suggestedStage": "inner_city",
      "runtimeWidth": 640,
      "runtimeHeight": 640,
      "runtimeSrc": "./assets/hard-money-heroes/environment/runtime/inner_city/env-148-04-33-20-pm.png",
      "runtimePath": "apps/portal/assets/hard-money-heroes/environment/runtime/inner_city/env-148-04-33-20-pm.png",
      "recommendedRuntimeUse": "square-tileset-or-building-reference"
    }
  ],
  "runtimeNotes": {
    "sorting": "timestamp-order source filenames; deterministic stage bands from Justin's desert-to-city level brief",
    "proportions": "player remains 104px tall; enemies 78px; environment prop cards stay 118-168px high and never obscure combat readability",
    "animationHooks": [
      "heat shimmer",
      "dust motes",
      "wind sway",
      "lantern/window/neon flicker",
      "sign sparks"
    ]
  }
});

export default HMH_ENVIRONMENT_ASSET_MANIFEST;

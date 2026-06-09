const freezeDeep = (value) => {
  if (!value || typeof value !== 'object') return value;
  for (const item of Object.values(value)) freezeDeep(item);
  return Object.freeze(value);
};

export const LESTER_ARCADE_PLAYLIST_MANIFEST = freezeDeep({
  "id": "lesters-arcade-custom-mp3-playlist-v1",
  "title": "Lester's Arcade Custom MP3 Playlist",
  "generatedFrom": "Arcade Playlist Music",
  "player": {
    "mode": "global-overlay",
    "minimalByDefault": true,
    "expandable": true,
    "controls": [
      "previous",
      "play-pause",
      "mute",
      "next",
      "expand"
    ],
    "description": "Parent arcade music player shared by cabinets so individual games can opt into queues instead of owning separate background music."
  },
  "defaultQueue": [
    "hard-money-heroes-16-bit-arcade-music",
    "hard-money-heroes-16-bit-arcade-music-alt",
    "adventure-16-bit-arcade-music",
    "castlelitvania-16-bit-arcade-music-track-1",
    "castlelitvania-16-bit-arcade-music-track-2",
    "lit-country-16-bit-arcade-music-track-1",
    "lit-country-16-bit-arcade-music-track-2",
    "lit-fantasy-16-bit-arcade-music-track-1",
    "lit-fantasy-16-bit-arcade-music-track-2",
    "lit-man-16-bit-arcade-music-track-1",
    "lit-man-16-bit-arcade-music-track-2",
    "lit-trigger-16-bit-arcade-music",
    "litbound-16-bit-arcade-music-track-1",
    "litbound-16-bit-arcade-music-track-2",
    "lit-zero-16-bit-arcade-music-track-1",
    "lit-zero-16-bit-arcade-music-track-2",
    "speedster-16-bit-arcade-music-track-1",
    "speedster-16-bit-arcade-music-track-2",
    "super-lit-16-bit-arcade-music-track-1",
    "super-lit-16-bit-arcade-music-track-2",
    "attack-of-the-lit-invaders-16-bit-arcade-music",
    "attack-of-the-lit-invaders-16-bit-arcade-music-alt",
    "lit-vibey-hideout-16-bit-arcade-music",
    "lit-vibey-hideout-16-bit-arcade-music-alt",
    "midnight-lit-16-bit-arcade-music",
    "midnight-lit-16-bit-arcade-music-alt"
  ],
  "gameQueues": {
    "hardMoneyHeroes": [
      "hard-money-heroes-16-bit-arcade-music",
      "hard-money-heroes-16-bit-arcade-music-alt",
      "adventure-16-bit-arcade-music",
      "castlelitvania-16-bit-arcade-music-track-1",
      "castlelitvania-16-bit-arcade-music-track-2",
      "lit-country-16-bit-arcade-music-track-1",
      "lit-country-16-bit-arcade-music-track-2",
      "lit-fantasy-16-bit-arcade-music-track-1",
      "lit-fantasy-16-bit-arcade-music-track-2",
      "lit-man-16-bit-arcade-music-track-1",
      "lit-man-16-bit-arcade-music-track-2",
      "lit-trigger-16-bit-arcade-music",
      "litbound-16-bit-arcade-music-track-1",
      "litbound-16-bit-arcade-music-track-2",
      "lit-zero-16-bit-arcade-music-track-1",
      "lit-zero-16-bit-arcade-music-track-2",
      "speedster-16-bit-arcade-music-track-1",
      "speedster-16-bit-arcade-music-track-2",
      "super-lit-16-bit-arcade-music-track-1",
      "super-lit-16-bit-arcade-music-track-2",
      "attack-of-the-lit-invaders-16-bit-arcade-music",
      "attack-of-the-lit-invaders-16-bit-arcade-music-alt",
      "lit-vibey-hideout-16-bit-arcade-music",
      "lit-vibey-hideout-16-bit-arcade-music-alt",
      "midnight-lit-16-bit-arcade-music",
      "midnight-lit-16-bit-arcade-music-alt"
    ],
    "hard-money-heroes": [
      "hard-money-heroes-16-bit-arcade-music",
      "hard-money-heroes-16-bit-arcade-music-alt",
      "adventure-16-bit-arcade-music",
      "castlelitvania-16-bit-arcade-music-track-1",
      "castlelitvania-16-bit-arcade-music-track-2",
      "lit-country-16-bit-arcade-music-track-1",
      "lit-country-16-bit-arcade-music-track-2",
      "lit-fantasy-16-bit-arcade-music-track-1",
      "lit-fantasy-16-bit-arcade-music-track-2",
      "lit-man-16-bit-arcade-music-track-1",
      "lit-man-16-bit-arcade-music-track-2",
      "lit-trigger-16-bit-arcade-music",
      "litbound-16-bit-arcade-music-track-1",
      "litbound-16-bit-arcade-music-track-2",
      "lit-zero-16-bit-arcade-music-track-1",
      "lit-zero-16-bit-arcade-music-track-2",
      "speedster-16-bit-arcade-music-track-1",
      "speedster-16-bit-arcade-music-track-2",
      "super-lit-16-bit-arcade-music-track-1",
      "super-lit-16-bit-arcade-music-track-2",
      "attack-of-the-lit-invaders-16-bit-arcade-music",
      "attack-of-the-lit-invaders-16-bit-arcade-music-alt",
      "lit-vibey-hideout-16-bit-arcade-music",
      "lit-vibey-hideout-16-bit-arcade-music-alt",
      "midnight-lit-16-bit-arcade-music",
      "midnight-lit-16-bit-arcade-music-alt"
    ]
  },
  "tracks": [
    {
      "id": "hard-money-heroes-16-bit-arcade-music",
      "title": "Hard Money Heroes — Main Theme",
      "src": "./assets/audio/playlist/hard-money-heroes-16-bit-arcade-music.mp3",
      "sourceFile": "Hard Money Heroes 16-BIT Arcade Music.mp3",
      "durationSeconds": 134.84,
      "durationLabel": "2:15",
      "bytes": 3004994,
      "tags": [
        "arcade",
        "hard-money-heroes",
        "combat"
      ],
      "order": 0
    },
    {
      "id": "hard-money-heroes-16-bit-arcade-music-alt",
      "title": "Hard Money Heroes — Mempool Mayhem",
      "src": "./assets/audio/playlist/hard-money-heroes-16-bit-arcade-music-alt.mp3",
      "sourceFile": "Hard Money Heroes 16-BIT Arcade Music (1).mp3",
      "durationSeconds": 154.8,
      "durationLabel": "2:35",
      "bytes": 3459284,
      "tags": [
        "arcade",
        "hard-money-heroes",
        "combat"
      ],
      "order": 1
    },
    {
      "id": "adventure-16-bit-arcade-music",
      "title": "Block Reward Quest",
      "src": "./assets/audio/playlist/adventure-16-bit-arcade-music.mp3",
      "sourceFile": "Adventure 16-BIT Arcade Music.mp3",
      "durationSeconds": 217.24,
      "durationLabel": "3:37",
      "bytes": 5027503,
      "tags": [
        "arcade",
        "adventure",
        "menu"
      ],
      "order": 2
    },
    {
      "id": "castlelitvania-16-bit-arcade-music-track-1",
      "title": "CastleLitvania — Crypt of the Cold Wallet",
      "src": "./assets/audio/playlist/castlelitvania-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "CastleLitvania 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 118.32,
      "durationLabel": "1:58",
      "bytes": 2691893,
      "tags": [
        "arcade",
        "castlelitvania",
        "future-cabinet"
      ],
      "order": 3
    },
    {
      "id": "castlelitvania-16-bit-arcade-music-track-2",
      "title": "CastleLitvania — Halving Night",
      "src": "./assets/audio/playlist/castlelitvania-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "CastleLitvania 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 121.92,
      "durationLabel": "2:02",
      "bytes": 2878845,
      "tags": [
        "arcade",
        "castlelitvania",
        "future-cabinet"
      ],
      "order": 4
    },
    {
      "id": "lit-country-16-bit-arcade-music-track-1",
      "title": "Proof-of-Work Prairie",
      "src": "./assets/audio/playlist/lit-country-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Lit Country 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 239.8,
      "durationLabel": "4:00",
      "bytes": 6011688,
      "tags": [
        "arcade",
        "lit-country",
        "future-cabinet"
      ],
      "order": 5
    },
    {
      "id": "lit-country-16-bit-arcade-music-track-2",
      "title": "Open Ledger Range",
      "src": "./assets/audio/playlist/lit-country-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Lit Country 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 246.28,
      "durationLabel": "4:06",
      "bytes": 6321878,
      "tags": [
        "arcade",
        "lit-country",
        "future-cabinet"
      ],
      "order": 6
    },
    {
      "id": "lit-fantasy-16-bit-arcade-music-track-1",
      "title": "Final Ledger I — Genesis Block",
      "src": "./assets/audio/playlist/lit-fantasy-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Lit Fantasy 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 104.92,
      "durationLabel": "1:45",
      "bytes": 2457004,
      "tags": [
        "arcade",
        "lit-fantasy",
        "future-cabinet"
      ],
      "order": 7
    },
    {
      "id": "lit-fantasy-16-bit-arcade-music-track-2",
      "title": "Final Ledger II — The Lost Keys",
      "src": "./assets/audio/playlist/lit-fantasy-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Lit Fantasy 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 109.8,
      "durationLabel": "1:50",
      "bytes": 2853121,
      "tags": [
        "arcade",
        "lit-fantasy",
        "future-cabinet"
      ],
      "order": 8
    },
    {
      "id": "lit-man-16-bit-arcade-music-track-1",
      "title": "Mega Lit — Hashrate Heights",
      "src": "./assets/audio/playlist/lit-man-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Lit Man 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 167.4,
      "durationLabel": "2:47",
      "bytes": 3777437,
      "tags": [
        "arcade",
        "lit-man",
        "future-cabinet"
      ],
      "order": 9
    },
    {
      "id": "lit-man-16-bit-arcade-music-track-2",
      "title": "Mega Lit — Difficulty Bomb",
      "src": "./assets/audio/playlist/lit-man-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Lit Man 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 149.56,
      "durationLabel": "2:30",
      "bytes": 3616496,
      "tags": [
        "arcade",
        "lit-man",
        "future-cabinet"
      ],
      "order": 10
    },
    {
      "id": "lit-trigger-16-bit-arcade-music",
      "title": "Lit Trigger — Timechain Warp",
      "src": "./assets/audio/playlist/lit-trigger-16-bit-arcade-music.mp3",
      "sourceFile": "Lit Trigger 16-BIT Arcade Music.mp3",
      "durationSeconds": 97.08,
      "durationLabel": "1:37",
      "bytes": 2231042,
      "tags": [
        "arcade",
        "lit-trigger",
        "future-cabinet"
      ],
      "order": 11
    },
    {
      "id": "litbound-16-bit-arcade-music-track-1",
      "title": "LitBound — Satoshi's Hometown",
      "src": "./assets/audio/playlist/litbound-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "LitBound 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 122.16,
      "durationLabel": "2:02",
      "bytes": 2908618,
      "tags": [
        "arcade",
        "litbound",
        "future-cabinet"
      ],
      "order": 12
    },
    {
      "id": "litbound-16-bit-arcade-music-track-2",
      "title": "LitBound — Onward to LitVM",
      "src": "./assets/audio/playlist/litbound-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "LitBound 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 152.16,
      "durationLabel": "2:32",
      "bytes": 3692642,
      "tags": [
        "arcade",
        "litbound",
        "future-cabinet"
      ],
      "order": 13
    },
    {
      "id": "lit-zero-16-bit-arcade-music-track-1",
      "title": "Lit Zero — Cyber Validator",
      "src": "./assets/audio/playlist/lit-zero-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Lit-Zero 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 137.64,
      "durationLabel": "2:18",
      "bytes": 3088772,
      "tags": [
        "arcade",
        "lit-zero",
        "future-cabinet"
      ],
      "order": 14
    },
    {
      "id": "lit-zero-16-bit-arcade-music-track-2",
      "title": "Lit Zero — Override Protocol",
      "src": "./assets/audio/playlist/lit-zero-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Lit-Zero 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 154.64,
      "durationLabel": "2:35",
      "bytes": 3432363,
      "tags": [
        "arcade",
        "lit-zero",
        "future-cabinet"
      ],
      "order": 15
    },
    {
      "id": "speedster-16-bit-arcade-music-track-1",
      "title": "Lightning Loop — Sub-Second Sprint",
      "src": "./assets/audio/playlist/speedster-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Speedster 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 39.52,
      "durationLabel": "0:40",
      "bytes": 892778,
      "tags": [
        "arcade",
        "speedster",
        "future-cabinet"
      ],
      "order": 16
    },
    {
      "id": "speedster-16-bit-arcade-music-track-2",
      "title": "Green Candle Hashrate Dash",
      "src": "./assets/audio/playlist/speedster-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Speedster 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 32.32,
      "durationLabel": "0:32",
      "bytes": 824487,
      "tags": [
        "arcade",
        "speedster",
        "future-cabinet"
      ],
      "order": 17
    },
    {
      "id": "super-lit-16-bit-arcade-music-track-1",
      "title": "Super Lit Bros — Block 1-1",
      "src": "./assets/audio/playlist/super-lit-16-bit-arcade-music-track-1.mp3",
      "sourceFile": "Super Lit 16-BIT Arcade Music Track 1.mp3",
      "durationSeconds": 205.0,
      "durationLabel": "3:25",
      "bytes": 5260483,
      "tags": [
        "arcade",
        "super-lit",
        "future-cabinet"
      ],
      "order": 18
    },
    {
      "id": "super-lit-16-bit-arcade-music-track-2",
      "title": "Super Lit Bros — Flagpole Finale",
      "src": "./assets/audio/playlist/super-lit-16-bit-arcade-music-track-2.mp3",
      "sourceFile": "Super Lit 16-BIT Arcade Music Track 2.mp3",
      "durationSeconds": 244.56,
      "durationLabel": "4:05",
      "bytes": 6341689,
      "tags": [
        "arcade",
        "super-lit",
        "future-cabinet"
      ],
      "order": 19
    },
    {
      "id": "attack-of-the-lit-invaders-16-bit-arcade-music",
      "title": "Attack of the Lit Invaders — First Wave",
      "src": "./assets/audio/playlist/attack-of-the-lit-invaders-16-bit-arcade-music.mp3",
      "sourceFile": "Attack of the Lit Invaders - 16-BIT Arcade Music.mp3",
      "durationSeconds": 132.12,
      "durationLabel": "2:12",
      "bytes": 3437151,
      "tags": [
        "arcade",
        "action",
        "intense",
        "combat"
      ],
      "order": 20
    },
    {
      "id": "attack-of-the-lit-invaders-16-bit-arcade-music-alt",
      "title": "Attack of the Lit Invaders — Final Assault",
      "src": "./assets/audio/playlist/attack-of-the-lit-invaders-16-bit-arcade-music-alt.mp3",
      "sourceFile": "Attack of the Lit Invaders - 16-BIT Arcade Music (1).mp3",
      "durationSeconds": 70.56,
      "durationLabel": "1:11",
      "bytes": 1721581,
      "tags": [
        "arcade",
        "action",
        "intense",
        "combat"
      ],
      "order": 21
    },
    {
      "id": "lit-vibey-hideout-16-bit-arcade-music",
      "title": "Lit Vibey Hideout",
      "src": "./assets/audio/playlist/lit-vibey-hideout-16-bit-arcade-music.mp3",
      "sourceFile": "Lit Vibey Hideout - 16-BIT Arcade Music.mp3",
      "durationSeconds": 82.88,
      "durationLabel": "1:23",
      "bytes": 2012499,
      "tags": [
        "arcade",
        "funky",
        "chill",
        "menu"
      ],
      "order": 22
    },
    {
      "id": "lit-vibey-hideout-16-bit-arcade-music-alt",
      "title": "Lit Vibey Hideout — After Hours",
      "src": "./assets/audio/playlist/lit-vibey-hideout-16-bit-arcade-music-alt.mp3",
      "sourceFile": "Lit Vibey Hideout - 16-BIT Arcade Music (1).mp3",
      "durationSeconds": 99.56,
      "durationLabel": "1:40",
      "bytes": 2490289,
      "tags": [
        "arcade",
        "funky",
        "chill",
        "menu"
      ],
      "order": 23
    },
    {
      "id": "midnight-lit-16-bit-arcade-music",
      "title": "Midnight Lit — Neon Skyline",
      "src": "./assets/audio/playlist/midnight-lit-16-bit-arcade-music.mp3",
      "sourceFile": "Midnight Lit - 16-BIT Arcade Music.mp3",
      "durationSeconds": 67.92,
      "durationLabel": "1:08",
      "bytes": 1624498,
      "tags": [
        "arcade",
        "chill",
        "ambient",
        "menu"
      ],
      "order": 24
    },
    {
      "id": "midnight-lit-16-bit-arcade-music-alt",
      "title": "Midnight Lit — Cold Storage Dreams",
      "src": "./assets/audio/playlist/midnight-lit-16-bit-arcade-music-alt.mp3",
      "sourceFile": "Midnight Lit - 16-BIT Arcade Music (1).mp3",
      "durationSeconds": 119.12,
      "durationLabel": "1:59",
      "bytes": 2800281,
      "tags": [
        "arcade",
        "chill",
        "ambient",
        "menu"
      ],
      "order": 25
    }
  ]
});

export default LESTER_ARCADE_PLAYLIST_MANIFEST;

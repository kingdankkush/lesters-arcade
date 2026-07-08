# WO-115 Level Design Readability Lock

WO-115 ties the next enemy-art batch to Level 1 encounter clarity. The completed actors cover five distinct lane/POI roles:

- `claim-jumper`: ghost-town/residential cover-peek rifle lanes.
- `scam-cult-zealot`: saloon/forest fan-shot mini-boss pressure.
- `sybil-drone`: desert/city formation flyer pressure.
- `rug-rat`: ghost-town/country-road low disruptor pressure.
- `honeypot-turret`: country-road/city stationary trap silhouette.

Each actor now has full 8-direction `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, and `spawn-in` coverage, so authored districts can use their intended enemy roles without falling back to partial/missing combat reads.

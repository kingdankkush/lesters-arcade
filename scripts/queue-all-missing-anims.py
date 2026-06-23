#!/usr/bin/env python3
"""Queue all missing animations for HMH characters on PixelLab.
Slot-aware: checks processing count before each submit."""
import asyncio, json, re, time
from pathlib import Path
from mcp.client.streamable_http import streamablehttp_client
from mcp import ClientSession

ROSTER_DIR = Path('apps/portal/assets/generated/hmh-animated-roster')
LEDGER = ROSTER_DIR / 'char-creation-ledger.json'

ALL_DIRS = ["south","south-east","east","north-east","north","north-west","west","south-west"]

# Animation kits
HUMANOID_KIT = [
    ("idle", "idle breathing animation, subtle weight shift, ready combat stance", 6),
    ("walk", "walking locomotion cycle, full body movement, natural stride", 7),
    ("run", "running sprint cycle, aggressive forward lean, fast stride", 8),
    ("attack", "attack strike animation, wind up and lunge forward, aggressive melee hit", 6),
    ("attack-tell", "attack telegraph wind-up, readable anticipation before strike, pre-attack pose with clear tell", 4),
    ("hit", "damage taken reaction, flinch backward, flash of pain, recoil stagger", 4),
    ("death", "death animation, collapse and fade, final fall to ground, dissolving", 8),
]

QUAD_KIT = [
    ("idle", "quadruped idle breathing, subtle head movement, alert stance, tail sway", 6),
    ("walk", "quadruped walking gait cycle, four-legged locomotion, natural pace", 7),
    ("run", "quadruped sprint gallop, aggressive loping charge, fast four-legged stride", 8),
    ("attack", "quadruped attack lunge, bite or claw strike forward, aggressive pounce", 6),
    ("attack-tell", "quadruped attack wind-up, crouch and coil before lunge, readable anticipation", 4),
    ("hit", "quadruped damage reaction, flinch and recoil, pain stagger backward", 4),
    ("death", "quadruped death collapse, fall to side and dissolve, final tumble", 8),
]

# Ranged enemy kit (adds shoot)
RANGED_KIT = HUMANOID_KIT + [
    ("shoot", "ranged shooting animation, raise weapon and fire projectile, muzzle flash recoil", 6),
]

# Boss kit (extra anims)
BOSS_KIT = HUMANOID_KIT + [
    ("shoot", "boss ranged attack, raise weapon and fire large projectile, heavy recoil", 6),
    ("special", "boss special attack, area-of-effect slam or wave, dramatic wind-up and release", 8),
]

# Map character keys to their kits
CHAR_KITS = {
    # Level 1 quadrupeds
    "coyote-pack-runner": "quadruped",
    "wild-boar": "quadruped",
    "buzzard": "quadruped",
    "rattlesnake": "quadruped",
    "scorpion-ambusher": "quadruped",
    # Level 1 humanoids
    "scam-cult-zealot": "humanoid",
    "claim-jumper": "ranged",
    "rug-rat": "humanoid",
    # Level 2 humanoids
    "plaza-warden": "boss",
    "bridge-exploiter": "boss",
    "the-obfuscator": "boss",
    "liquidation-cascade-golem": "humanoid",
    "bitcoin-maximalist-riot-cop": "humanoid",
    "stablecoin-socialite": "humanoid",
    "nft-valet": "humanoid",
    "influencer-camera-drone": "humanoid",
    "dao-lobbyist": "humanoid",
    # Existing chars that need more anims
    "sybil-drone": "ranged",
    "phishing-angler": "ranged",
    "mev-reaper": "ranged",
}

def load_token():
    home = Path.home()
    cj = json.loads((home / '.claude.json').read_text(encoding='utf-8'))
    for proj in cj.get('projects', {}).values():
        srv = proj.get('mcpServers', {}).get('pixellab')
        if srv:
            return srv['headers']['Authorization'].replace('Bearer ', '')
    raise SystemExit('no pixellab token')

async def get_char_info(session, char_id):
    """Get character animation listing"""
    result = await session.call_tool('get_character', {'character_id': char_id})
    text = '\n'.join(c.text for c in result.content if hasattr(c, 'text'))
    
    # Count processing
    processing = text.lower().count('processing')
    
    # Parse animations
    anim_pattern = re.compile(r'^\s+(\S+)\s+\(([^)]+),\s*(\d+)f\)', re.MULTILINE)
    anims = {}
    for m in anim_pattern.finditer(text):
        name = m.group(1)
        dirs_str = m.group(2)
        frames = int(m.group(3))
        dir_pattern = re.compile(r'(south-east|north-east|north-west|south-west|south|north|east|west)')
        dirs = set(dir_pattern.findall(dirs_str))
        anims[name] = {"dirs": dirs, "frames": frames}
    
    return anims, processing, text

async def queue_one(session, char_id, char_key, anim_name, action_desc, frame_count, ledger):
    """Queue a single animation with slot awareness"""
    # Check processing count
    for attempt in range(3):
        anims, processing, _ = await get_char_info(session, char_id)
        if processing < 4:
            break
        print(f'    [WAIT] {processing} processing, sleeping 20s (attempt {attempt+1})', flush=True)
        await asyncio.sleep(20)
    
    try:
        result = await session.call_tool('animate_character', {
            'character_id': char_id,
            'mode': 'v3',
            'action_description': action_desc,
            'animation_name': anim_name,
            'directions': ALL_DIRS,
            'frame_count': frame_count,
        })
        text = ' '.join(c.text for c in result.content if hasattr(c, 'text'))
        if 'error' in text.lower():
            print(f'    [ERROR] {anim_name}: {text[:200]}', flush=True)
            return False
        else:
            print(f'    [OK] {anim_name} queued', flush=True)
            if char_key not in ledger:
                ledger[char_key] = {'character_id': char_id, 'animations': {}}
            ledger[char_key]['animations'][anim_name] = {'queued': True}
            return True
    except Exception as e:
        print(f'    [ERROR] {anim_name}: {e}', flush=True)
        return False

async def main():
    token = load_token()
    url = 'https://api.pixellab.ai/mcp'
    headers = {'Authorization': f'Bearer {token}'}
    
    ledger = json.loads(LEDGER.read_text(encoding='utf-8')) if LEDGER.exists() else {}
    
    async with streamablehttp_client(url, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            for char_key, kit_type in CHAR_KITS.items():
                char_id = ledger.get(char_key, {}).get('character_id')
                if not char_id:
                    print(f'[SKIP] {char_key}: no character_id', flush=True)
                    continue
                
                print(f'\n[{char_key}] (kit={kit_type})', flush=True)
                
                # Check existing animations
                existing, proc, _ = await get_char_info(session, char_id)
                print(f'  Existing: {len(existing)} anims, {proc} processing', flush=True)
                
                # Pick kit
                if kit_type == 'quadruped':
                    kit = QUAD_KIT
                elif kit_type == 'ranged':
                    kit = RANGED_KIT
                elif kit_type == 'boss':
                    kit = BOSS_KIT
                else:
                    kit = HUMANOID_KIT
                
                # Queue missing animations
                for anim_name, action_desc, frame_count in kit:
                    # Check if already has 8-dir version
                    if anim_name in existing and len(existing[anim_name]['dirs']) >= 8:
                        print(f'  [SKIP] {anim_name} already has {len(existing[anim_name]["dirs"])} dirs', flush=True)
                        continue
                    
                    # Check if already queued in ledger
                    if char_key in ledger and anim_name in ledger[char_key].get('animations', {}):
                        if ledger[char_key]['animations'][anim_name].get('queued'):
                            # But verify it actually exists on server now
                            if anim_name in existing and len(existing[anim_name]['dirs']) >= 8:
                                print(f'  [SKIP] {anim_name} queued+complete', flush=True)
                                continue
                            # Still queueing - might have failed, retry
                            print(f'  [RETRY] {anim_name} was queued but not complete', flush=True)
                        
                    success = await queue_one(session, char_id, char_key, anim_name, action_desc, frame_count, ledger)
                    if success:
                        await asyncio.sleep(10)  # Wait between queue submissions
                    else:
                        await asyncio.sleep(5)
                
                LEDGER.write_text(json.dumps(ledger, indent=2), encoding='utf-8')
            
            print('\n=== ALL QUEUEING DONE ===', flush=True)

if __name__ == '__main__':
    asyncio.run(main())

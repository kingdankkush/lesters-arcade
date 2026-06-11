#!/usr/bin/env python3
"""
Lester's Arcade & Hard Money Heroes - Comprehensive Analysis PDF Generator
Updated with isometric roguelike pivot info from AGENTS.md
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime

# Colors
LITECOIN_BLUE = HexColor('#345DCC')
CORRUPTION_RED = HexColor('#FF476F')
DARK_BG = HexColor('#0A0C14')
SILVER = HexColor('#C0C0C0')
ACCENT = HexColor('#45FF8A')

def create_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=22,
        textColor=LITECOIN_BLUE,
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=SILVER,
        spaceAfter=20,
        alignment=TA_CENTER,
        fontName='Helvetica-Oblique'
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=LITECOIN_BLUE,
        spaceBefore=16,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='SubsectionHeader',
        parent=styles['Heading2'],
        fontSize=11,
        textColor=CORRUPTION_RED,
        spaceBefore=12,
        spaceAfter=6,
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='Footer',
        parent=styles['Normal'],
        fontSize=7,
        textColor=SILVER,
        alignment=TA_CENTER
    ))

    # Used for the Success Criteria callout. Was referenced but never defined,
    # which crashed doc.build() and meant the PDF artifact never existed.
    styles.add(ParagraphStyle(
        name='Highlight',
        parent=styles['BodyText'],
        fontSize=10,
        textColor=ACCENT,
        backColor=DARK_BG,
        borderColor=ACCENT,
        borderWidth=0.6,
        borderPadding=6,
        spaceBefore=8,
        spaceAfter=8,
    ))

    return styles

def add_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(LITECOIN_BLUE)
    canvas.rect(0, letter[1] - 22, letter[0], 22, fill=True, stroke=False)
    canvas.setFillColor(white)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(20, letter[1] - 15, "Lester's Arcade Analysis | Confidential — For Claude Fable / Qwen / Codex")
    canvas.drawRightString(letter[0] - 20, letter[1] - 15, "lestersarcade.io")
    
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, letter[0], 18, fill=True, stroke=False)
    canvas.setFillColor(SILVER)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(20, 6, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | Isometric Roguelike Pivot Applied")
    canvas.drawRightString(letter[0] - 20, 6, f"Page {doc.page}")
    canvas.restoreState()

def build_pdf():
    output_path = r"C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade\Lesters_Arcade_HMH_Full_Analysis.pdf"
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.45*inch
    )
    
    styles = create_styles()
    story = []
    
    # TITLE
    story.append(Spacer(1, 0.8*inch))
    story.append(Paragraph("LESTER'S ARCADE + HARD MONEY HEROES", styles['MainTitle']))
    story.append(Paragraph("Comprehensive Ecosystem Analysis, Gap Report & Implementation Roadmap", styles['Subtitle']))
    story.append(Paragraph(f"<b>Prepared:</b> {datetime.now().strftime('%B %d, %Y')} | <b>Version:</b> 1.1 (Isometric Roguelike Pivot Incorporated) | <b>Recipients:</b> Claude Fable, Qwen 3.7, ChatGPT 5.5 Codex", styles['BodyText']))
    story.append(Spacer(1, 0.15*inch))
    
    story.append(Paragraph("<b>EXECUTIVE SUMMARY</b>", styles['SectionHeader']))
    story.append(Paragraph(
        "Lester's Arcade is the parent Web3 arcade portal for LitVM (Litecoin EVM). Hard Money Heroes (HMH) is the flagship cabinet. <b>Recent Pivot (from AGENTS.md):</b> HMH has shifted from pure 2D Metal Slug side-scroller to an <b>isometric run-and-gun roguelike / roguelite survival game</b>. The design bible v2 and build-risk review v2.1 are now canon. This analysis incorporates that pivot while preserving the original quarter-arcade vision (difficult but masterable, target times per level, most players lose on later levels).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Overall Assessment:</b> Excellent architectural foundation (lazy cabinet loading, detailed manifests, contract skeletons, combat state machine, weapon upgrade system, roguelike run tracking). However, the game is not yet 'viable fun engaging addictive'. The isometric pivot adds significant scope (isometric tilesets, 8-way animations, camera, pathfinding). Current code still reflects much of the 2D side-scroller implementation. Balancing, timing enforcement, mobile controls, persistence, and Web3 paid-mode are incomplete. The parent-app cross-game tracking promise is not yet realized in code.",
        styles['BodyText']
    ))
    
    story.append(PageBreak())
    
    # VISION TABLE
    story.append(Paragraph("1. VISION vs REALITY — DETAILED GAP TABLE", styles['SectionHeader']))
    
    vision_data = [
        ['Domain', 'User Vision (Quarter-Arcade + Web3 Ecosystem)', 'Current Code State (incl. Isometric Pivot)'],
        ['Levels & Timing', '4 levels: L1=5min easy complete, L2=6min, L3=8min, L4=10min. Brutal later levels. Most players lose. Mastery = sub-target with high extraction score.', '3 levels defined in arcade-core (Slums, Tower, Getaway). No Level 4. No time gates or extraction scoring. StageIndex exists but no timing enforcement. Isometric pivot requires new level design for isometric camera.'],
        ['Characters', '2 playable: Lester (Lit Commando — tanky) + Lilly (Lit Valkyrie — same moveset, different art). Unlockables later.', 'Both selectable in character-select. Lester primary; Lilly art stubs in generated assets. No mechanical differentiation yet. Isometric 8-way sprites needed for both.'],
        ['Gameplay Style', 'Isometric roguelike survival (post-pivot) with run-and-gun feel, roguelike upgrades, bosses, procedural districts, addictive loop.', 'Combat state (1135+) has bullets, enemies, powerups, weaponUpgrades, roguelikeRun, waves, boss, scroll (legacy 2D). Isometric camera, pathfinding, tile chunks, 8-way animations not yet in main loop. Design bible v2 now canon.'],
        ['Difficulty Curve', 'Easy start (L1 5min), increasingly punishing. Quarter model: take quarters fast but reward mastery. Most lose on L3/L4.', 'No balancing data or playtests. Enemy density, spawn rates, boss patterns not tuned to target times. Roguelike upgrades exist but untested for dopamine/synergy.'],
        ['Controls', 'Desktop: WASD + mouse aim autofire, LClick manual, RClick/F grenade. Mobile: twin-stick + NADE/POWER. Smooth 8-dir (now 8-way isometric) sprite blending.', 'Desktop input present. Mobile twin-stick incomplete. 8-dir blending in heroRotationSprite but isometric 8-way + camera-relative aiming not implemented.'],
        ['Web3 Parent App', 'Single wallet identity across all cabinets. Shared profiles, achievements, leaderboards, stat tracking, display names. Paid $0.25 USDC sessions with fee splits (dev 55%, tournament 18%, etc.). Anti-cheat verifier.', 'Mock wallet + profile system. Full contract skeletons (SessionLedger, PlayerProfileRegistry, AchievementRegistry, PaymentRouter, GameRegistry). No LitVM deployment, no real paid flow, no cross-game persistence. Free mode works; paid simulated.'],
        ['Leaderboards & Stats', 'Cadence (daily/weekly/all-time), extraction score, assist flags, practice vs ranked separation, cross-game aggregation.', 'leaderboard-engine.mjs + username-registry.mjs exist. In-memory only. No persistence, no extraction formula, no cross-cabinet schema.'],
        ['Art & Animation', 'Isometric tilesets/chunks, 8-way hero/enemy/boss coverage, upgrade UI/icons, VFX. PixelLab 2500-image plan. 4 keyarts. Directional sprites.', 'Extensive generated manifests (hmh-animated-roster, hmh-enemies-wave, hmh-fx-powerups, hmh-level-environment, etc.). Isometric wave-1 and wave-2 manifests exist. Many stubs. 2D legacy assets still referenced in places.'],
        ['Performance', 'Fast portal load, lazy game assets, stable 60fps on desktop/mobile, responsive.', 'Portal shell ~530KB + lazy manifests. Live site 0.26s/31KB excellent. No FPS instrumentation exposed. Isometric rendering perf unknown (more draw calls).'],
    ]
    
    vision_table = Table(vision_data, colWidths=[1.1*inch, 2.6*inch, 2.9*inch])
    vision_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LITECOIN_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, SILVER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#0F1624'), HexColor('#161B2E')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(vision_table)
    story.append(Spacer(1, 0.1*inch))
    
    story.append(Paragraph(
        "<b>Core Gap:</b> The isometric pivot (AGENTS.md) has not been fully reflected in the combat loop yet. Much of main.js and arcade-core still carries 2D side-scroller assumptions (scroll, GROUND_Y, legacy LESTER_BLASTER names). The design bible v2.1 and build-risk review must be treated as the new source of truth for isometric implementation.",
        styles['BodyText']
    ))
    
    story.append(PageBreak())
    
    # DETAILED SECTIONS
    story.append(Paragraph("2. DETAILED ANALYSIS BY DOMAIN", styles['SectionHeader']))
    
    story.append(Paragraph("2.1 Portal UI/UX, User Flow, Load Speed", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Strengths:</b> Full-bleed key art backgrounds with scrims, consistent branding, cabinet grid, character select with stats (Power/Speed/Armor/Luck), free vs paid mode selection, music/sfx toggles, responsive canvas + DPR + fullscreen support. Live site loads in 0.264s (31KB).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Issues:</b> No progress indicator during lazy loadHMHGame() (9+ dynamic imports). Character/cabinet selection lacks hover feedback and keyboard nav. Profile and leaderboards pages are UI stubs without real persistence or Web3 wiring. Mobile touch targets adequate but not optimized. No first-time onboarding/tutorial. Isometric pivot requires new UI for isometric camera controls or minimap.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Actions:</b> Add loading overlay with % during asset import. Implement tutorial modal with desktop vs mobile control diagrams. Make profile/leaderboard fully functional with localStorage first. Add 'How to Play' with isometric movement explanation.",
        styles['BodyText']
    ))
    
    story.append(Paragraph("2.2 Game Loading, Sprites, Animations, Physics (Isometric Pivot Impact)", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Current:</b> Lazy loader imports pixellab calibration, isometric wave-1/2, production art, level environment, enemies, animated roster, complete animations, fx powerups. Combat state tracks playerX/Y, velocity, bullets, enemies, powerUps, weaponUpgrades, roguelikeRun, boss, waves, scroll (legacy). 8-dir sprite blending exists but needs 8-way isometric conversion + camera-relative aiming.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Isometric-Specific Gaps:</b> No isometric camera, no tile chunk rendering, no pathfinding for enemies, no elevation/height handling, no isometric sprite projection. 2D scroll and GROUND_Y assumptions still dominate. Many generated manifests are stubs or 2D-oriented. PixelLab queue ready but integration incomplete.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Recommendations:</b> Create a new isometric renderer module that consumes the hmh-isometric-pixellab manifests. Implement fixed-timestep loop with performance instrumentation. Add error boundary around rAF to prevent permanent freeze on draw error. Profile draw calls for mobile. Implement deterministic RNG for future replays/anti-cheat.",
        styles['BodyText']
    ))
    
    story.append(Paragraph("2.3 Gameplay Mechanics, Controls, Game UI", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Desktop:</b> WASD + mouse aim, autofire + manual fire, grenade, crouch, double-jump, invuln frames, dash/melee planned. 8-dir blending present.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Mobile:</b> Twin-stick + NADE/POWER buttons planned but incomplete. Touch-drag with auto-fire on nearest enemy stubbed.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Isometric Impact:</b> Controls must shift to camera-relative movement and aiming (common in isometric roguelikes). No visual control hints during play. Upgrade menu (levelUpChoices) exists but UI/UX minimal. No pause menu, no on-screen stats beyond DOM bar (score, kills, combo, health, grenades, weapon).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Actions:</b> Add on-screen control legend (fade after 10s). Implement proper virtual joysticks for mobile with haptic. Add weapon hotkeys/wheel. Make roguelike upgrade cards visually rich with icons from power-up manifests. Add extraction score + time bonus UI. Implement pause with control reminder and settings (gore toggle, assist, volume).",
        styles['BodyText']
    ))
    
    story.append(Paragraph("2.4 Level Design, Balancing, Target Times (4-Level Vision)", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Current Levels:</b> The Slums (Rug Pull Baron), The Tower (Influencer/Mr. NGMI), The Getaway (Quantum Hacker). Enemy teaching per district defined. No Level 4. No timing, no extraction scoring, no difficulty scaling with stageIndex or elapsed time.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Isometric Pivot Effect:</b> Isometric levels require new tile-based design, landmark templates (observatories, lighthouses, data hubs, ruins), biome hooks (toxic_cloud, reveal_minimap, disable_cameras, hidden_loot). Procedural districts still valid but must be re-expressed isometrically.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Recommended 4-Level Structure with Target Times:</b><br/>"
        "• <b>Level 1 — The Slums (5 min target, easy complete):</b> Low density, generous power-ups, simple patterns, 1 mini-boss + 1 boss. Teach core isometric movement, shooting, grenade, upgrade. Time bonus for sub-4:30. Extraction score = base + time + no-damage + combo.<br/>"
        "• <b>Level 2 — The Tower (6 min):</b> Vertical ascent emphasis (isometric height), increased density, 2 mini-bosses, boss phase 2. Environmental hazards (toxic_cloud, cameras).<br/>"
        "• <b>Level 3 — The Getaway (8 min):</b> Auto-scroll train sections (isometric perspective), high density, complex combinations, boss rush elements. Time pressure from moving platform.<br/>"
        "• <b>Level 4 — The Vault / Mempool Abyss (10 min, near impossible):</b> Ultimate test — all mechanics + new ones (memory corruption, multi-boss), minimal power-ups, 3-phase final boss. Most players lose here. Mastery = consistent sub-9:00 with perfect play + high extraction.<br/>"
        "Add global run timer with urgency color shift at 80% target. Separate 'Overtime / Endless' board for extraction scoring. Daily deterministic seed boards. Assist-On/Off flags.",
        styles['BodyText']
    ))
    
    story.append(PageBreak())
    
    story.append(Paragraph("2.5 Enemies, Bosses, Power-ups, Animations", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Enemies (P0 from OPEN_QUESTIONS):</b> FUD Goblin, Trench Degen, Paper Hands, Rug Rat, Evil Banker, Gas Beast + bonus (Gas Fee Wisp, Whale Dumper). Thematic per-district weighting. 5 PixelLab bonus. Isometric 8-way animations required (manifests exist but behaviors incomplete).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Bosses:</b> 10 canonical (Rug Pull Baron first, Influencer, Quantum Hacker, Warren, etc.). Patterns: lane-charge, summon-minions, floor-shockwave, lobbed-projectiles, homing-orb, safe-lane-sweep, ranged-burst + phase 2/3 supers. Implementation depth unknown; isometric boss sprites and patterns need full wiring.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Power-ups / Roguelike:</b> 60+ skill library (offensive/defensive/mobility/utility/economy/control/throwable/status), 3 weapon-tree branches per upgrade, timed effects (magnet, slowEnemies, berserk). FX manifests ready. Upgrade menu stub exists. Synergy and risk/reward not tuned for addictiveness.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Actions:</b> Implement behavior tree or FSM for enemies with telegraph frames (red flash). Add elite variants. Fully wire 7+ boss patterns + phase transitions with safe counterplay windows. Make power-ups visually distinct with short descriptions. Add synergy system (e.g. Magnet + Coin Blaster). Playtest against target times and adjust spawn rates/HP/damage until curve matches vision.",
        styles['BodyText']
    ))
    
    story.append(Paragraph("2.6 Stat Tracking, Leaderboards, Profiles, Cross-Game Ecosystem", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Tracked (in-memory):</b> score, kills, combo, maxCombo, damageCombo, noDamageSeconds, powerUpsCollected, killsByType, bossKills, longestSurvival, shots, meleeSwings, grenades, weaponUpgrades, roguelikeRun. Leaderboard cadences and username functions exist.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Critical Missing:</b> No persistence (localStorage/IndexedDB). No cross-game profile schema. No extraction score formula. No achievement unlocking wired to AchievementRegistry. No assist flag or ranked/practice separation in UI. Profiles page lacks achievement gallery, wallet history, cross-cabinet stats.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Parent App Vision Actions:</b> Implement localStorage + IndexedDB persistence layer (P0). Define shared ArcadeProfile schema (displayName, wallet, totalRuns, totalScore, achievements[], lastPlayedGame, crossGameRank) that all cabinets write to. Add Extraction Score = base + timeBonus + noDamageBonus + comboMultiplier - deaths. Separate Assist-On/Off boards. Daily Seed (deterministic) + All-Time. When adding Chikun or future cabinets, enforce shared modules. Add Career Stats dashboard aggregated across games.",
        styles['BodyText']
    ))
    
    story.append(Paragraph("2.7 Web3 Integration & Contracts", styles['SubsectionHeader']))
    story.append(Paragraph(
        "<b>Contracts:</b> PlayerProfileRegistry, GameRegistry, SessionLedger (EIP-712, 250k microUSDC escrow, verifier sig), AchievementRegistry (soulbound), PaymentRouter (15% settlement, 55% dev, 18% tournament, 12% community). LitVM LiteForge config (chainId 4441). DEFAULT_REVENUE_SPLIT_BPS and DEV_WALLET defined.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>State:</b> All skeletons. No deployment. Mock wallet only. Free mode works; paid is UI simulation. Third-party onboarding docs exist but no live example beyond HMH.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Actions:</b> Deploy to LitVM testnet only after explicit Justin approval. Implement trusted verifier signature for score submission (anti-cheat MVP). Add Ranked Session flow requiring wallet signature. Build simple persistence layer + future indexer/subgraph for cross-game queries. Document EIP-712 types and verifier interface for third-party cabinets. Add settlement reserve logic (unused gas → dev bucket).",
        styles['BodyText']
    ))
    
    story.append(PageBreak())
    
    story.append(Paragraph("3. COMPARISONS & BEST PRACTICES (Roguelikes + Retro Arcade)", styles['SectionHeader']))
    story.append(Paragraph(
        "<b>Metal Slug (primary 2D reference, now adapted to isometric):</b> Tight controls, impactful weapons, over-the-top bosses with tells, humorous deaths, high-score chase. HMH should add vehicle/power fantasy sections adapted to isometric (e.g. isometric 'slug' or mounted sections).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Contra / Hard Corps:</b> Weapon switch fantasy, brutal difficulty, co-op potential. Add spread/laser/flamethrower style branches (already planned as tier-3 specials).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Binding of Isaac / Hades:</b> Synergy dopamine, 'I died but learned' loop, risk/reward cards. HMH has 60+ skills and weapon branches — needs the same 'build-crafting' feel. Add Curse/Risk cards that increase difficulty for better rewards. Death screen should show 'What killed you' + 'Best upgrade' + 'Time vs target'.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Enter the Gungeon / Nuclear Throne:</b> Fast, procedural, excellent boss patterns. HMH procedural districts + biome hooks are good; add more isometric room templates and landmark interactions.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Quarter-Arcade Philosophy (Pac-Man, Galaga, Defender, Robotron):</b> High skill ceiling, punishing mistakes, 'one more try'. Enforce target times strictly (lower score or fail extraction if over). Add Continue? screen (paid mode). Make first deaths fair; later deaths feel 'I almost had it'. Add Ghost Run replay of best attempt.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Isometric Roguelike Specific (Hades 3D, Bastion, Transistor, Into the Breach):</b> Camera-relative controls, clear telegraphing, elevation gameplay, pathfinding. HMH isometric must solve aiming relative to camera, height in combat, and readable isometric sprites at 60fps.",
        styles['BodyText']
    ))
    
    story.append(Paragraph("4. BUGS, CODE SMELLS, MISSING PIECES", styles['SectionHeader']))
    story.append(Paragraph(
        "<b>From Inspection:</b><br/>"
        "• Legacy 2D names (LESTER_BLASTER_TACTICAL_CAMERA_MODEL, GROUND_Y, scroll) still in combat state despite isometric pivot.<br/>"
        "• No rAF error boundary — single draw error freezes game permanently.<br/>"
        "• Many generated *.mjs are stubs or 2D-oriented; node --check sweep recommended.<br/>"
        "• Weapon upgrades and roguelike menu exist but not fully wired to isometric combat.<br/>"
        "• Mobile controls incomplete; touch/mouse conflict possible.<br/>"
        "• No anti-cheat even for mock scores.<br/>"
        "• DEV_WALLET address = null; no deployment script.<br/>"
        "• OPEN_QUESTIONS.md lists unapproved items blocking production (refund policy, Overtime board, third-party spec, brand sign-off).",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Missing for Addictive Quarter-Arcade Feel:</b> Sound design (combat music, boss tracks, voice barks, impacts, coin sfx), juice (screen shake, muzzle flash, shell casings, hit-stop, combo popups, gore toggle), progression (unlockables, meta-currency), social (shareable runs, challenges), polish (death screen with stats + retry/change character/leaderboard, pause menu, settings, colorblind modes).",
        styles['BodyText']
    ))
    
    story.append(PageBreak())
    
    story.append(Paragraph("5. PRIORITIZED ROADMAP (Isometric Roguelike + 4-Level Vision)", styles['SectionHeader']))
    
    roadmap_data = [
        ['Prio', 'Task', 'Effort', 'Deps'],
        ['P0', 'Isometric vertical slice: Level 1 (5min target), basic enemy roster (6 types), 1 boss (2 phases), weapon upgrades, roguelike menu, extraction scoring, time bonus. Desktop controls + basic mobile. Isometric camera + 8-way sprites working.', '3-4 weeks', 'Design bible v2, isometric manifests, combat state'],
        ['P0', 'FPS counter, loading progress overlay, rAF error boundary, localStorage persistence for profiles/runs.', '3-5 days', 'None'],
        ['P1', 'Level 2 (vertical ascent, 6min) + 2nd boss. Mobile twin-stick polish + touch QA. Isometric pathfinding for enemies.', '2 weeks', 'P0'],
        ['P1', 'Leaderboards + profiles fully functional (local first). Cross-game ArcadeProfile schema. Extraction score formula.', '1 week', 'P0'],
        ['P2', 'Level 3 (train auto-scroll, 8min) + boss rush elements. Full 10-boss pattern library wired. Sound design pass (combat + boss tracks).', '2-3 weeks', 'P1'],
        ['P2', 'Level 4 (brutal 10min, near impossible). Balancing passes with playtest data against target times. Deterministic RNG seed for Daily boards.', '1-2 weeks', 'P2 L3'],
        ['P3', 'LitVM testnet deployment + real paid session (EIP-712 + verifier). Fee router live (Justin approval). Anti-cheat MVP.', '1-2 weeks', 'All gameplay P2'],
        ['P3', 'Third-party cabinet (Chikun) onboarding + shared ecosystem tracking. Achievement system wired.', '2 weeks', 'P3 Web3'],
        ['Cont.', 'Playtesting, balancing, juice (shake, hit-stop, particles), art integration, mobile QA, docs, isometric-specific polish.', 'Ongoing', 'All'],
    ]
    
    roadmap_table = Table(roadmap_data, colWidths=[0.6*inch, 3.4*inch, 0.9*inch, 1.7*inch])
    roadmap_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CORRUPTION_RED),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.4, SILVER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#0F1624'), HexColor('#161B2E')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(roadmap_table)
    story.append(Spacer(1, 0.1*inch))
    
    story.append(Paragraph(
        "<b>Success Criteria:</b> New player boots site, picks HMH, completes Level 1 in ~5 min on 3rd-5th try, feels 'one more run' pull, sees meaningful upgrade choices, dies to fair but hard boss, immediately wants retry with different build. Most players will not beat Level 4 on first 20 attempts — that's the magic. The parent portal makes them feel part of a persistent ecosystem with single wallet identity across all future cabinets.",
        styles['Highlight']
    ))
    
    story.append(Paragraph("APPENDIX: KEY FILES & OPEN QUESTIONS", styles['SectionHeader']))
    story.append(Paragraph(
        "<b>Primary Files:</b> apps/portal/main.js (8792 lines, combat + portal), apps/portal/src/arcade-core.mjs (3885 lines, data/levels/weapons/leaderboards), apps/portal/src/games/hmh/loader.mjs, apps/portal/src/weapon-upgrades.mjs, contracts/src/*.sol, .hermes/plans/2026-06-04-lesters-arcade-mvp.md, OPEN_QUESTIONS.md, DECISIONS.md, WORKFLOWS.md, AGENTS.md (isometric pivot), docs/game-design/hard-money-heroes-design-bible-v2.md (canon), scripts/pixellab-hmh-2500-queue.json.",
        styles['BodyText']
    ))
    story.append(Paragraph(
        "<b>Critical Open Questions (need Justin sign-off before P3):</b> Real paid asset (USDC on LitVM testnet), entry-credit refund policy, Overtime/Endless board policy, Assist-On vs Off primary board, Daily Seed inclusion, third-party cabinet registration spec (revenue, moderation), brand/legal sign-off for Litecoin/LitVM usage in paid product, exact LitVM RPC/faucet/explorer details before any deployment.",
        styles['BodyText']
    ))
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph(
        "This document is ready for ingestion by Claude Fable, Qwen 3.7, or Codex. All recommendations are grounded in the existing codebase, the isometric pivot in AGENTS.md, the quarter-arcade vision, and the parent-app ecosystem goal. Prioritize the P0 isometric Level 1 vertical slice with enforced 5-min target — everything else follows from a fun, balanced core loop.",
        styles['Footer']
    ))
    
    doc.build(story, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    print(f"PDF successfully generated at: {output_path}")
    return output_path

if __name__ == "__main__":
    build_pdf()

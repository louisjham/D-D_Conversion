import json
import os
from datetime import datetime

locations = [
    {
        "id": "b1-entrance-alcoves",
        "label": "1. Entrance & Alcoves",
        "geometry": {"x": 0, "y": 0, "width": 6, "height": 8},
        "presentation": {
            "biome": "keep",
            "lighting": "torchlit",
            "ambienceTags": ["hewn-stone", "chilly", "magic-mouth"]
        },
        "narrative": {
            "playerFacingDescription": "A 10ft wide corridor of dark hewn stone opens past the overgrown entrance. Three pairs of defensive alcoves line the walls. At the far end, two steps lead up to a grisly intersection where five skeletons lie strewn about a blood-stained flagstone.",
            "gmNotes": [
                "Twin Magic Mouths trigger between the 3rd pair of alcoves shouting warnings of Zelligar and Rogahn.",
                "The dead adventuring party includes a human fighter with a pouch of 5 gold pieces and a wizard pinned to the wall with the word 'QUASQUETON' carved in blood."
            ]
        },
        "exits": [
            {"id": "exit-alcoves-to-dining", "direction": "north", "target": "b1-dining-room"},
            {"id": "exit-alcoves-to-hall-east", "direction": "east", "target": "b1-east-hallway"}
        ],
        "interactables": [
            {
                "id": "twin-magic-mouths",
                "label": "Twin Magic Mouths",
                "description": "Ghostly mouths manifest on the alcove walls, booming: 'WHO DARES ENTER THIS PLACE... WOE TO ANY WHO PASS!'",
                "actionType": "INSPECT"
            },
            {
                "id": "slain-adventurers",
                "label": "Remains of Fallen Explorers",
                "description": "Three dead adventurers and two stronghold guards. Searching the fighter's belt pouch reveals 5 gold pieces. Behind the pinned wizard, the letters 'QUASQUETON' are carved into the bloodstained timber.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "adventurer-pouch-5gp"},
                    {"kind": "setFlag", "flag": "read-quasqueton-name", "value": True}
                ]
            }
        ],
        "secrets": [
            {
                "id": "sec-alcove-oneway",
                "label": "One-Way Secret Guard Door",
                "perceptionDC": 14,
                "revealsExitId": "exit-alcoves-to-hall-east"
            }
        ]
    },
    {
        "id": "b1-dining-room",
        "label": "3. Great Dining Hall",
        "geometry": {"x": 0, "y": 9, "width": 8, "height": 6},
        "presentation": {
            "biome": "keep",
            "lighting": "torchlit",
            "ambienceTags": ["long-table", "tapestries", "echoes"]
        },
        "narrative": {
            "playerFacingDescription": "A spacious dining hall dominated by a long oak banquet table with high-backed chairs. Tattered heraldic banners hang from the dark stone walls.",
            "gmNotes": ["Connects north to Kitchen, south to Alcoves, and west to Lounge."]
        },
        "exits": [
            {"id": "exit-dining-to-alcoves", "direction": "south", "target": "b1-entrance-alcoves"},
            {"id": "exit-dining-to-kitchen", "direction": "north", "target": "b1-kitchen"},
            {"id": "exit-dining-to-lounge", "direction": "west", "target": "b1-lounge"}
        ],
        "interactables": [
            {
                "id": "banquet-candelabra",
                "label": "Tarnished Silver Candelabra",
                "description": "An ornate three-branched silver candelabra sitting at the head of the banquet table.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "silver-candelabra"}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-kitchen",
        "label": "2. Kitchen",
        "geometry": {"x": 0, "y": 16, "width": 6, "height": 6},
        "presentation": {
            "biome": "keep",
            "lighting": "torchlit",
            "ambienceTags": ["ovens", "iron-pots", "scavengers"]
        },
        "narrative": {
            "playerFacingDescription": "A soot-stained food preparation area with large stone hearths, iron spits, and preparation tables littered with gnawed bones.",
            "gmNotes": ["Lair of four sneaky Kobold scavengers who hide behind the iron cookstoves."]
        },
        "exits": [
            {"id": "exit-kitchen-to-dining", "direction": "south", "target": "b1-dining-room"},
            {"id": "exit-kitchen-to-supply", "direction": "east", "target": "b1-supply-room"}
        ],
        "interactables": [
            {
                "id": "cooking-hearth",
                "label": "Stone Fireplace & Kettle",
                "description": "Cold ashes and a rusted cast-iron kettle. Sifting through yields an intact iron skillet.",
                "actionType": "INSPECT"
            }
        ],
        "secrets": [],
        "encounter": {
            "id": "enc-kitchen-kobolds",
            "trigger": {"kind": "always"},
            "enemies": [{"monsterTemplateId": "kobold-scout", "count": 4}],
            "tactics": "Kobolds hurl crude daggers from behind the stoves before engaging in melee.",
            "victoryEffects": [
                {"kind": "setFlag", "flag": "kitchen-cleared", "value": True}
            ]
        }
    },
    {
        "id": "b1-lounge",
        "label": "4. Lounge & Anteroom",
        "geometry": {"x": -9, "y": 9, "width": 7, "height": 6},
        "presentation": {
            "biome": "keep",
            "lighting": "dark",
            "ambienceTags": ["divan", "decaying-carpet", "dust"]
        },
        "narrative": {
            "playerFacingDescription": "A plush resting chamber lined with moldering velvet couches, small drink tables, and a faded wool rug.",
            "gmNotes": ["A loose hollow baseboard conceals an emergency healing draught."]
        },
        "exits": [
            {"id": "exit-lounge-to-dining", "direction": "east", "target": "b1-dining-room"},
            {"id": "exit-lounge-to-wizard", "direction": "north", "target": "b1-wizards-chamber"}
        ],
        "interactables": [
            {
                "id": "velvet-divan",
                "label": "Decaying Velvet Divan",
                "description": "Faded crimson upholstery stuffed with straw. Moth-eaten cushions are scattered about.",
                "actionType": "INSPECT"
            }
        ],
        "secrets": [
            {
                "id": "sec-lounge-stash",
                "label": "Concealed Wall Niche",
                "perceptionDC": 13,
                "grantsItemId": "potion-healing"
            }
        ]
    },
    {
        "id": "b1-wizards-chamber",
        "label": "5. Wizard's Chamber (Zelligar's Abode)",
        "geometry": {"x": -9, "y": 16, "width": 8, "height": 8},
        "presentation": {
            "biome": "crypt",
            "lighting": "torchlit",
            "ambienceTags": ["carved-bed", "epic-frieze", "wizardry"]
        },
        "narrative": {
            "playerFacingDescription": "An austere and imposing master chamber. A grand 70-foot stone frieze along the north wall depicts Zelligar the Unknown casting spells over an army fleeing in terror. In the corner stands an ornate rosewood bed with 'ZELLIGAR' carved in gleaming gold leaf.",
            "gmNotes": [
                "Nightstand drawer is locked and fitted with a pain-inducing spring pin trap.",
                "Door to the south leads to Zelligar's private closet."
            ]
        },
        "exits": [
            {"id": "exit-wizard-to-lounge", "direction": "south", "target": "b1-lounge"},
            {"id": "exit-wizard-to-closet", "direction": "west", "target": "b1-wizards-closet"},
            {"id": "exit-wizard-to-annex", "direction": "east", "target": "b1-wizards-annex"}
        ],
        "interactables": [
            {
                "id": "zelligar-rosewood-bed",
                "label": "Zelligar's Carved Bed",
                "description": "Heavy rosewood headboard carved with high-relief dragons and Zelligar's sigil in real gold leaf.",
                "actionType": "INSPECT"
            },
            {
                "id": "trapped-nightstand",
                "label": "Trapped Rosewood Nightstand",
                "description": "A brass-handled nightstand with a concealed needle trap. Opening without disarming inflicts sharp stinging pain.",
                "inspectionCheck": {"ability": "investigation", "dc": 14},
                "onInspectEffects": [
                    {"kind": "setFlag", "flag": "nightstand-inspected", "value": True}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-wizards-closet",
        "label": "6. Zelligar's Closet",
        "geometry": {"x": -17, "y": 16, "width": 6, "height": 6},
        "presentation": {
            "biome": "crypt",
            "lighting": "dark",
            "ambienceTags": ["robes", "bookstand", "strongbox"]
        },
        "narrative": {
            "playerFacingDescription": "A large wardrobe room smelling of cedar, dust, and dried herbs. Dusty velvet cloaks hang from wall pegs. A heavy bookstand in the corner holds several massive leather volumes.",
            "gmNotes": ["Contains Zelligar's diary and the heavy bronze key needed to unlock the Great Library (Area 12)."]
        },
        "exits": [
            {"id": "exit-closet-to-wizard", "direction": "east", "target": "b1-wizards-chamber"}
        ],
        "interactables": [
            {
                "id": "zelligar-bookstand",
                "label": "Bookstand of Tomes",
                "description": "Four hefty leather-bound volumes: a regional history, an elven botanical treatise, a weather journal, and Zelligar's personal travel diary.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "zelligar-diary"}
                ]
            },
            {
                "id": "wardrobe-strongbox",
                "label": "Iron-Banded Strongbox",
                "description": "Resting under old cloaks is a small reinforced chest. Inside lies a heavy bronze key engraved with an open book.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "bronze-library-key"}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-wizards-annex",
        "label": "7. Wizard's Annex",
        "geometry": {"x": 0, "y": 23, "width": 6, "height": 6},
        "presentation": {
            "biome": "crypt",
            "lighting": "torchlit",
            "ambienceTags": ["pedestal", "runes", "scrying"]
        },
        "narrative": {
            "playerFacingDescription": "A small hexagonal study with arcane sigils etched into the stone floor. A carved basalt pedestal stands in the center of the room.",
            "gmNotes": ["Connects Zelligar's chamber to his deeper laboratories and workrooms."]
        },
        "exits": [
            {"id": "exit-annex-to-wizard", "direction": "west", "target": "b1-wizards-chamber"},
            {"id": "exit-annex-to-workroom", "direction": "north", "target": "b1-wizards-workroom"}
        ],
        "interactables": [
            {
                "id": "basalt-pedestal",
                "label": "Basalt Scrying Pedestal",
                "description": "A circular pedestal carved with astrological signs. A shallow indentation at the top once held a magical sphere.",
                "actionType": "INSPECT"
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-wizards-workroom",
        "label": "8. Wizard's Workroom",
        "geometry": {"x": 0, "y": 30, "width": 8, "height": 6},
        "presentation": {
            "biome": "crypt",
            "lighting": "torchlit",
            "ambienceTags": ["workbenches", "alembics", "glassware"]
        },
        "narrative": {
            "playerFacingDescription": "Long sturdy workbenches fill this room, covered in copper alembics, glass beakers, mortar and pestles, and jars of dried reagents.",
            "gmNotes": ["Passage north connects into the main Laboratory (Area 9)."]
        },
        "exits": [
            {"id": "exit-workroom-to-annex", "direction": "south", "target": "b1-wizards-annex"},
            {"id": "exit-workroom-to-lab", "direction": "north", "target": "b1-wizards-laboratory"}
        ],
        "interactables": [
            {
                "id": "alchemy-bench",
                "label": "Alchemical Worktable",
                "description": "Beakers filled with crystalized residues. A sealed glass flask contains refined lamp oil.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "oil-flask"}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-wizards-laboratory",
        "label": "9. Wizard's Laboratory",
        "geometry": {"x": 0, "y": 37, "width": 10, "height": 8},
        "presentation": {
            "biome": "crypt",
            "lighting": "torchlit",
            "ambienceTags": ["glowing-vats", "acrid-smoke", "ambush"]
        },
        "narrative": {
            "playerFacingDescription": "A cavernous vaulted laboratory dominated by three large stone vats filled with murky glowing liquid. The air smells of sulfur, brimstone, and musk.",
            "gmNotes": [
                "Two Troglodytes lurk in the shadows behind the northern chemical vats.",
                "A secret rotating wall slab to the east leads to the concealed Storeroom (Area 10)."
            ]
        },
        "exits": [
            {"id": "exit-lab-to-workroom", "direction": "south", "target": "b1-wizards-workroom"},
            {
                "id": "exit-lab-to-secret-store",
                "direction": "east",
                "target": "b1-secret-storeroom",
                "visibleWhen": {
                    "kind": "flag",
                    "flag": "sec-lab-revolving-door-discovered",
                    "equals": True
                }
            }
        ],
        "interactables": [
            {
                "id": "glowing-chemical-vats",
                "label": "Bubbling Alchemical Vats",
                "description": "Stone vats filled with luminescent teal liquid that casts eerie flickering shadows across the vaulted ceiling.",
                "actionType": "INSPECT"
            }
        ],
        "secrets": [
            {
                "id": "sec-lab-revolving-door",
                "label": "Revolving Stone Wall Panel",
                "perceptionDC": 14,
                "revealsExitId": "exit-lab-to-secret-store"
            }
        ],
        "encounter": {
            "id": "enc-lab-troglodytes",
            "trigger": {"kind": "always"},
            "enemies": [{"monsterTemplateId": "troglodyte-lurker", "count": 2}],
            "tactics": "Troglodytes leap out from behind the glowing vats attempting to surround and overwhelm intruders.",
            "victoryEffects": [
                {"kind": "setFlag", "flag": "troglodytes-defeated", "value": True}
            ]
        }
    },
    {
        "id": "b1-secret-storeroom",
        "label": "10. Secret Storeroom",
        "geometry": {"x": 12, "y": 37, "width": 6, "height": 6},
        "presentation": {
            "biome": "crypt",
            "lighting": "dark",
            "ambienceTags": ["hidden-vault", "treasure", "spiders"]
        },
        "narrative": {
            "playerFacingDescription": "A sealed secret chamber, untouched by looters. Cobwebs drape over stacked wooden crates and an iron-reinforced chest.",
            "gmNotes": ["Accessible only by discovering the secret revolving door in the Laboratory."]
        },
        "exits": [
            {"id": "exit-secret-store-to-lab", "direction": "west", "target": "b1-wizards-laboratory"}
        ],
        "interactables": [
            {
                "id": "zelligar-vault-chest",
                "label": "Ornate Ironbound Chest",
                "description": "A heavy locked chest. Opening reveals 100 silver pieces, 50 gold pieces, and a pristine healing potion.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "potion-healing"}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-supply-room",
        "label": "11. Supply Room",
        "geometry": {"x": 8, "y": 16, "width": 6, "height": 6},
        "presentation": {
            "biome": "keep",
            "lighting": "torchlit",
            "ambienceTags": ["crates", "barrels", "provisions"]
        },
        "narrative": {
            "playerFacingDescription": "Rows of wooden shelving, dry flour barrels, and iron hardware crates. Most provisions are decayed, but durable adventuring tools remain.",
            "gmNotes": ["Connects west to Kitchen and south to East Hallway."]
        },
        "exits": [
            {"id": "exit-supply-to-kitchen", "direction": "west", "target": "b1-kitchen"},
            {"id": "exit-supply-to-hall", "direction": "south", "target": "b1-east-hallway"}
        ],
        "interactables": [
            {
                "id": "hardware-crate",
                "label": "Adventurer's Supply Crate",
                "description": "A sturdy wooden box containing a 50-foot coil of hempen climbing rope.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "hempen-rope"}
                ]
            }
        ],
        "secrets": []
    },
    {
        "id": "b1-east-hallway",
        "label": "East Hallway & Portals",
        "geometry": {"x": 8, "y": 0, "width": 6, "height": 8},
        "presentation": {
            "biome": "keep",
            "lighting": "torchlit",
            "ambienceTags": ["corridor", "bronze-doors", "library-approach"]
        },
        "narrative": {
            "playerFacingDescription": "A wide stone corridor lit by bracketed torches. At the northern end stands a pair of massive, ornately embossed bronze double doors with a heavy keyhole.",
            "gmNotes": ["The bronze doors lead to the Great Library (Area 12) and require the bronze-library-key from Area 6."]
        },
        "exits": [
            {"id": "exit-hall-to-alcoves", "direction": "west", "target": "b1-entrance-alcoves"},
            {"id": "exit-hall-to-supply", "direction": "north", "target": "b1-supply-room"},
            {
                "id": "exit-hall-to-library",
                "direction": "east",
                "target": "b1-library",
                "locked": {
                    "keyItemId": "bronze-library-key",
                    "pickable": True,
                    "lockpickDC": 16
                }
            }
        ],
        "interactables": [],
        "secrets": []
    },
    {
        "id": "b1-library",
        "label": "12. Quasqueton Great Library",
        "geometry": {"x": 16, "y": 0, "width": 10, "height": 8},
        "presentation": {
            "biome": "crypt",
            "lighting": "torchlit",
            "ambienceTags": ["grand-library", "tomes", "climax"]
        },
        "narrative": {
            "playerFacingDescription": "A magnificent two-story library lined with towering mahogany bookshelves. Dust motes drift in the stillness. A central lectern of carved marble holds a legendary bound codex illuminated with silver foil.",
            "gmNotes": ["The ultimate lore prize of the Upper Level: The Chronicles of Quasqueton."]
        },
        "exits": [
            {"id": "exit-library-to-hall", "direction": "west", "target": "b1-east-hallway"}
        ],
        "interactables": [
            {
                "id": "marble-lectern-codex",
                "label": "The Chronicles of Quasqueton",
                "description": "The lost historical codex detailing the rise of Zelligar and Rogahn and the layout of the deep subterranean vaults.",
                "actionType": "INSPECT",
                "onInspectEffects": [
                    {"kind": "grantItem", "itemId": "quasqueton-chronicles"},
                    {"kind": "setFlag", "flag": "quest-complete-library", "value": True}
                ]
            }
        ],
        "secrets": []
    }
]

items = [
    {
        "id": "adventurer-pouch-5gp",
        "name": "Pouch of 5 Gold Pieces",
        "type": "treasure",
        "description": "A weathered leather belt pouch containing five minted gold coins.",
        "valueCoins": 5
    },
    {
        "id": "silver-candelabra",
        "name": "Tarnished Silver Candelabra",
        "type": "treasure",
        "description": "A heavy three-branched silver candelabra salvaged from the great banquet hall.",
        "valueCoins": 25
    },
    {
        "id": "potion-healing",
        "name": "Potion of Healing",
        "type": "potion",
        "description": "A ruby-red draught that restores hit points."
    },
    {
        "id": "bronze-library-key",
        "name": "Bronze Library Key",
        "type": "key",
        "description": "A heavy antique bronze key stamped with the book sigil of Quasqueton."
    },
    {
        "id": "zelligar-diary",
        "name": "Zelligar's Personal Diary",
        "type": "quest",
        "description": "A handwritten parchment journal in Zelligar's hand detailing ancient expeditions."
    },
    {
        "id": "oil-flask",
        "name": "Flask of Refined Lamp Oil",
        "type": "treasure",
        "description": "Pure alchemical oil suitable for lanterns or hurling as a fire weapon."
    },
    {
        "id": "hempen-rope",
        "name": "50ft Hempen Rope",
        "type": "treasure",
        "description": "Sturdy braided rope with an iron grappling hook."
    },
    {
        "id": "quasqueton-chronicles",
        "name": "The Chronicles of Quasqueton",
        "type": "quest",
        "description": "The master historical tome revealing the lost lore of Zelligar the Unknown and Rogahn the Fearless."
    }
]

monsters = [
    {
        "id": "kobold-scout",
        "name": "Kobold Scout",
        "hp": 4,
        "ac": 13,
        "attackBonus": 3,
        "damageRoll": "1d4+1"
    },
    {
        "id": "troglodyte-lurker",
        "name": "Troglodyte Lurker",
        "hp": 10,
        "ac": 15,
        "attackBonus": 4,
        "damageRoll": "1d4+2"
    }
]

quests = [
    {
        "id": "quest-quasqueton-library",
        "title": "Breach the Lost Library of Quasqueton",
        "description": "Search the upper stronghold of Zelligar the Unknown, locate his bronze library key, and recover the Chronicles of Quasqueton.",
        "completionCondition": {
            "kind": "flag",
            "flag": "quest-complete-library",
            "equals": True
        },
        "rewards": [
            {"kind": "grantItem", "itemId": "adventurer-pouch-5gp"},
            {"kind": "setFlag", "flag": "quest-complete-library", "value": True}
        ]
    }
]

b1_adventure = {
    "schemaVersion": "0.1",
    "metadata": {
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "importedBy": "extractor",
        "source": "TSR 9023 - B1 In Search of the Unknown (Mike Carr, 1979)"
    },
    "adventure": {
        "id": "b1-in-search-of-the-unknown",
        "title": "B1: In Search of the Unknown (Quasqueton Stronghold)",
        "systemProfile": "classic-dungeon",
        "summary": "The legendary subterranean stronghold of Rogahn the Fearless and Zelligar the Unknown. Players explore the finished upper chambers, solve the mystery of the fallen adventurers, find Zelligar's key, and breach the Great Library.",
        "start": "b1-entrance-alcoves",
        "locations": locations,
        "items": items,
        "monsters": monsters,
        "npcs": [],
        "quests": quests
    }
}

out_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "packages", "fixtures", "src", "b1InSearchOfTheUnknown.json"
)

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(b1_adventure, f, indent=2)

print(f"B1 Quasqueton IR generated successfully at: {out_path}")
print(f"Total Locations: {len(locations)}")
print(f"Total Items: {len(items)}")
print(f"Total Monsters: {len(monsters)}")

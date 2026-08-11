import { VersionedCampaign } from "@grimoire3d/campaign-ir";

export const b2Campaign: VersionedCampaign = {
  schemaVersion: "0.1",
  campaign: {
    id: "b2-keep-on-the-borderlands-campaign",
    title: "B2: The Keep on the Borderlands — Campaign Expedition",
    description: "Operate out of the fortified Keep on the Borderlands, purchase supplies, recruit allies, gather rumors, and launch expeditions into the Ravine of Chaos.",
    startingRegionId: "greywatch-keep",
    startingNodeId: "keep-courtyard",
    regions: [
      {
        id: "greywatch-keep",
        title: "The Keep on the Borderlands (Base Hub)",
        kind: "hub",
        controllingFactionId: "keep-garrison",
        nodes: [
          { id: "keep-courtyard", name: "Keep Main Yard", kind: "hub", regionId: "greywatch-keep" },
          { id: "keep-gate", name: "Main Gatehouse", kind: "hub", regionId: "greywatch-keep" },
          { id: "keep-tavern-node", name: "The Traveler's Tavern", kind: "hub", regionId: "greywatch-keep" },
          { id: "keep-store-node", name: "Provisioner & Trader Guild", kind: "hub", regionId: "greywatch-keep" },
          { id: "keep-hall-node", name: "Castellan Court", kind: "hub", regionId: "greywatch-keep" }
        ],
        edges: [
          {
            id: "north-road-to-ravine",
            name: "North Borderlands Road",
            fromNodeId: "keep-gate",
            toNodeId: "ravine-entrance",
            durationHours: 4,
            riskProfile: "moderate",
            travelEventTableId: "borderlands-encounters",
            requirements: []
          }
        ],
        services: [
          { id: "tavern-service", name: "The Traveler's Tavern & Inn", kind: "inn", description: "Rest, warm stew, and rumor gathering from off-duty guards and merchants." },
          { id: "provisioner-service", name: "Keep Provisioner & Trade Guild", kind: "provisioner", description: "Purchase adventure gear: iron rations, torches, ropes, healing draughts, and weapons." },
          { id: "bank-service", name: "Bailiff Loan Bank", kind: "provisioner", description: "Exchange copper/silver coins for gold and deposit dungeon treasure." },
          { id: "castellan-service", name: "Castellan Court Bounties", kind: "quest-contact", description: "Claim bounties for clearing monster caves and receive official writs." }
        ],
        rumors: [
          {
            id: "rumor-kobold-gold",
            title: "Kobold Chieftain's Hoard",
            text: "A merchant in the tavern claims the Kobold Chieftain in Cave A guards a locked brass chest containing ancient coins.",
            sourceServiceId: "tavern-service",
            truth: "true"
          },
          {
            id: "rumor-ogre-silver-key",
            title: "The Ogre's Silver Key",
            text: "A wounded scout reported a massive Ogre dwelling in Cave E who wears a glowing silver key around his neck.",
            sourceServiceId: "tavern-service",
            truth: "true"
          },
          {
            id: "rumor-shrine-of-chaos",
            title: "Dark Cult in the Ravine",
            text: "The Castellan warns of a secretive cult of Chaos operating a blasphemous temple deep in the ravine catacombs.",
            sourceServiceId: "castellan-service",
            truth: "true"
          }
        ],
        factions: [
          {
            id: "keep-garrison",
            name: "Keep Garrison of Realm Law",
            description: "Soldiers and guards defending the borderlands against chaotic incursions.",
            initialStrength: 100,
            initialAlert: 10,
            initialDisposition: 75,
            territory: ["greywatch-keep"],
            goals: ["Maintain border security", "Eradicate monster caves"],
            allies: ["merchants"],
            enemies: ["caves-chaos-alliance"]
          },
          {
            id: "caves-chaos-alliance",
            name: "The Horde of Chaos",
            description: "Loose coalition of Kobolds, Orcs, Goblins, Bugbears, and Cultists lurking in the Ravine.",
            initialStrength: 120,
            initialAlert: 20,
            initialDisposition: -100,
            territory: ["broken-ravine"],
            goals: ["Ambush border trade", "Spread Chaos"],
            allies: ["shrine-cultists"],
            enemies: ["keep-garrison"]
          }
        ],
        quests: [
          {
            id: "quest-bounty-kobolds",
            title: "Bounty: Clear Kobold Cave A",
            description: "Eradicate the Kobold guards and chieftain in Cave A.",
            targetEntityId: "cave-a-chieftain",
            rewardGold: 100,
            factionId: "keep-garrison"
          },
          {
            id: "quest-slay-ogre",
            title: "Bounty: Slay the Ogre Brute",
            description: "Defeat the Ogre in Cave E and bring back the Silver Key.",
            targetEntityId: "cave-e-ogre",
            rewardGold: 250,
            factionId: "keep-garrison"
          },
          {
            id: "quest-destroy-shrine",
            title: "Vanquish the Shrine of Chaos",
            description: "Enter the deep catacombs of Cave J and defeat the High Priest of Chaos.",
            targetEntityId: "cave-j-altar",
            rewardGold: 500,
            factionId: "keep-garrison"
          }
        ]
      },
      {
        id: "broken-ravine",
        title: "The Ravine of Chaos (Dungeon Complex)",
        kind: "dungeon-complex",
        adventureId: "b2-keep-on-the-borderlands",
        controllingFactionId: "caves-chaos-alliance",
        nodes: [
          { id: "ravine-entrance", name: "Ravine Entrance Rim", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-a-node", name: "Cave A: Kobold Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-b-node", name: "Cave B: Orc Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-c-node", name: "Cave C: Goblin Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-d-node", name: "Cave D: Hobgoblin Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-e-node", name: "Cave E: Ogre Cave", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-f-node", name: "Cave F: Owlbear Cave", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-g-node", name: "Cave G: Bugbear Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-h-node", name: "Cave H: Minotaur Cave", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-i-node", name: "Cave I: Gnoll Lair", kind: "expedition-site", regionId: "broken-ravine" },
          { id: "cave-j-node", name: "Cave J: Shrine of Chaos", kind: "expedition-site", regionId: "broken-ravine" }
        ],
        edges: [
          {
            id: "ravine-to-keep-road",
            name: "South Trail to Keep",
            fromNodeId: "ravine-entrance",
            toNodeId: "keep-gate",
            durationHours: 4,
            riskProfile: "moderate",
            travelEventTableId: "borderlands-encounters",
            requirements: []
          }
        ],
        services: [],
        rumors: [],
        factions: [],
        quests: []
      }
    ]
  }
};

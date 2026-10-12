/**
 * Placeholder campaign. The structure (prologue in 1938, a first door to Rome, then an open
 * "learn why they fell" investigation across every era, then the finale) is meant to be
 * rewritten; the data shape is what matters.
 */
import type { Quest, QuestStep } from './types';
import { getEra } from '../eras';
import { SITES } from '../world/macro';

const VARGA = { name: 'Professor Ada Varga', role: 'Historian', look: { body: 0x4a3a5a, legs: 0x2a2a2a, skin: 0xe8c8a8, hat: 'none' as const, hatColor: 0 } };
const DANNY = { name: 'Danny', role: 'Newsboy', look: { body: 0x7a6a5a, legs: 0x4a4a4a, skin: 0xe0c0a0, hat: 'cap' as const, hatColor: 0x5a4a3a } };
const HALE = { name: 'Cornelius Hale', role: 'Industrialist', look: { body: 0x1a1a22, legs: 0x1a1a22, skin: 0xe8c8a8, hat: 'tophat' as const, hatColor: 0x111111 } };

const LIBRARY = { x: -250, z: -336 }; // library entrance; the Greek door hides in the stacks 35 m north
const DOCKS = { x: SITES.harbor.x - 12, z: SITES.harbor.z - 26 };
const FACTORY = { x: 470, z: 120 };
const MEMORIAL = { x: SITES.plaza.x + 30, z: SITES.plaza.z + 40 };

function talk(era: string, npcId: string, who: { name: string; role: string; look?: Partial<import('../eras/types').NpcArchetype> }, x: number, z: number, objective: string, lines: string[]): QuestStep {
  return { kind: 'talk', era, npcId, name: who.name, role: who.role, x, z, lines, look: who.look, objective };
}
function read(era: string, objectId: string, name: string, x: number, z: number, objective: string, lines: string[]): QuestStep {
  return { kind: 'read', era, objectId, name, x, z, lines, objective };
}

export const CAMPAIGN: Quest[] = [
  {
    id: 'prologue',
    act: 1,
    title: 'Extra, Extra',
    summary: 'A newsboy at the docks, a historian at the library, and a door that is not supposed to exist.',
    requires: [],
    steps: [
      talk('industrial', 'danny1', DANNY, DOCKS.x, DOCKS.z, 'Talk to Danny the newsboy at the Docks', [
        'Eli! You hear the radio? Austria’s gone. Just like that. My pop says it’s 1914 all over again, only this time the planes will come.',
        'Listen, there’s a professor lady at the Old Town library paying two bits for anybody who’s seen the Bureau sealing up doors. You’ve seen one. Down at the bridge. Go tell her.',
      ]),
      talk('industrial', 'varga1', VARGA, LIBRARY.x, LIBRARY.z, 'Find Professor Varga at the Old Town library', [
        'You saw them seal it? Under the Meridian Bridge? Then you saw more than the Bureau wants anyone to see.',
        'They are called chronoports. Rings of stone older than the city. Each one opens on a single year, and the Bureau has made it a crime to use them. The Act of 1921.',
        'My notes say the bridge door opens on Rome, the year Trajan finished his forum. I cannot go. They watch me. You, they do not know yet.',
        'The seal is only a padlock on a gate the Bureau does not understand. Go to the west pier at low water. Come back and tell me what Rome looks like the year it stopped growing.',
      ]),
      { kind: 'goto', era: 'industrial', x: getEra('roman').chronoport!.x, z: getEra('roman').chronoport!.z, radius: 24, objective: 'Go to the west pier of the Meridian Bridge', label: 'Meridian Bridge' },
      { kind: 'findPort', port: 'roman', objective: 'Find the sealed chronoport' },
      { kind: 'travel', era: 'roman', objective: 'Step through the chronoport (press E at the ring)' },
    ],
    revealHints: ['roman'],
    flags: ['met_varga'],
    completeText: 'The ring is warm. The bridge is gone. The year is 112.',
  },
  {
    id: 'rome',
    act: 1,
    title: 'Bread and Circuses',
    summary: 'Rome at its largest. Find out what holds a city of a million together, and what it costs.',
    requires: ['prologue'],
    steps: [
      talk('roman', 'fortunata', { name: 'Fortunata', role: 'Plebeian' }, SITES.plaza.x + 20, SITES.plaza.z + 20, 'Ask around in the Forum', [
        'A stranger in strange clothes, asking how Rome works. Simple. The emperor gives us bread, water and games, and we give him quiet.',
        'Two hundred thousand families on the grain dole. The grain comes from Egypt on ships. If the ships stop, the quiet stops.',
        'You want to know what holds it together? Go up to the Capitol and ask a senator. They own the ships.',
      ]),
      talk('roman', 'pliny', { name: 'Pliny', role: 'Senator', look: { body: 0xf5f0e6, legs: 0xf5f0e6, hat: 'none', hatColor: 0 } }, SITES.citadel.x, SITES.citadel.z + 75, 'Climb to the Capitol and speak with Senator Pliny', [
        'The dole? The dole is cheap. Dacia paid for it. The next war will pay for the next dole. There is always a next war.',
        'You ask what happens when there is no next war. A good question. Nobody who asks it keeps his seat in the Senate.',
        'Go to the Emporium. The harbor master keeps the ledger of every grain ship. Read it, and you will understand Rome better than most emperors.',
      ]),
      read('roman', 'ledger', 'Grain ledger', SITES.harbor.x - 30, SITES.harbor.z - 24, 'Read the grain ledger at the Emporium', [
        'The ledger lists 1,200 ships a year from Alexandria. A note in the margin: "Short by 90 this year. Egypt floods late. Raise the frontier levy."',
        'Every problem in this city is solved by taking something from somewhere further away. The map on the wall shows how far away is left: not far.',
      ]),
      { kind: 'travel', era: 'industrial', objective: 'Return to 1938 through the chronoport' },
      talk('industrial', 'varga2', VARGA, LIBRARY.x, LIBRARY.z, 'Report to Professor Varga', [
        'Overextension. A city that could only stand by growing. Write it down. Every lesson you bring back, write it down.',
        'I have found two more doors. One is under this very building, in the philosophy stacks. The other is at the old North Station. The Bureau has not reached either.',
        'Go. Learn how the old ones ended. All of them, if you can. Somebody has to, before we find out the hard way.',
      ]),
    ],
    insight: 'roman',
    revealHints: ['greek', 'victorian'],
  },
  {
    id: 'hale',
    act: 2,
    title: 'Hale’s Ledger',
    summary: 'The factories on the Eastside are humming again. Find out what they are making.',
    requires: ['rome'],
    steps: [
      talk('industrial', 'walt', { name: 'Walt', role: 'Worker', look: { hat: 'cap', hatColor: 0x3a3a3a } }, FACTORY.x, FACTORY.z, 'Talk to Walt outside the Hale plant on the Eastside', [
        'Hale Armaments. Three shifts. We make shell casings and we do not ask who they are for. The pay is good. The pay is very good.',
        'Hale has Bureau men at the gate. Why does a shell plant need the Bureau of Temporal Compliance? You tell me, kid.',
        'Word is Hale bought the rights to every sealed door in the city. Bought them. From the government. For a dollar each.',
      ]),
      talk('industrial', 'hale1', HALE, SITES.citadel.x, SITES.citadel.z + 60, 'Confront Cornelius Hale on the steps of City Hall', [
        'Mr. Marsh. The professor’s errand boy. I know about the bridge. I know about Rome. I have people in Rome.',
        'You think the doors are a lesson. They are a market. A man who knows the price of grain in every century never loses a trade. A man who knows which wars happen never loses a war.',
        'Keep walking through doors if you like. Every time you do, you tell me which ones work. Good day.',
      ]),
    ],
    flags: ['met_hale'],
    revealHints: ['sengoku', 'aztec', 'mongol'],
    completeText: 'Hale is using you to map the doors. You will need to find the rest before he does.',
  },
  {
    id: 'finale',
    act: 3,
    title: 'The Pattern',
    summary: 'You have seen enough civilizations fall to see the shape of it. Time to say so out loud.',
    requires: ['hale'],
    requiresInsights: 8,
    steps: [
      talk('industrial', 'varga3', VARGA, MEMORIAL.x, MEMORIAL.z, 'Meet Professor Varga at the war memorial', [
        'Eight lessons. Salt in the soil, a river that forgot, one bad day, a web that broke. Fear as a loan, divided cities, an empire of one man, a frontier that was a countdown.',
        'None of them fell to an enemy they could not have beaten. They fell to a problem they had decided not to look at.',
        'Hale wants the doors to make money from the war that is coming. The Bureau wants them sealed so nobody has to think about it. You and I want them open so everybody does.',
        'Write it all down. Put it in the paper. Danny will sell it for two cents. That is how civilizations learn: late, and in print.',
      ]),
      talk('industrial', 'danny2', DANNY, DOCKS.x, DOCKS.z, 'Give the story to Danny at the Docks', [
        'A story about doors in time and every empire that ever fell? Mister, nobody is going to believe a word of it.',
        'Extra! Extra! Read all about it! Two cents! ...They’re buying it, Eli. They’re actually buying it.',
      ]),
    ],
    flags: ['finished_campaign'],
    completeText: 'The story is out. The doors are still open. What you do with the rest of history is up to you.',
  },
];

// One investigation per remaining era, generated from era data with hand-written beats.
interface EraBeat {
  era: string;
  title: string;
  summary: string;
  a: [string, string, string[]]; // name, role, lines (spoken at plaza)
  b: [string, string, string[]]; // spoken at citadel
  c: [string, string[]]; // object name at sacred site, lines
}

const BEATS: EraBeat[] = [
  { era: 'greek', title: 'The Divided City', summary: 'Athens and Thebes have finally allied. Philip is already marching.', a: ['Demosthenes', 'Orator', ['Ten years I told them Philip was coming. They laughed, then they voted me the theatre budget to shut me up.', 'Now Thebes is with us. Now. A month before the battle. Go up to the Acropolis and ask the generals how long they have trained together.']], b: ['Phocion', 'General', ['Two armies that hated each other a year ago, standing in one line. The line will hold until it does not.', 'Chaeronea. Next week. Philip’s son is eighteen and commands the cavalry. His name is Alexander. Remember it.', 'The oracle at the sacred grove has the decree of the alliance carved in stone. Read how long it took to agree.']], c: ['Decree of Alliance', ['"Resolved, in the archonship of Chaerondas, that Athens and Thebes make common cause." The date is this spring. The quarrel it ends began before the signers were born.', 'A hundred years of free cities, united for one month, by a man they could have stopped ten years ago.']] },
  { era: 'victorian', title: 'Smoke and Glass', summary: 'The Great Exhibition has opened a glass palace to the world. The city around it cannot breathe.', a: ['Nell', 'Mill Hand', ['Fourteen hours, six days, and the engine does not stop so neither do we. My sister is ten. She works the looms.', 'The gentlemen are up at Parliament Hill deciding whether children under nine should be in the mills. Under nine! Ask them how they decided that number.']], b: ['Mr. Paxton', 'Engineer', ['A million panes of glass. The future, on display for a shilling. We can build anything. We have simply not decided what to build.', 'The sewers? The sewers are a question for the next Parliament. The cholera is a question for the next summer.', 'There is a notice at the cathedral about the water. A doctor named Snow. Nobody is reading it. You should.']], c: ['Dr. Snow’s Notice', ['"The cholera clusters about the Broad Street pump. Remove the handle." Someone has written underneath: "Removed. Deaths stopped. Handle replaced by order of the parish."', 'They knew. They had the answer in a single sentence. They put the handle back because the alternative was admitting the city had outgrown their idea of it.']] },
  { era: 'sumerian', title: 'The Salt in the Soil', summary: 'The first city on Earth, and the first city to run out of soil.', a: ['Geme', 'Farmer', ['Wheat used to grow here. Now barley. Soon, not barley. The white crust comes up with the water and stays when the water goes.', 'The temple says pray. The temple owns the fields, so the temple can say what it likes. Go up to the Eanna precinct and ask a priest why they do not let the fields rest.']], b: ['Enheduanna', 'High Priestess', ['Let the fields rest? The city eats every year. The soldiers eat every year. The gods, I assure you, eat every year.', 'We dig new canals further out. The salt follows. We dig further. There is a tablet at the standing stones with the harvest counts for forty years. Read it, if you can bear to.']], c: ['Harvest Tablet', ['Forty years of harvests, pressed in clay. The wheat column ends twenty years ago. The barley column has been shrinking for ten.', 'Somebody counted all of this, carefully, every year, and nobody changed anything. Counting is not the same as deciding.']] },
  { era: 'egyptian', title: 'When the River Forgot', summary: 'The Great Pyramid is finished. The god-king guarantees the flood. The nilometer disagrees.', a: ['Merer', 'Overseer', ['Ten loaves, two jugs of beer, and a pyramid for a god who promises the river will rise. It has risen every year of my life. Why would it stop?', 'The priests at the Horizon measure the river. Ask them what they measured this year. Ask them twice; they lie the first time.']], b: ['Hemiunu', 'Vizier', ['The nilometer reads low. Three years low. The granaries are full because we built them for the flood years. For how long? Do not ask that question in front of Pharaoh.', 'He is a god. The flood is his promise. When a god’s promise fails, the god does not fall. The order that believed him does. The sphinx has the old flood marks carved on its base. Read them.']], c: ['Flood Marks', ['Forty flood marks, one per year, carved into the stone. The last three are below all the others. Below them, a newer, smaller mark that someone has tried to scratch out.', 'A state built on one promise is a state with one point of failure. The river is not listening to the Pharaoh. It never was.']] },
  { era: 'minoan', title: 'One Bad Day', summary: 'A sea empire with no walls, fleets on every horizon and ash falling on the orchards.', a: ['Kydon', 'Sea Captain', ['No walls! Why walls? We own every ship on the sea. Who would attack an island that owns the sea?', 'The mountain on Thera has been smoking for a month. The priestesses say the earth-bull is restless. The sailors say the water near Thera is warm. Go to the Labyrinth and ask the priestess what the bull wants.']], b: ['Pasiphae', 'Priestess', ['The bull wants what it always wants. Blood, saffron, dancers. We give it, and the sea stays calm. The sea has been calm for three hundred years.', 'Ash on the orchards this morning. The children thought it was snow. The peak sanctuary has the old offering records. Go and read how long since the mountain last spoke.']], c: ['Offering Record', ['Three hundred years of offerings. Not one mention of the mountain. Not one plan for the fleet being gone. Not one wall.', 'Everything here depends on the sea staying what it has always been. It will not, and there is no second plan, because a second plan would admit the first one could fail.']] },
  { era: 'mycenaean', title: 'The Web Breaks', summary: 'Palace kingdoms linked by bronze, counted on clay, and about to go dark together.', a: ['Eumaios', 'Shepherd', ['Two bad harvests, and the palace still takes its share, and the gods still take theirs. The hills are filling up with men who used to be farmers.', 'The bronze comes from an island so far west the sun sets on it. The tin comes from further. Go up to the Lion Gate and ask the scribe what happens if one ship does not come.']], b: ['Alxoitas', 'Palace Scribe', ['Every jar of oil, every chariot wheel, every slave, on a tablet in the palace. If one ship does not come, we read the tablets and reassign. If ten ships do not come...', 'The wanax has called for ships for a war across the sea. Over a woman, they say. Over the tin routes, I say. The grave circle has the tablet of the Sea Peoples. Read it, and then forget you did.']], c: ['Tablet of the Sea Peoples', ['"Raiders from the sea. Pylos burned. Send chariots." The tablet was baked hard in a fire. The fire was the palace.', 'Every palace depended on every other palace. When the ships stopped, the bronze stopped, the writing stopped, and for four hundred years nobody could read this.']] },
  { era: 'assyrian', title: 'Fear Is a Loan', summary: 'The most feared army on Earth throws a ten-day feast. Its guests are counting the days.', a: ['Hoshea', 'Deportee', ['They marched us a thousand miles to build a palace for a king we had never heard of. We will not forget where we came from. None of us will.', 'Seventy thousand guests at the feast. The king will carve it on the wall. Go up to the palace and ask a courtier who does the carving.']], b: ['Bel-tarsi', 'Courtier', ['The king flays rebels and nails the skins to the wall. The next city opens its gates without a fight. Efficient, yes? Ask me who guards the wall at night. Deportees.', 'Every province sends tribute. Every province hates us. One is the cause of the other, and the king knows it, and the king does not care. The stele at the small ziggurat lists the provinces. Count them.']], c: ['Tribute Stele', ['Forty-one provinces, each with the tribute owed and the punishment for shortfall. The punishments get longer toward the bottom of the list.', 'Terror works until the day everyone it works on decides to stop being afraid at the same time. The stele is a list of everyone who will be at Nineveh when it burns.']] },
  { era: 'mauryan', title: 'The Empire of One Man', summary: 'A conqueror became a pacifist and carved the rules on pillars. The rules depend on the man.', a: ['Upagupta', 'Monk', ['The emperor killed a hundred thousand at Kalinga, wept, and wrote the rules on stone. All beings wish to live. Also, the tax rate.', 'Dhamma is not a religion. It is a way of not needing an army. Go to the pillared hall and ask an official whether the army agrees.']], b: ['Radhagupta', 'Minister', ['The Arthashastra has several chapters on spies. We are very well informed. We know, for instance, that the princes do not share their father’s opinion on war.', 'An empire this size holds together by the will of one man. Think about what that means for the second man. The great stupa has the succession edict. Read who is named.']], c: ['Succession Edict', ['The edict names no heir. It names Dhamma as the heir. A law cannot command an elephant.', 'Fifty years from now this empire will be in pieces, because its genius was a person and not a system. The pillars will outlast the empire by two thousand years.']] },
  { era: 'mayan', title: 'The Forest Does Not Return', summary: 'A jungle city of astronomers, on the day strangers arrive and the king dies.', a: ['Balam', 'Farmer', ['Burn the forest, plant the maize, move on. The forest used to come back in seven years. Now it takes twenty. The city grows and the forest shrinks. Somebody should do the arithmetic.', 'The astronomers can tell you the day of an eclipse a thousand years out. Go up to the acropolis and ask them what day the rains come.']], b: ['Chak Tok', 'Astronomer', ['Venus returns every 584 days. We are correct to the day. The rains are less reliable than Venus. The king is less reliable than the rains.', 'The strangers from the west arrived today. The king entered the water today. We are writing it down very carefully. The observatory keeps the reservoir counts. Look at them.']], c: ['Reservoir Count', ['Rainfall, by year, scratched into the observatory wall. The dry years come in pairs now, then threes. The reservoirs were built for one.', 'They planned for the worst drought they had ever seen. They had not seen the worst drought. Plan for the record and then assume the record will be broken.']] },
  { era: 'viking', title: 'Short Summers', summary: 'Raiders became settlers overnight. Nobody has told the winters.', a: ['Astrid', 'Farmer', ['Every family gets its own plot. Every family needs its own plot. We do not share well. Ask my neighbor. Ask his axe.', 'The old men say the winters are getting shorter and that is the gods being kind. Go to the jarl’s hall and ask the skald what the gods do when they change their minds.']], b: ['Egil', 'Skald', ['Ragnarok. The gods lose, the world ends, and a new one grows. We tell the children this so they are not afraid of endings. We should tell it to the farmers.', 'The settlers in the west build the same farms they built at home, on land that is not home. They will not eat fish. The sea is full of fish. The runestone at the hof says why. Read it.']], c: ['The Hof Runestone', ['"Thorvald raised this stone for his father, who kept the old ways in the new land." Below it, smaller: "and starved."', 'They had every tool they needed to adapt, except the willingness. Adaptation is not weakness; it is the only thing that ever survived a changing climate.']] },
  { era: 'khmer', title: 'The Machine Needs Tending', summary: 'The largest city on Earth runs on water. The engineers are losing to the silt.', a: ['Sok', 'Rice Farmer', ['Two harvests a year, three if the canals are good. The canals are the king’s. So the harvest is the king’s. My grandfather dug canals. My father dug canals. I dig canals.', 'The forest is cut for the temples. When the rains come, the hills come down with them. Go to the temple mountain and ask an engineer how much silt a god weighs.']], b: ['Kambu', 'Royal Engineer', ['The barays hold a year of rain. The canals move it to the rice, the rice to the king. One machine. Beautiful. Every year a little more silt, and we dredge, and we are always dredging.', 'The new king wants a bigger temple. The temple needs stone. The stone needs the forest. The forest held the hills. The naga bridge has the water marks. Read them.']], c: ['Water Marks', ['Flood heights, carved into the naga balustrade. They rise for a century. Then, two years ago, a flood so high it tore out the main channel. This year, nothing came at all.', 'Infrastructure is a promise to the future that the future has to keep paying for. Angkor stopped paying, and the water went where it liked.']] },
  { era: 'mongol', title: 'Inherited Like a Herd', summary: 'The horde crushed Europe’s knights and stopped. The Great Khan is dead.', a: ['Subutai', 'General', ['Five horses per man. We ride one, eat one, and the others carry what we took. The knights of Hungary charged us at Mohi. We let them. Then we closed the circle.', 'The Khan is dead. Every prince must ride home to choose the next one. So Europe lives. Go to the golden ordu and ask the envoy who chooses.']], b: ['Carpini', 'Envoy', ['A letter travels from here to Karakorum in two weeks. Nothing in Christendom moves that fast except rumor. And yet the empire stops dead because one man died and there is no rule for the next.', 'Four grandsons, four khanates. Watch what happens to an empire inherited like a herd. The ovoo cairn has the stones of every prince who has already left. Count them.']], c: ['The Ovoo', ['A cairn of stones, one for each prince riding home to vote. More stones than there are votes. Some of these princes will not come back from the choosing.', 'The largest empire in history, and no procedure for the morning after. A system with no rule for passing power has its civil war already scheduled.']] },
  { era: 'aztec', title: 'Allies of the Enemy', summary: 'A floating capital fed by two hundred cities that hate it. Strangers with horses have landed.', a: ['Xochitl', 'Chinampa Farmer', ['Seven harvests a year on the floating gardens. A thousand canoes bring food every morning. Cut the causeways and the city starves in a week. Everyone knows this. Including the Tlaxcalans.', 'Men on the coast with deer the size of houses. The emperor sent them gold. Go to the sacred precinct and ask an eagle warrior what he would have sent.']], b: ['Cuauhtemoc', 'Eagle Warrior', ['We do not conquer to kill. We conquer to collect. Every city pays, every city hates us, every city waits. The strangers have found something better than horses: people who hate us.', 'A One Reed year. The year the feathered serpent was promised to return. The sun stone has the omens of this year carved on it. Count them.']], c: ['The Sun Stone', ['A comet. A temple that burned without fire. A woman weeping in the streets at night. A bird with a mirror in its head. Eight omens in one year, all carved before the ships came.', 'Five hundred Spaniards did not take this city. Tens of thousands of people who had been paying tribute for a century did. An empire built on resentment hands its enemies an army.']] },
  { era: 'sengoku', title: 'The Peace After the War', summary: 'The armies gather at Sekigahara. One battle ends a century of war, and everything the war made possible.', a: ['Yodoya', 'Rice Merchant', ['Merchants are the lowest class. We also own everything. Whoever wins tomorrow will owe money to someone on this street.', 'The sword hunt took every blade from the villages. Now only samurai have swords, and only samurai have a say. Go up to the castle and ask a samurai what peace will look like.']], b: ['Tadakatsu', 'Samurai', ['A hundred years of every lord against every lord. Tomorrow, one battle ends it. Then Ieyasu will make peace boring: disarm everyone, freeze every class, close every port.', 'Two hundred years without war, bought with everything the war made possible. The arquebus. The trade. The questions. The pagoda has the edict already drafted. Read it.']], c: ['The Draft Edict', ['"No ship shall leave. No foreigner shall land. No peasant shall bear arms. No man shall change his station." The ink is not dry. The battle has not been fought.', 'Stability has a price too. They will pay it for two and a half centuries and call it peace, and when the black ships come they will have forgotten how to do anything else.']] },
  { era: 'buccaneer', title: 'Pardoned Out of Existence', summary: 'The pirate republic has a vote and a constitution. The governor has a pardon and four warships.', a: ['Caesar', 'Dockhand', ['Freer on a pirate ship than anywhere else in this ocean, and that is a low bar. One vote per man, equal shares, captain only gives orders in a fight.', 'The king offers a pardon to any pirate who quits. Half of Nassau took it. Go to the fort and ask the governor’s man why the other half is still drinking.']], b: ['Hornigold', 'Former Pirate', ['I took the pardon. I hunt my old crewmates now for the Crown. Why? Because honesty got cheaper than theft the day the navy showed up. That is the whole story of piracy.', 'Teach is blockading Charleston this week for a chest of medicine. Theatre. Theatre works until it does not. The lighthouse keeper logs every ship that takes the pardon. Go count.']], c: ['Lighthouse Log', ['Ships in: forty-one. Pardons taken: thirty-three. Beneath the numbers, a note in a different hand: "Rogers arrives with the fleet in July. Make it forty."', 'The republic was not defeated. It was dissolved by paperwork and a better offer. Movements built on grievance evaporate the moment the grievance is cheaper to settle than to fight.']] },
  { era: 'wildwest', title: 'The Frontier Closes', summary: 'Gold in the hills, a railroad coming, and news from Little Bighorn a week old.', a: ['Calamity', 'Scout', ['The railroad gets here next year. Then the cattle drives end and so does every job I know how to do. The buffalo are gone. Sixty million, gone in twenty years. We did that on purpose.', 'This is Lakota land by treaty. The treaty lasted until somebody found gold. Go up to the fort and ask the colonel what a treaty is for.']], b: ['Colonel', 'Cavalry Officer', ['A treaty is for the time it takes to find a reason to break it. Custer took two hundred men against two thousand because he thought the frontier was still endless. News travels slow. Lessons travel slower.', 'The frontier is not a resource. It is a countdown. The church has the land office map. Look how much is left.']], c: ['Land Office Map', ['A map of the territory with the claims colored in. Twenty years ago the map was white. Now there is one white patch, and a railroad drawn through the middle of it in pencil.', 'The West was sold as endless. It took one generation to fence it, mine it and lay a track across it. Every frontier ends; the only question is whether you planned for the ending.']] },
];

/** Where the citadel conversation happens, relative to the site, for monuments that fill the hill. */
const CITADEL_TALK: Record<string, [number, number]> = { egyptian: [30, 112] };

for (const b of BEATS) {
  const era = getEra(b.era);
  const port = era.chronoport!;
  const [cox, coz] = CITADEL_TALK[b.era] ?? [0, 72];
  const q: Quest = {
    id: `era_${b.era}`,
    act: 2,
    title: b.title,
    summary: b.summary,
    requires: b.era === 'greek' || b.era === 'victorian' ? ['rome'] : ['hale'],
    steps: [
      { kind: 'findPort', port: b.era, objective: `Find the chronoport to ${era.yearLabel} (${port.placeName})` },
      { kind: 'travel', era: b.era, objective: `Travel to ${era.name}, ${era.yearLabel}` },
      talk(b.era, `${b.era}_a`, { name: b.a[0], role: b.a[1] }, SITES.plaza.x + 18, SITES.plaza.z + 22, `Talk to ${b.a[0]} at the ${era.districtNames.oldtown} plaza`, b.a[2]),
      talk(b.era, `${b.era}_b`, { name: b.b[0], role: b.b[1] }, SITES.citadel.x + cox, SITES.citadel.z + coz, `Climb to the ${era.districtNames.citadel} and speak with ${b.b[0]}`, b.b[2]),
      read(b.era, `${b.era}_c`, b.c[0], SITES.sacred.x + 30, SITES.sacred.z + 60, `Read the ${b.c[0]} at the ${era.districtNames.north} sacred ground`, b.c[1]),
    ],
    insight: b.era,
    completeText: `Insight gained: ${era.insight.title}.`,
  };
  CAMPAIGN.push(q);
}

export function getQuest(id: string): Quest | undefined {
  return CAMPAIGN.find((q) => q.id === id);
}

import {nextRandom, randomBetween, stableId} from './rng';
import {ActionDefinition, GameState, WorldActionEffect, WorldNews, WorldState, WorldTerritory} from './types';

const player = 'orinth';

export function createWorldState(): WorldState {
  return {
    year: 1, playerNationId: player, army: 4300,
    nations: [
      {id: player, name: 'Republic of Orinth', player: true, relation: 0, power: 6100, aggression: 2500, allied: false, atWar: false, pactIds: []},
      {id: 'valedorn', name: 'Crown of Valedorn', player: false, relation: 18, power: 6400, aggression: 2600, allied: false, atWar: false, pactIds: []},
      {id: 'serevan', name: 'Serevan League', player: false, relation: 8, power: 4800, aggression: 3000, allied: false, atWar: false, pactIds: []},
      {id: 'karsic', name: 'Karsic Dominion', player: false, relation: -24, power: 8200, aggression: 6900, allied: false, atWar: false, pactIds: []},
      {id: 'fen', name: 'Fen Republic', player: false, relation: 4, power: 3900, aggression: 1800, allied: false, atWar: false, pactIds: []},
      {id: 'aurelian', name: 'Aurelian Compact', player: false, relation: 12, power: 7100, aggression: 3400, allied: false, atWar: false, pactIds: []},
    ],
    territories: [
      territory('orinth-capital', 'Orinth Capital', player, ['iron-coast', 'north-march'], 'government', 6800),
      territory('iron-coast', 'Iron Coast', player, ['orinth-capital', 'sunward-ports', 'karsic-gate'], 'steel', 7200),
      territory('verdant-plain', 'Verdant Plain', player, ['north-march', 'sunward-ports', 'fen-border'], 'grain', 6100),
      territory('north-march', 'North March', player, ['orinth-capital', 'verdant-plain', 'valedorn-pass'], 'timber', 4600),
      territory('sunward-ports', 'Sunward Ports', player, ['iron-coast', 'verdant-plain', 'serevan-straits'], 'shipping', 7900),
      territory('valedorn-pass', 'Valedorn March', 'valedorn', ['north-march', 'aurelian-road'], 'silver', 5900),
      territory('aurelian-road', 'Aurelian Road', 'aurelian', ['valedorn-pass', 'karsic-gate'], 'trade', 7600),
      territory('karsic-gate', 'Karsic Gate', 'karsic', ['iron-coast', 'aurelian-road', 'karsic-heart'], 'iron', 7000),
      territory('karsic-heart', 'Karsic Heartland', 'karsic', ['karsic-gate'], 'oil', 8300),
      territory('fen-border', 'Fen Border', 'fen', ['verdant-plain', 'fen-delta'], 'grain', 4200),
      territory('fen-delta', 'Fen Delta', 'fen', ['fen-border'], 'river trade', 5200),
      territory('serevan-straits', 'Serevan Straits', 'serevan', ['sunward-ports'], 'shipping', 8100),
    ],
    deals: [], wars: [], news: [{id: 'world-opening', year: 1, headline: 'A continent on edge', detail: 'Orinth enters a new century surrounded by ambitious neighbors, fragile trade routes, and old border claims.', severity: 'brief'}],
  };
}

function territory(id: string, name: string, ownerId: string, neighbors: string[], resource: string, wealth: number): WorldTerritory {
  return {id, name, ownerId, neighbors, resource, wealth, unrest: 1100, resistance: 0, formerPlayerLand: false};
}

export function canUseWorldAction(state: GameState, action: ActionDefinition, targetId?: string) {
  if (!action.worldEffect || !state.world) return true;
  const world = state.world;
  const nation = world.nations.find(item => item.id === targetId);
  const land = world.territories.find(item => item.id === targetId);
  const playerLand = world.territories.filter(item => item.ownerId === world.playerNationId);
  const adjacentToPlayer = (item: WorldTerritory) => item.neighbors.some(id => playerLand.some(owned => owned.id === id));
  switch (action.worldEffect) {
    case 'trade': return Boolean(nation && !nation.atWar && !world.deals.some(deal => deal.nationId === nation.id && deal.kind === 'trade'));
    case 'business': return Boolean(nation && !nation.atWar && !world.deals.some(deal => deal.nationId === nation.id && deal.kind === 'business'));
    case 'alliance': return Boolean(nation && !nation.atWar && nation.relation >= 10 && !nation.allied);
    case 'declare-war': return Boolean(nation && !nation.atWar && !nation.allied && world.territories.some(item => item.ownerId === nation.id && adjacentToPlayer(item)));
    case 'peace': return Boolean(nation?.atWar && world.wars.some(war => war.nationId === nation.id));
    case 'mobilize': return world.army < 9800;
    case 'invade': return Boolean(land && land.ownerId !== world.playerNationId && world.nations.find(item => item.id === land.ownerId)?.atWar && adjacentToPlayer(land));
    case 'resistance': return Boolean(land && land.ownerId !== world.playerNationId && land.formerPlayerLand && world.nations.find(item => item.id === land.ownerId)?.atWar);
    case 'rebuild': return Boolean(land && land.ownerId === world.playerNationId && land.unrest >= 1800);
  }
}

export function applyWorldAction(state: GameState, effect: WorldActionEffect | undefined, targetId?: string): WorldNews[] {
  const world = state.world;
  if (!world || !effect) return [];
  const nation = world.nations.find(item => item.id === targetId);
  const land = world.territories.find(item => item.id === targetId);
  const news: WorldNews[] = [];
  const publish = (headline: string, detail: string, severity: WorldNews['severity'] = 'brief') => {
    const item = {id: stableId('world-news', state.seed, state.turn * 31 + world.news.length), year: world.year, headline, detail, severity};
    world.news.unshift(item); world.news = world.news.slice(0, 30); news.push(item);
  };
  if (effect === 'trade' && nation) {
    nation.relation = Math.min(100, nation.relation + 12);
    world.deals.push({id: stableId('trade', state.seed, state.turn), nationId: nation.id, kind: 'trade', annualIncome: 360, yearsRemaining: 8, breachRisk: 0.06});
    publish('New trade corridor', `Orinth and ${nation.name} open an eight-year trade corridor. Port revenues rise, but both governments are now exposed to disruption.`, 'brief');
  } else if (effect === 'business' && nation) {
    nation.relation = Math.min(100, nation.relation + 6);
    world.deals.push({id: stableId('business', state.seed, state.turn), nationId: nation.id, kind: 'business', annualIncome: 680, yearsRemaining: 5, breachRisk: 0.16});
    publish('Cross-border consortium signed', `A five-year industrial consortium with ${nation.name} promises revenue and jobs. Critics warn that a future breach could expose Orinth's supply chain.`, 'pressure');
  } else if (effect === 'alliance' && nation) {
    nation.allied = true; nation.relation = Math.min(100, nation.relation + 25);
    publish('Mutual defense pact', `${nation.name} and Orinth sign a mutual-defense pact. The pact deters aggression but could pull Orinth into a wider conflict.`, 'pressure');
  } else if (effect === 'declare-war' && nation) {
    nation.atWar = true; nation.relation = Math.max(-100, nation.relation - 55);
    world.wars.push({id: stableId('war', state.seed, state.turn), nationId: nation.id, yearsActive: 0, casualties: 0});
    publish('War declared', `Orinth declares war on ${nation.name}. Mobilization begins across the border and the markets react immediately.`, 'crisis');
  } else if (effect === 'peace' && nation) {
    world.wars = world.wars.filter(war => war.nationId !== nation.id); nation.atWar = false; nation.allied = false; nation.relation = Math.min(100, nation.relation + 20);
    publish('Ceasefire takes hold', `Orinth and ${nation.name} accept a ceasefire. The guns fall silent, but border claims and public anger remain unresolved.`, 'pressure');
  } else if (effect === 'mobilize') {
    world.army = Math.min(10000, world.army + 1900); state.treasury = Math.max(0, state.treasury - 180);
    publish('Reserve forces mobilized', 'New brigades report for duty. Readiness improves, while the treasury and neighboring capitals come under pressure.', 'pressure');
  } else if (effect === 'invade' && land) {
    const draw = randomBetween(state.randomState, 0, 10000); state.randomState = draw.state;
    const defender = world.nations.find(item => item.id === land.ownerId);
    const chance = Math.max(1800, Math.min(8200, 5000 + Math.round((world.army + world.nations[0].power - (defender?.power ?? 5000) - land.wealth) / 3)));
    world.army = Math.max(0, world.army - (draw.value < chance ? 420 : 1150));
    state.treasury = Math.max(0, state.treasury - (draw.value < chance ? 260 : 720));
    if (draw.value < chance) {
      land.formerPlayerLand = false; land.ownerId = world.playerNationId; land.unrest = 5700; land.resistance = 0;
      if (defender) { defender.relation = Math.max(-100, defender.relation - 18); defender.power = Math.max(1000, defender.power - 360); }
      publish(`${land.name} falls to Orinth`, `Orinthian forces capture ${land.name}. The territory is secured, but unrest is high and the front remains active.`, 'crisis');
    } else {
      if (defender) defender.power = Math.max(1000, defender.power - 160);
      publish(`Assault on ${land.name} repelled`, `Defending forces hold ${land.name}. Orinth suffers heavy losses and the war grows more unpopular at home.`, 'crisis');
      state.publicSentiment = Math.max(0, state.publicSentiment - 280);
    }
  } else if (effect === 'resistance' && land) {
    land.resistance = Math.min(10000, land.resistance + 3600);
    publish('Resistance network organized', `Underground organizers in ${land.name} begin coordinating with Orinth. Retaliation risk is rising.`, 'pressure');
  } else if (effect === 'rebuild' && land) {
    land.unrest = Math.max(0, land.unrest - 2800); state.legitimacy = Math.min(10000, state.legitimacy + 180);
    publish(`Reconstruction in ${land.name}`, 'Public works, security guarantees, and local councils begin restoring order after the fighting.', 'brief');
  }
  return news;
}

export function advanceWorld(state: GameState): WorldNews[] {
  const world = state.world;
  if (!world) return [];
  world.year += 1;
  const news: WorldNews[] = [];
  const publish = (headline: string, detail: string, severity: WorldNews['severity'] = 'brief') => {
    const item = {id: stableId('world-news', state.seed, state.turn * 47 + world.news.length), year: world.year, headline, detail, severity};
    world.news.unshift(item); world.news = world.news.slice(0, 30); news.push(item);
  };
  const playerNation = world.nations.find(item => item.id === world.playerNationId)!;
  const owned = world.territories.filter(item => item.ownerId === world.playerNationId);
  state.treasury = Math.max(0, state.treasury + owned.reduce((sum, item) => sum + Math.round(item.wealth / 65), 0));
  world.deals = world.deals.filter(deal => {
    const nation = world.nations.find(item => item.id === deal.nationId);
    if (nation?.atWar) {
      state.treasury = Math.max(0, state.treasury - 140);
      publish(`${deal.kind === 'trade' ? 'Trade corridor' : 'Business contract'} disrupted`, `Fighting with ${nation.name} has suspended a cross-border agreement.`, 'pressure');
      return false;
    }
    state.treasury += deal.annualIncome;
    deal.yearsRemaining -= 1;
    if (deal.yearsRemaining <= 0) publish(`${deal.kind === 'trade' ? 'Trade corridor' : 'Business contract'} expired`, `A commercial agreement with ${nation?.name ?? 'a neighbor'} has reached its term. Renew it or let the relationship cool.`);
    return deal.yearsRemaining > 0;
  });
  for (const land of world.territories.filter(item => item.ownerId === world.playerNationId)) {
    if (land.unrest > 0) land.unrest = Math.max(0, land.unrest - Math.max(60, Math.round(state.legitimacy / 55)));
    if (land.formerPlayerLand) land.formerPlayerLand = false;
  }
  for (const war of world.wars.filter(item => !item.targetNationId)) {
    war.yearsActive += 1; war.casualties += 180 + Math.round((10000 - world.army) / 50);
    state.treasury = Math.max(0, state.treasury - 260);
    state.publicSentiment = Math.max(0, state.publicSentiment - 45);
  }
  for (const land of world.territories.filter(item => item.ownerId !== world.playerNationId && item.formerPlayerLand && item.resistance >= 7000)) {
    const draw = nextRandom(state.randomState); state.randomState = draw.state;
    if (draw.value < 0.42) {
      land.ownerId = world.playerNationId; land.formerPlayerLand = false; land.resistance = 0; land.unrest = 7600;
      publish(`Uprising retakes ${land.name}`, 'Local resistance has driven the occupying garrison out. Orinth regains the land, but now has to protect it.', 'crisis');
    }
  }
  const hostile = world.nations.filter(item => !item.player && !item.atWar && !item.allied && item.relation <= -45 && owned.some(territory => territory.neighbors.some(id => world.territories.some(border => border.id === id && border.ownerId === item.id))));
  for (const nation of hostile) {
    const draw = nextRandom(state.randomState); state.randomState = draw.state;
    const threshold = 0.018 + nation.aggression / 180000;
    if (draw.value < threshold) {
      nation.atWar = true; nation.relation = Math.max(-100, nation.relation - 18);
      world.wars.push({id: stableId('war', state.seed, state.turn + nation.power), nationId: nation.id, yearsActive: 0, casualties: 0});
      publish(`${nation.name} opens a new front`, 'Border forces cross into disputed territory. Orinth must mobilize, seek allies, or attempt a ceasefire.', 'crisis');
      break;
    }
  }
  for (const war of world.wars.filter(item => !item.targetNationId)) {
    const nation = world.nations.find(item => item.id === war.nationId);
    if (!nation) continue;
    const frontier = world.territories.filter(item => item.ownerId === world.playerNationId && item.neighbors.some(id => world.territories.some(border => border.id === id && border.ownerId === nation.id)));
    const draw = nextRandom(state.randomState); state.randomState = draw.state;
    if (frontier.length && draw.value < (0.035 + nation.aggression / 250000) && nation.power > world.army + 700) {
      const target = frontier[Math.floor(draw.value * frontier.length) % frontier.length];
      target.ownerId = nation.id; target.formerPlayerLand = true; target.unrest = 6600; target.resistance = Math.max(0, target.resistance);
      world.army = Math.max(0, world.army - 460); state.legitimacy = Math.max(0, state.legitimacy - 220);
      publish(`${target.name} is occupied`, `${nation.name} has seized ${target.name}. Organize resistance, rebuild your forces, or end the war before the front reaches the capital.`, 'crisis');
    }
  }
  const inRivalWar = (nationId: string) => world.wars.some(war => war.targetNationId && (war.nationId === nationId || war.targetNationId === nationId));
  const havePact = (first: string, second: string) => Boolean(world.nations.find(item => item.id === first)?.pactIds?.includes(second));
  const rivalPairs = world.nations.filter(item => !item.player && !item.allied && !item.atWar && !inRivalWar(item.id)).flatMap(attacker =>
    world.nations.filter(defender => !defender.player && defender.id !== attacker.id && !defender.allied && !defender.atWar && !inRivalWar(defender.id) && !havePact(attacker.id, defender.id) &&
      world.territories.some(land => land.ownerId === defender.id && land.neighbors.some(id => world.territories.some(border => border.id === id && border.ownerId === attacker.id))))
      .map(defender => ({attacker, defender})),
  );
  if (world.year >= 3 && rivalPairs.length) {
    const draw = nextRandom(state.randomState); state.randomState = draw.state;
    if (draw.value < 0.028) {
      const pair = rivalPairs[Math.floor(draw.value / 0.028 * rivalPairs.length) % rivalPairs.length];
      world.wars.push({id: stableId('rival-war', state.seed, state.turn), nationId: pair.attacker.id, targetNationId: pair.defender.id, yearsActive: 0, casualties: 0});
      publish(`${pair.attacker.name} clashes with ${pair.defender.name}`, 'A regional war redraws the balance of power. Refugees strain nearby trade routes, and Orinth must decide whether to profit, mediate, or prepare for spillover.', 'pressure');
    }
  }
  for (const war of world.wars.filter(item => item.targetNationId)) {
    war.yearsActive += 1;
    war.casualties += 120 + Math.round(Math.abs((world.nations.find(item => item.id === war.nationId)?.power ?? 5000) - (world.nations.find(item => item.id === war.targetNationId)?.power ?? 5000)) / 35);
    const attacker = world.nations.find(item => item.id === war.nationId);
    const defender = world.nations.find(item => item.id === war.targetNationId);
    if (!attacker || !defender) { world.wars = world.wars.filter(item => item.id !== war.id); continue; }
    const draw = nextRandom(state.randomState); state.randomState = draw.state;
    if (war.yearsActive >= 2) {
      const frontier = world.territories.filter(land => land.ownerId === defender.id && land.neighbors.some(id => world.territories.some(border => border.id === id && border.ownerId === attacker.id)));
      const chance = Math.max(0.12, Math.min(0.58, 0.31 + (attacker.power - defender.power) / 30000));
      if (frontier.length && draw.value < chance) {
        const target = frontier[Math.floor(draw.value * frontier.length) % frontier.length];
        target.ownerId = attacker.id; target.unrest = 4700; attacker.power = Math.max(1000, attacker.power - 240); defender.power = Math.max(1000, defender.power - 380);
        publish(`${target.name} changes hands`, `${attacker.name} captures ${target.name} from ${defender.name}. The conflict is reshaping borders and regional commerce.`, 'pressure');
      }
    }
    if (war.yearsActive >= 7 || (war.yearsActive >= 3 && draw.value > 0.91)) {
      world.wars = world.wars.filter(item => item.id !== war.id);
      publish(`${attacker.name} and ${defender.name} accept an armistice`, 'The rival powers suspend their campaign after years of losses. Their border remains contested and the balance of power has shifted.', 'brief');
    }
  }
  if (!world.nations.some(item => item.atWar)) {
    for (const nation of world.nations.filter(item => !item.player && !item.allied)) {
      const draw = nextRandom(state.randomState); state.randomState = draw.state;
      const change = draw.value > 0.5 ? 1 : -1;
      nation.relation = Math.max(-100, Math.min(100, nation.relation + change));
    }
  }
  if (owned.length === 1 && world.nations.some(item => item.atWar)) playerNation.relation = -100;
  return news;
}


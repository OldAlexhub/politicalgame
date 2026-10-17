import {projectTreasury} from '../src/game/economy';
import {createCampaign, getLegalActions, processTurn} from '../src/game/engine';
import {advanceWorld} from '../src/game/world';
import {GameMode} from '../src/game/types';

describe('living economy', () => {
  it('projects domestic and territorial income before the next decision', () => {
    const state = createCampaign({mode: 'grand_campaign', seed: 401});
    const forecast = projectTreasury(state);
    const domesticRevenue = Math.round((state.economy.growth - 4000) / 7);
    const territoryRevenue = state.world!.territories
      .filter(territory => territory.ownerId === state.world!.playerNationId)
      .reduce((sum, territory) => sum + Math.round(territory.wealth / 65), 0);
    expect(forecast.revenues).toEqual(expect.arrayContaining([
      expect.objectContaining({id: 'domestic-balance', amount: domesticRevenue}),
      expect.objectContaining({id: 'territory-revenue', amount: territoryRevenue}),
    ]));
    expect(forecast.net).toBe(domesticRevenue + territoryRevenue);
    expect(forecast.projectedBalance).toBe(state.treasury + domesticRevenue + territoryRevenue);
  });

  it('shows deal income, war upkeep, and due obligations in the forward budget', () => {
    const state = createCampaign({mode: 'grand_campaign', seed: 402});
    const [tradePartner, enemy] = state.world!.nations.filter(nation => !nation.player);
    state.world!.deals.push({id: 'test-deal', nationId: tradePartner.id, kind: 'trade', annualIncome: 360, yearsRemaining: 6, breachRisk: 0.06});
    state.world!.wars.push({id: 'test-war', nationId: enemy.id, yearsActive: 1, casualties: 200});
    state.scheduledEffects.push({id: 'debt', dueTurn: 2, source: 'Debt service', changes: [{path: 'treasury', amount: -850}], narrative: 'Payment due.'});
    const forecast = projectTreasury(state);
    expect(forecast.revenues).toEqual(expect.arrayContaining([expect.objectContaining({id: 'test-deal', amount: 360})]));
    expect(forecast.expenses).toEqual(expect.arrayContaining([
      expect.objectContaining({id: 'war-upkeep', amount: -260}),
      expect.objectContaining({id: 'scheduled-debt', amount: -850}),
    ]));
  });

  it('offers fiscal decisions with real immediate and delayed tradeoffs', () => {
    const state = createCampaign({mode: 'dictatorship', seed: 403});
    expect(getLegalActions(state).map(action => action.id)).toEqual(expect.arrayContaining([
      'progressive-levy', 'reconstruction-bonds', 'enterprise-fund', 'emergency-austerity',
    ]));
    const result = processTurn(state, {id: 'reconstruction-bonds'});
    expect(result.report.sections.flatMap(section => section.impacts)).toEqual(expect.arrayContaining([
      expect.objectContaining({path: 'treasury', amount: 1800}),
      expect.objectContaining({path: 'economy.inflation', amount: 220}),
    ]));
    expect(result.state.scheduledEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({source: 'Reconstruction bond service', dueTurn: 4, changes: expect.arrayContaining([expect.objectContaining({path: 'treasury', amount: -850})])}),
    ]));
  });

  it('makes commercial breach risk executable rather than decorative', () => {
    const state = createCampaign({mode: 'grand_campaign', seed: 404});
    const partnerId = state.world!.nations.find(nation => !nation.player)!.id;
    const territoryRevenue = state.world!.territories
      .filter(territory => territory.ownerId === state.world!.playerNationId)
      .reduce((sum, territory) => sum + Math.round(territory.wealth / 65), 0);
    state.world!.deals.push({id: 'fragile-consortium', nationId: partnerId, kind: 'business', annualIncome: 680, yearsRemaining: 4, breachRisk: 1});
    const treasuryBefore = state.treasury;
    const growthBefore = state.economy.growth;
    const news = advanceWorld(state);
    expect(state.world!.deals.some(deal => deal.id === 'fragile-consortium')).toBe(false);
    expect(news).toEqual(expect.arrayContaining([expect.objectContaining({headline: 'Industrial consortium collapses', severity: 'crisis'})]));
    expect(state.economy.growth).toBeLessThan(growthBefore);
    expect(state.treasury).toBe(treasuryBefore + territoryRevenue - 480);
  });

  it('records world income and costs in the causal turn briefing', () => {
    const state = createCampaign({mode: 'grand_campaign', seed: 405});
    const territoryRevenue = state.world!.territories
      .filter(territory => territory.ownerId === state.world!.playerNationId)
      .reduce((sum, territory) => sum + Math.round(territory.wealth / 65), 0);
    const result = processTurn(state, {id: 'public-address'});
    const settlement = result.report.sections.find(section => section.title === 'World-year settlement');
    expect(settlement).toBeDefined();
    expect(settlement?.impacts).toEqual(expect.arrayContaining([expect.objectContaining({path: 'treasury', amount: territoryRevenue})]));
  });

  it.each<GameMode>(['presidential', 'dictatorship', 'monarchy', 'coup', 'grand_campaign'])('never deadlocks %s when every resource is exhausted', mode => {
    const state = createCampaign({mode, seed: 406});
    state.treasury = 0;
    state.influence = 0;
    state.legitimacy = 0;
    const legal = getLegalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.some(action => Object.values(action.cost).every(cost => !cost))).toBe(true);
  });

  it('moves the wider economy every turn even when the chosen action is political', () => {
    const state = createCampaign({mode: 'dictatorship', seed: 407});
    const before = {...state.economy};
    const result = processTurn(state, {id: 'public-address'});
    expect(result.state.economy.employment).not.toBe(before.employment);
    expect(result.state.economy.inequality).not.toBe(before.inequality);
    expect(result.state.economy.resilience).not.toBe(before.resilience);
  });

  it('turns insolvency into a forced crisis with playable recovery choices', () => {
    const state = createCampaign({mode: 'dictatorship', seed: 408});
    state.treasury = 0;
    const collapse = processTurn(state, {id: 'civic-service-corps'}).state;
    expect(collapse.pendingEvent).toEqual(expect.objectContaining({templateId: 'treasury-collapse', severity: 'crisis'}));
    expect(getLegalActions(collapse).map(action => action.id)).toEqual(expect.arrayContaining([
      'event:bridge-loan', 'event:monetize-deficit',
    ]));
    const recovery = processTurn(collapse, {id: 'event:bridge-loan'});
    expect(recovery.state.treasury).toBeGreaterThan(0);
    expect(recovery.state.scheduledEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({source: 'Bridge-loan repayment'}),
    ]));
  });
});

import { createServer } from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Game, Player, Card, HEROES, createDeck } = require('./server.js');

const passed = [], failed = [];
function ok(name) { passed.push(name); console.log('  \u2713 ' + name); }
function fail(name, msg) { failed.push(name); console.log('  \u2717 ' + name + ': ' + msg); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

class MockWS {
  constructor() { this.messages = []; }
  send(data) { this.messages.push(JSON.parse(data)); }
  get readyState() { return 1; }
}

// 1
try {
  const deck = createDeck();
  assert(deck.length === 54, 'Expected 54 cards');
  assert(deck.filter(c => c.suit === 'joker').length === 2);
  ok('卡组创建正确 54张牌含2王');
} catch (e) { fail('卡组创建', e.message); }

// 2
try {
  assert(HEROES.length === 11, 'Expected 11 heroes');
  const ids = HEROES.map(h => h.id);
  ['wei_yan','deng_ai','shen_jiangwei','guo_yuan','cao_mao','jie_jushou','shi_yuji','shen_sunce','jie_xusheng','shen_zhaoyun','xi_zhicai'].forEach(id => {
    if (!ids.includes(id)) throw new Error('Missing: ' + id);
  });
  ok('武将池正确包含11名武将');
} catch (e) { fail('武将池', e.message); }

// 3
try {
  const c = new Card('heart', 14);
  assert(c.display.includes('A'), 'Display: ' + c.display);
  assert(c.color === 'red');
  assert(new Card('joker', 17).display === '大王');
  assert(new Card('joker', 16).display === '小王');
  ok('卡牌显示格式正确');
} catch (e) { fail('卡牌显示', e.message); }

// 4
try {
  const g = new Game('R1');
  assert(g.phase === 'lobby');
  assert(g.addPlayer(new Player('p1','A',new MockWS())) === true);
  assert(g.addPlayer(new Player('p2','B',new MockWS())) === true);
  assert(g.addPlayer(new Player('p3','C',new MockWS())) === true);
  assert(g.players.length === 3);
  assert(g.phase === 'selecting_heroes');
  assert(g.addPlayer(new Player('p4','D',new MockWS())) === false);
  ok('游戏房间管理正确(创建/加入/满员限制)');
} catch (e) { fail('房间管理', e.message); }

// 5
try {
  const g = new Game('R2');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  assert(g.selectHero('p1','wei_yan') === true);
  assert(p1.hero.id === 'wei_yan' && p1.maxHp === 4 && p1.hp === 4);
  assert(g.selectHero('p2','deng_ai') === true);
  assert(g.selectHero('p3','shen_jiangwei') === true);
  assert(g.selectHero('p1','deng_ai') === false);
  ok('武将选择正确(每人不同武将/属性正确/不可重复)');
} catch (e) { fail('武将选择', e.message); }

// 6
try {
  const g = new Game('R3');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  g.selectHero('p1','wei_yan'); g.selectHero('p2','deng_ai'); g.selectHero('p3','shen_jiangwei');
  assert(g.phase === 'playing');
  const landlord = g.players.find(p => p.isLandlord);
  const farmer = g.players.find(p => !p.isLandlord);
    assert(landlord.handCards.length === farmer.handCards.length + 3,
    "Landlord(" + landlord.handCards.length + ") vs Farmer(" + farmer.handCards.length + ") + 3");
  ok('游戏初始化正确(发牌/地主多3牌/角色分配)');
} catch (e) { fail('游戏初始化', e.message); }

// 7
try {
  const g = new Game('R4');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  g.selectHero('p1','wei_yan'); g.selectHero('p2','deng_ai'); g.selectHero('p3','shen_jiangwei');
  const cur = g.players[g.currentTurn];
  assert(g.endTurn(cur.id).success === true);
  ok('回合系统正确(轮流/结束回合)');
} catch (e) { fail('回合系统', e.message); }

// 8
try {
  const g = new Game('R5');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  g.selectHero('p1','wei_yan'); g.selectHero('p2','deng_ai'); g.selectHero('p3','shen_jiangwei');
  const cur = g.players[g.currentTurn];
  const target = cur.isLandlord ? g.players.find(p => !p.isLandlord) : g.landlord;
  const hpBefore = target.hp;
  const atk = cur.handCards.find(c => c.number === 3);
  if (atk) {
    assert(g.playCard(cur.id, [atk.id], target.id).success === true);
    assert(target.hp === hpBefore - 1);
    ok('出牌攻击正确(杀扣1血/目标选择)');
  } else {
    console.log('  (!) 当前手牌无杀，跳过攻击测试');
  }
} catch (e) { fail('出牌攻击', e.message); }

// 9
try {
  const g = new Game('R6');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  g.selectHero('p1','wei_yan'); g.selectHero('p2','deng_ai'); g.selectHero('p3','shen_jiangwei');
  g.landlord.hp = 0; g.landlord.alive = false;
  assert(g.checkWinner() === 'farmers');
  ok('游戏结束检测正确(地主死亡/农民胜利)');
} catch (e) { fail('游戏结束', e.message); }

// 10
try {
  const g = new Game('R7');
  const orig = [1,2,3,4,5,6,7,8,9,10];
  const s = [...orig];
  g.shuffle(s);
  assert(s.length === 10);
  assert(s.sort((a,b)=>a-b).join() === '1,2,3,4,5,6,7,8,9,10');
  ok('洗牌算法正确');
} catch (e) { fail('洗牌算法', e.message); }

// 11
try {
  const g = new Game('R8');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2);
  g.removePlayer('p1');
  assert(g.players.length === 1 && g.players[0].id === 'p2');
  ok('移除玩家正确');
} catch (e) { fail('移除玩家', e.message); }

// 12
try {
  const g = new Game('R9');
  const p1 = new Player('p1','A',new MockWS());
  const p2 = new Player('p2','B',new MockWS());
  const p3 = new Player('p3','C',new MockWS());
  g.addPlayer(p1); g.addPlayer(p2); g.addPlayer(p3);
  g.selectHero('p1','wei_yan'); g.selectHero('p2','deng_ai'); g.selectHero('p3','shen_jiangwei');
  assert(p1.ws.messages.some(m => m.type === 'game_state'));
  assert(p1.ws.messages.some(m => m.type === 'your_hand'));
  assert(p1.ws.messages.some(m => m.type === 'your_hero'));
  ok('游戏状态广播正确');
} catch (e) { fail('状态广播', e.message); }

console.log('\n结果：' + passed.length + ' 通过，' + failed.length + ' 失败');
if (failed.length > 0) {
  console.log('失败的测试：');
  failed.forEach(f => console.log('  - ' + f));
  process.exit(1);
}


const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;

const SUITS = ['spade','heart','club','diamond'];
const SUIT_SYMBOLS = { spade:'♠',heart:'♥',club:'♣',diamond:'♦' };
const SUIT_COLORS = { spade:'black',club:'black',heart:'red',diamond:'red' };
const NUMBERS = [3,4,5,6,7,8,9,10,11,12,13,14,15];
const NUMBER_NAMES = { 3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A',15:'2' };

function createDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      cards.push(new Card(suit, num));
    }
  }
  cards.push(new Card('joker', 16));
  cards.push(new Card('joker', 17));
  return cards;
}

class Card {
  constructor(suit, number) {
    this.suit = suit;
    this.number = number;
    this.id = `${suit}_${number}`;
  }
  get display() {
    if (this.suit === 'joker') {
      return this.number === 17 ? '大王' : '小王';
    }
    return `${SUIT_SYMBOLS[this.suit]}${NUMBER_NAMES[this.number]}`;
  }
  get color() {
    if (this.suit === 'joker') return 'red';
    return SUIT_COLORS[this.suit];
  }
}

const HEROES = [
  { id:'wei_yan', name:'势魏延', title:'狂骨傲将', hp:4, kingdom:'shu', skill:'狂骨：每造成1点伤害可回复1体或摸1牌。' },
  { id:'deng_ai', name:'势邓艾', title:'急袭先锋', hp:4, kingdom:'wei', skill:'急袭：可将判定牌当顺手牵羊使用。' },
  { id:'shen_jiangwei', name:'神姜维', title:'天任麒麟', hp:3, kingdom:'shu', skill:'天任：每回合限一次可观看一名其他角色手牌。' },
  { id:'guo_yuan', name:'势国渊', title:'镇卫柱石', hp:4, kingdom:'wei', skill:'镇卫：角色受伤害时可弃一牌令其伤害-1。' },
  { id:'cao_mao', name:'曹髦', title:'决死天子', hp:4, kingdom:'wei', skill:'决死：出牌阶段可与一名角色拼点，赢者获输者一牌。' },
  { id:'jie_jushou', name:'界沮授', title:'矢北谋士', hp:3, kingdom:'qun', skill:'矢北：受伤害时可弃牌转移给另一名角色。' },
  { id:'shi_yuji', name:'势于吉', title:'幻惑仙人', hp:3, kingdom:'qun', skill:'幻惑：可让角色猜测你的手牌类型，猜错受1点伤害。' },
  { id:'shen_sunce', name:'神孙策', title:'魂姿霸王', hp:4, kingdom:'wu', skill:'魂姿：摸牌阶段可少摸1牌本回合出牌无次数限制。' },
  { id:'jie_xusheng', name:'界徐盛', title:'破军将军', hp:4, kingdom:'wu', skill:'破军：使用杀造成伤害后可弃目标1牌。' },
  { id:'shen_zhaoyun', name:'神赵云', title:'绝境龙魂', hp:3, kingdom:'shu', skill:'绝境：手牌上限+2可将任意牌当杀或闪。' },
  { id:'xi_zhicai', name:'戏志才', title:'先辅军师', hp:3, kingdom:'wei', skill:'先辅：出牌阶段弃一牌可复制一名其他角色技能到回合结束。' },
];

class Player {
  constructor(id, name, ws) {
    this.id = id; this.name = name; this.ws = ws;
    this.hero = null; this.hp = 0; this.maxHp = 0;
    this.handCards = []; this.equipment = [];
    this.isLandlord = false; this.alive = true; this.role = null;
  }
  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

class Game {
  constructor(roomId) {
    this.roomId = roomId; this.players = []; this.deck = []; this.discardPile = [];
    this.currentTurn = 0; this.phase = 'lobby'; this.turnPhase = 'none';
    this.landlord = null; this.round = 0; this.actionsThisTurn = 0;
  }

  addPlayer(player) {
    if (this.players.length >= 3) return false;
    this.players.push(player);
    if (this.players.length === 3) {
      this.phase = 'selecting_heroes';
      this.broadcast({ type:'game_phase', phase:'selecting_heroes', msg:'请选择武将' });
      this.broadcast({ type:'hero_list', heroes:HEROES.map(h => ({ id:h.id, name:h.name, title:h.title, hp:h.hp, skill:h.skill })) });
    }
    return true;
  }

  removePlayer(playerId) { this.players = this.players.filter(p => p.id !== playerId); }

  selectHero(playerId, heroId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    const heroDef = HEROES.find(h => h.id === heroId);
    if (!heroDef || this.players.some(p => p.hero && p.hero.id === heroId)) return false;
    player.hero = { ...heroDef }; player.maxHp = heroDef.hp; player.hp = heroDef.hp;
    player.send({ type:'hero_selected', hero:heroDef });
    if (this.players.every(p => p.hero)) this.startGame();
    return true;
  }

  startGame() {
    this.deck = createDeck(); this.shuffle(this.deck); this.phase = 'playing';
    const landlordIdx = Math.floor(Math.random() * 3);
    this.landlord = this.players[landlordIdx];
    this.players.forEach(p => p.isLandlord = false);
    this.landlord.isLandlord = true; this.landlord.role = 'landlord';
    this.players.forEach(p => { if (p !== this.landlord) p.role = 'farmer'; });

    for (let i = 0; i < 3; i++) {
      for (let p of this.players) {
        p.handCards.push(this.deck.pop());
        p.handCards.push(this.deck.pop());
        p.handCards.push(this.deck.pop());
      }
    }
    for (let i = 0; i < 3; i++) this.landlord.handCards.push(this.deck.pop());

    this.broadcast({ type:'game_start', landlord:this.landlord.name, landlordId:this.landlord.id });
    for (let p of this.players) {
      p.send({ type:'your_hand', cards:p.handCards.map(c => ({ id:c.id, display:c.display, suit:c.suit, number:c.number, color:c.color })) });
      p.send({ type:'your_hero', hero:p.hero });
    }
    this.broadcastGameState();
    this.currentTurn = 0; this.round = 1;
    this.turnPhase = 'play'; this.actionsThisTurn = 0;
    const fp = this.players[this.currentTurn];
    this.broadcast({ type:'turn_change', playerId:fp.id, playerName:fp.name, round:this.round, phase:'play' });
    fp.send({ type:'your_turn', msg:'轮到你出牌了' });
    fp.send({ type:'your_hand', cards:fp.handCards.map(c => ({ id:c.id, display:c.display, suit:c.suit, number:c.number, color:c.color })) });
    this.broadcastGameState();
  }

  startTurn() {
    const player = this.players[this.currentTurn];
    if (!player || !player.alive) { this.nextAlivePlayer(); return; }
    this.turnPhase = 'draw'; this.actionsThisTurn = 0;
    this.broadcast({ type:'turn_change', playerId:player.id, playerName:player.name, round:this.round, phase:'draw' });
    player.send({ type:'your_turn', msg:'轮到你出牌了' });

    for (let i = 0; i < 2; i++) {
      if (this.deck.length > 0) player.handCards.push(this.deck.pop());
    }
    player.send({ type:'your_hand', cards:player.handCards.map(c => ({ id:c.id, display:c.display, suit:c.suit, number:c.number, color:c.color })) });
    this.broadcastGameState();
  }

  playCard(playerId, cardIds, targetId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.alive) return { error:'无效玩家' };
    if (this.currentTurn !== this.players.indexOf(player)) return { error:'还不是你的回合' };

    const cards = cardIds.map(id => {
      const idx = player.handCards.findIndex(c => c.id === id);
      if (idx === -1) return null;
      return player.handCards.splice(idx, 1)[0];
    }).filter(c => c !== null);
    if (cards.length === 0) return { error:'无效卡牌' };

    let target = targetId ? this.players.find(p => p.id === targetId) : null;
    if (!target) {
      target = player.isLandlord ? this.players.find(p => p !== player && p.alive) : this.landlord;
    }

    const card = cards[0];
    this.discardPile.push(card);

    if (card.number === 3) {
      if (target && target.alive) {
        target.hp -= 1;
        this.broadcast({ type:'card_played', playerId, playerName:player.name, cards:cards.map(c => c.display),
          targetId:target.id, targetName:target.name, damage:1, action:'attack' });
        if (target.hp <= 0) { target.hp = 0; target.alive = false;
          this.broadcast({ type:'player_died', playerId:target.id, playerName:target.name });
          const winner = this.checkWinner();
          if (winner) { this.endGame(winner); return { success:true }; }
        }
        this.broadcastGameState(); this.actionsThisTurn++;
        return { success:true };
      }
    }

    if (card.number === 14 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
      this.broadcast({ type:'card_played', playerId, playerName:player.name, cards:cards.map(c => c.display), action:'heal', amount:1 });
      this.broadcastGameState(); this.actionsThisTurn++;
      return { success:true };
    }

    this.broadcast({ type:'card_played', playerId, playerName:player.name, cards:cards.map(c => c.display), action:'discard' });
    this.broadcastGameState(); this.actionsThisTurn++;
    return { success:true };
  }

  checkWinner() {
    const la = this.players.find(p => p.isLandlord && p.alive);
    const fa = this.players.filter(p => !p.isLandlord && p.alive);
    if (!la) return 'farmers';
    if (fa.length === 0) return 'landlord';
    return null;
  }

  endTurn(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error:'无效玩家' };
    if (this.currentTurn !== this.players.indexOf(player)) return { error:'还不是你的回合' };
    this.broadcast({ type:'turn_ended', playerId, playerName:player.name });
    this.nextAlivePlayer();
    return { success:true };
  }

  nextAlivePlayer() {
    if (this.phase === 'ended') return;
    let next = (this.currentTurn + 1) % 3;
    let count = 0;
    while (!this.players[next].alive && count < 3) { next = (next + 1) % 3; count++; }
    this.currentTurn = next;
    if (this.currentTurn === 0) this.round++;
    this.turnPhase = 'play'; this.actionsThisTurn = 0;
    const fp = this.players[this.currentTurn];
    this.broadcast({ type:'turn_change', playerId:fp.id, playerName:fp.name, round:this.round, phase:'play' });
    fp.send({ type:'your_turn', msg:'轮到你出牌了' });
    fp.send({ type:'your_hand', cards:fp.handCards.map(c => ({ id:c.id, display:c.display, suit:c.suit, number:c.number, color:c.color })) });
    this.broadcastGameState();
  }

  endGame(winner) {
    this.phase = 'ended';
    this.broadcast({ type:'game_over', winner, landlordName:this.landlord.name,
      farmerNames:this.players.filter(p => !p.isLandlord).map(p => p.name) });
  }

  broadcastGameState() {
    this.broadcast({ type:'game_state',
      players: this.players.map(p => ({
        id: p.id, name: p.name, hp: p.hp, maxHp: p.maxHp,
        heroName: p.hero ? p.hero.name : null, heroId: p.hero ? p.hero.id : null,
        cardCount: p.handCards.length, isLandlord: p.isLandlord, alive: p.alive,
      })),
      deckCount: this.deck.length, round: this.round, turnPhase: this.turnPhase,
    });
  }

  broadcast(msg) { for (let p of this.players) p.send(msg); }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

if (require.main === module) {
const server = require('http').createServer((req, res) => {
  const fs2 = require('fs'), path2 = require('path');
  let fpath = path2.join(__dirname, req.url === '/' ? 'client.html' : req.url.slice(1));
  fs2.readFile(fpath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not Found');
      return;
    }
    const ext = fpath.split('.').pop();
    const mime = { html:'text/html; charset=utf-8', css:'text/css', js:'text/javascript', png:'image/png', jpg:'image/jpeg', svg:'image/svg+xml', ico:'image/x-icon' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();
const playerSockets = new Map();

server.listen(PORT, '0.0.0.0', () => {
    console.log('三人在各自设备打开该地址即可开始游戏');
});


}
module.exports = { Game, Player, Card, HEROES, createDeck };



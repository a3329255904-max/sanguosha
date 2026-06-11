# 三国杀斗地主

三人联机三国杀斗地主游戏，支持三台设备同时在线对战。

## 玩法

1. 一人打开页面 → 创建房间 → 获得房间号
2. 另两人打开页面 → 输入房间号 → 加入房间
3. 三人到齐后各自选择武将
4. 系统随机分配地主 (多3张牌)
5. 回合制出牌：杀扣血 / 桃回血
6. 地主杀光农民 或 农民杀掉地主 → 获胜

## 武将池 (11名)

势魏延 · 势邓艾 · 神姜维 · 势国渊 · 曹髦 · 界沮授 · 势于吉 · 神孙策 · 界徐盛 · 神赵云 · 戏志才

## 本地运行

```bash
cd sanguosha
npm install
npm start
```

浏览器打开 `http://localhost:3000`

## 部署到 Render (免费)

1. 把代码推送到 GitHub
2. 在 [Render.com](https://render.com) 注册并登录
3. 点击 **New +** → **Web Service**
4. 连接你的 GitHub 仓库
5. 填写:
   - Name: `sanguosha` (任意)
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`
6. 点击 **Create Web Service**
7. 等几分钟部署完成，就能获得公网 URL

## 运行测试

```bash
npm test
```

// Ovládanie televízora Samsung (Tizen, modely od roku 2016) cez Wi-Fi/sieť – bez HDMI kábla:
//   zapnutie: Wake-on-LAN (v TV: Nastavenia → Všeobecné → Sieť → Expertné nastavenia →
//             Zapnúť s mobilným zariadením / Power On with Mobile)
//   vypnutie, otvorenie Laudate v prehliadači TV: diaľkové ovládanie cez sieť (port 8002)
//   program: v zvolené dni a časy TV zapne, otvorí /#display a po omši vypne
// Nastavenie (IP, MAC, program, token od TV) je v tv.json – token sa neposiela do ovládania.
import dgram from 'node:dgram';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import WebSocket from 'ws';
import { writeFileAtomic } from './safeWrite.js';

const APP_NAME = Buffer.from('Laudate').toString('base64');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAYS = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];

export function createSamsungTv({ file, displayUrl, log = console.log }) {
  let config = { enabled: false, ip: '', mac: '', token: '', schedule: [] };
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    // ešte nenastavené
  }
  const status = { power: 'unknown', model: null, lastAction: null, lastError: null, checkedAt: null };

  const save = () => writeFileAtomic(file, JSON.stringify(config, null, 2));

  // Stav TV z jej REST rozhrania (port 8001): 'on', 'standby' (sieť v pohotovosti) alebo 'off'
  async function refresh() {
    if (!config.ip) return status;
    try {
      const res = await fetch(`http://${config.ip}:8001/api/v2/`, { signal: AbortSignal.timeout(2500) });
      const info = await res.json();
      const device = info.device || {};
      status.power = String(device.PowerState || 'on').toLowerCase() === 'on' ? 'on' : 'standby';
      status.model = device.modelName || info.name || null;
      // MAC adresa na zapnutie sa zistí sama, kým je TV zapnutá
      const mac = normalizeMac(device.wifiMac);
      if (mac && !config.mac) {
        config.mac = mac;
        save();
      }
    } catch {
      status.power = 'off';
    }
    if (!config.mac) {
      const mac = await macFromArp(config.ip);
      if (mac) {
        config.mac = mac;
        save();
      }
    }
    status.checkedAt = Date.now();
    return status;
  }

  // Jedno spojenie s TV: pošle príkazy a zavrie sa. Pri prvom spojení TV zobrazí otázku
  // "Povoliť Laudate?" – treba ju potvrdiť ovládačom TV, potom TV pošle token.
  function remote(messages, { timeoutMs = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!config.ip) return reject(new Error('Najprv zadajte IP adresu televízora'));
      const url = `wss://${config.ip}:8002/api/v2/channels/samsung.remote.control?name=${APP_NAME}${config.token ? `&token=${config.token}` : ''}`;
      const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: 5000 });
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('Televízor neodpovedá – je zapnutý a potvrdili ste na ňom povolenie pre Laudate?'));
      }, timeoutMs);
      ws.on('message', async (data) => {
        let msg;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        if (msg.event === 'ms.channel.connect') {
          if (msg.data?.token && msg.data.token !== config.token) {
            config.token = String(msg.data.token);
            save();
          }
          for (const m of messages) {
            ws.send(JSON.stringify(m));
            await sleep(400);
          }
          clearTimeout(timer);
          ws.close();
          resolve();
        } else if (msg.event === 'ms.channel.unauthorized') {
          clearTimeout(timer);
          ws.close();
          reject(new Error('Televízor nepovolil ovládanie – na TV potvrďte „Povoliť“ pre Laudate'));
        }
      });
      ws.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`Televízor nie je dostupný (${e.code || e.message})`));
      });
    });
  }

  const key = (k) => ({ method: 'ms.remote.control', params: { Cmd: 'Click', DataOfCmd: k, Option: 'false', TypeOfRemote: 'SendRemoteKey' } });
  const openUrl = (url) => ({
    method: 'ms.channel.emit',
    params: { event: 'ed.apps.launch', to: 'host', data: { appId: 'org.tizen.browser', action_type: 'NATIVE_LAUNCH', metaTag: url } },
  });

  async function wake() {
    if (!config.mac) throw new Error('MAC adresa televízora ešte nie je známa – zapnite TV raz ručne, Laudate si ju zistí');
    const mac = Buffer.from(config.mac.replace(/[^0-9a-f]/gi, ''), 'hex');
    const packet = Buffer.concat([Buffer.alloc(6, 0xff), ...Array(16).fill(mac)]);
    const targets = ['255.255.255.255', config.ip.replace(/\.\d+$/, '.255')];
    const sock = dgram.createSocket('udp4');
    await new Promise((r) => sock.bind(r));
    sock.setBroadcast(true);
    for (let i = 0; i < 3; i++) {
      for (const host of targets) {
        for (const port of [9, 7]) await new Promise((r) => sock.send(packet, port, host, () => r()));
      }
      await sleep(300);
    }
    sock.close();
  }

  async function waitFor(power, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if ((await refresh()).power === power) return true;
      await sleep(2000);
    }
    return false;
  }

  const actions = {
    // Zapne TV a otvorí na nej Laudate
    async on() {
      await refresh();
      if (status.power === 'standby') await remote([key('KEY_POWER')]);
      else if (status.power !== 'on') {
        await wake();
        if (!(await waitFor('on', 45000))) {
          // niektoré modely sa po Wake-on-LAN prebudia len do pohotovosti siete
          if (status.power === 'standby') await remote([key('KEY_POWER')]);
          else throw new Error('Televízor sa nezapol – zapnite v TV „Zapnúť s mobilným zariadením“ (Power On with Mobile)');
        }
      }
      await sleep(4000); // TV po zapnutí chvíľu nabieha
      await remote([openUrl(displayUrl())]);
    },
    async off() {
      await refresh();
      if (status.power !== 'on') return;
      await remote([key('KEY_POWER')]);
    },
    async open() {
      await remote([openUrl(displayUrl())]);
    },
    // Prvé spojenie: TV zobrazí otázku na povolenie (čaká sa až minútu)
    async pair() {
      await remote([], { timeoutMs: 60000 });
    },
  };

  async function run(action) {
    if (!actions[action]) throw new Error('Neznáma akcia');
    status.lastAction = { action, at: Date.now() };
    try {
      await actions[action]();
      status.lastError = null;
      log(`📺 TV: ${action} – ok`);
    } catch (e) {
      status.lastError = e.message;
      log(`📺 TV: ${action} – ${e.message}`);
      throw e;
    }
  }

  // Program: každú minútu skontroluje, či nie je čas zapnúť alebo vypnúť TV
  let lastMinute = '';
  setInterval(() => {
    if (!config.enabled || !config.ip) return;
    const now = new Date();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const stamp = `${now.toDateString()} ${hm}`;
    if (stamp === lastMinute) return;
    lastMinute = stamp;
    for (const item of config.schedule || []) {
      if (!item.days?.includes(now.getDay())) continue;
      if (item.on === hm) run('on').catch(() => {});
      if (item.off === hm) run('off').catch(() => {});
    }
  }, 15000).unref();

  return {
    status,
    refresh,
    run,
    publicConfig: () => ({ enabled: config.enabled, ip: config.ip, mac: config.mac, paired: Boolean(config.token), schedule: config.schedule || [] }),
    update(patch) {
      if (typeof patch.enabled === 'boolean') config.enabled = patch.enabled;
      if (typeof patch.ip === 'string') {
        const ip = patch.ip.trim();
        if (ip && !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('Neplatná IP adresa');
        if (ip !== config.ip) {
          config.ip = ip;
          config.mac = '';
          config.token = '';
        }
      }
      if (typeof patch.mac === 'string') {
        const mac = patch.mac.trim() ? normalizeMac(patch.mac) : '';
        if (patch.mac.trim() && !mac) throw new Error('Neplatná MAC adresa');
        config.mac = mac;
      }
      if (Array.isArray(patch.schedule)) config.schedule = patch.schedule.map(cleanScheduleItem).filter(Boolean);
      save();
      return this.publicConfig();
    },
  };
}

function normalizeMac(mac) {
  const hex = String(mac || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  return hex.length === 12 && hex !== '000000000000' ? hex.match(/../g).join(':') : '';
}

function macFromArp(ip) {
  return new Promise((resolve) => {
    execFile('ip', ['neigh', 'show', ip], { timeout: 2000 }, (err, stdout) => {
      resolve(err ? '' : normalizeMac((/lladdr\s+([0-9a-f:]+)/i.exec(stdout) || [])[1]));
    });
  });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function cleanScheduleItem(item) {
  if (!item || typeof item !== 'object') return null;
  const days = [...new Set((item.days || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  const on = TIME.test(item.on || '') ? item.on : '';
  const off = TIME.test(item.off || '') ? item.off : '';
  if (!days.length || (!on && !off)) return null;
  return { days, on, off };
}

export const DAY_NAMES = DAYS;

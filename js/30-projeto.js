/* =========================================================================
   Caça-Bug — 30-projeto.js
   Projetos: importar (.zip, arquivos soltos ou pasta), guardar no aparelho,
   escolher o projeto ativo e fazer o DIAGNÓSTICO RÁPIDO:
     - que tipo de projeto é (Replit, Vite/React, Expo, Capacitor, servidor, PWA);
     - quais apps existem dentro (ex.: pasta artifacts/ do Replit);
     - se ABRE PELO INDEX ou não, e por quê (a "barra" do /assets, código-fonte,
       módulo, servidor);
     - o "lacre" (COOP/COEP) do terminal real;
     - chaves/senhas esquecidas no código.
   E o conserto automático dos caminhos (/assets → ./assets) numa CÓPIA.
   ========================================================================= */
(function (SK) {
  'use strict';
  const dec = new TextDecoder();
  let ativo = null;          // { id, nome, ... } sem o zip
  let cacheEntradas = null;  // { id, entradas }

  // ── Guardar / listar ────────────────────────────────────────────────────────
  async function listar() {
    const todos = await SK.db.all('projetos');
    return todos.map(({ zip, ...resto }) => resto).sort((a, b) => b.data - a.data);
  }
  async function pegar(id) { return SK.db.get('projetos', id); }
  async function entradasDe(id) {
    if (cacheEntradas && cacheEntradas.id === id) return cacheEntradas.entradas;
    const p = await pegar(id);
    if (!p) throw new Error('Projeto não encontrado');
    const entradas = (await SK.zip.read(await p.zip.arrayBuffer())).filter((e) => !e.name.endsWith('/'));
    cacheEntradas = { id, entradas };
    return entradas;
  }
  async function guardar(nome, zip, origem, extra) {
    const entradas = (await SK.zip.read(await zip.arrayBuffer())).filter((e) => !e.name.endsWith('/'));
    const reg = Object.assign({ id: SK.uid(), nome, data: Date.now(), tamanho: zip.size, nArquivos: entradas.length, origem, zip }, extra || {});
    await SK.db.put('projetos', reg);
    await SK.persistStorage();
    cacheEntradas = { id: reg.id, entradas };
    await escolher(reg.id);
    return reg;
  }
  async function escolher(id) {
    const p = id ? await pegar(id) : null;
    ativo = p ? (({ zip, ...r }) => r)(p) : null;
    SK.pref.set('ativo', ativo ? ativo.id : null);
    SK.emit('projeto', ativo);
  }
  async function apagar(id) {
    await SK.db.del('projetos', id);
    if (ativo && ativo.id === id) await escolher(null);
    if (cacheEntradas && cacheEntradas.id === id) cacheEntradas = null;
  }
  /** O .zip do projeto ativo como arquivo (é o que as ferramentas recebem). */
  async function arquivoZip(id) {
    const p = await pegar(id || (ativo && ativo.id));
    if (!p) return null;
    const nome = /\.zip$/i.test(p.nome) ? p.nome : p.nome + '.zip';
    return new File([p.zip], nome, { type: 'application/zip' });
  }

  // ── Importar ───────────────────────────────────────────────────────────────
  const semExt = (n) => String(n || 'projeto').replace(/\.(zip|html?)$/i, '');
  async function importarArquivos(lista, ehPasta) {
    const arqs = [...lista];
    if (!arqs.length) return null;
    if (!ehPasta && arqs.length === 1 && /\.zip$/i.test(arqs[0].name)) {
      SK.toast('Lendo ' + arqs[0].name + '…');
      try { return await guardar(semExt(arqs[0].name), arqs[0], 'zip'); }
      catch (e) { throw new Error('Não consegui abrir este .zip: ' + e.message); }
    }
    if (arqs.some((f) => /\.(tar|tgz|gz|rar|7z)$/i.test(f.name))) throw new Error('Por enquanto o Caça-Bug abre .zip, arquivos soltos e pastas. Converta para .zip (no celular: segurar o arquivo → Compactar).');
    const entradas = [];
    for (const f of arqs) {
      const caminho = (ehPasta && f.webkitRelativePath) ? f.webkitRelativePath : f.name;
      if (/(^|\/)(node_modules|\.git)\//.test(caminho)) continue;
      entradas.push({ name: caminho, data: new Uint8Array(await f.arrayBuffer()) });
    }
    if (!entradas.length) throw new Error('Nenhum arquivo para importar.');
    const raiz = ehPasta ? (arqs[0].webkitRelativePath || '').split('/')[0] : '';
    const nome = raiz || (arqs.length === 1 ? semExt(arqs[0].name) : arqs.length + ' arquivos');
    const zip = await SK.zip.write(entradas);
    return guardar(nome, zip, ehPasta ? 'pasta' : 'arquivos');
  }

  // ── Diagnóstico rápido ──────────────────────────────────────────────────────
  const TEXTO = /\.(html?|js|mjs|cjs|jsx|ts|tsx|json|css|md|txt|yml|yaml|toml|nix|env|gradle|xml|java|kt|py|sh|bat|cfg|ini)$|(^|\/)(\.replit|\.env[^/]*|dockerfile|procfile)$/i;
  function texto(e) { try { return dec.decode(e.data); } catch { return ''; } }
  function raizComum(nomes) {
    const partes = nomes.map((n) => n.split('/'));
    if (!partes.length || partes.some((p) => p.length < 2)) return '';
    const r = partes[0][0];
    return partes.every((p) => p[0] === r) ? r + '/' : '';
  }
  function mascara(v) { return v.length <= 10 ? '•••' : v.slice(0, 4) + '•••' + v.slice(-3); }

  function examinarIndex(caminho, html, mapa) {
    const pasta = caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/') + 1) : '';
    const r = { caminho, problemas: [], avisos: [], ok: [] };
    const refs = [];
    html.replace(/<(script|link|img|source|iframe)\b[^>]*?\b(src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi, (tag, el, at, url) => { refs.push({ tag, el: el.toLowerCase(), url }); return tag; });
    const absolutos = refs.filter((x) => /^\/(?!\/)/.test(x.url) && !/^\/favicon/i.test(x.url));
    const fonte = refs.filter((x) => x.el === 'script' && /\.(tsx?|jsx)(\?|$)/i.test(x.url));
    const modulos = refs.filter((x) => x.el === 'script' && /type\s*=\s*["']module["']/i.test(x.tag) && !/^https?:/i.test(x.url));
    if (fonte.length) r.problemas.push('É o CÓDIGO-FONTE (aponta para ' + fonte[0].url + '). O navegador não roda .tsx/.jsx: precisa gerar o site pronto (npm run build → pasta dist).');
    if (absolutos.length) r.problemas.push('Caminhos com barra no começo (' + absolutos.slice(0, 3).map((x) => x.url).join(', ') + (absolutos.length > 3 ? '…' : '') + '). Abre no Netlify, mas pelo index fica em branco. Conserto: botão "Consertar caminhos".');
    // arquivos que o index pede e não existem no zip
    const faltando = refs.filter((x) => !/^(https?:|data:|blob:|mailto:|#|\/\/)/i.test(x.url) && !/^\//.test(x.url))
      .map((x) => (pasta + x.url.replace(/^\.\//, '')).split(/[?#]/)[0]).filter((p) => !mapa.has(p) && !/\.(webmanifest)$/i.test(p));
    if (faltando.length) r.avisos.push('O index pede arquivo que não está no projeto: ' + faltando.slice(0, 3).join(', ') + (faltando.length > 3 ? '…' : ''));
    if (modulos.length && !fonte.length) r.avisos.push('Usa "módulos" (type=module). Abrindo como ARQUIVO no Chrome, ele bloqueia. Abre normal como site, em app que abre como site (localhost) e dentro do APK.');
    if (!r.problemas.length && !r.avisos.length) r.ok.push('Deve abrir pelo index.');
    if (/serviceWorker\s*\.\s*register/.test(html)) r.ok.push('Registra um service worker (PWA/offline).');
    return r;
  }

  async function diagnostico(id) {
    const entradas = await entradasDe(id || (ativo && ativo.id));
    const raiz = raizComum(entradas.map((e) => e.name));
    const arqs = entradas.map((e) => ({ caminho: e.name.slice(raiz.length), e }));
    const mapa = new Map(arqs.map((a) => [a.caminho, a.e]));
    const tipos = {};
    let total = 0;
    for (const a of arqs) { const ext = (/\.([a-z0-9]+)$/i.exec(a.caminho) || [, '(sem)'])[1].toLowerCase(); tipos[ext] = (tipos[ext] || 0) + 1; total += a.e.data.length; }
    const D = { raiz, nArquivos: arqs.length, total, tipos, sinais: [], apps: [], indexes: [], chaves: [], lacre: [], servidor: [] };
    const tem = (re) => arqs.some((a) => re.test(a.caminho));
    if (tem(/(^|\/)\.replit$|(^|\/)replit\.nix$|(^|\/)\.replit-artifact\//)) D.sinais.push('Replit');
    if (tem(/(^|\/)artifacts\//)) D.sinais.push('pasta artifacts/ (vários apps do Replit)');
    if (tem(/(^|\/)vite\.config\.(t|j|m)s$/)) D.sinais.push('Vite (React)');
    if (tem(/(^|\/)capacitor\.config\./)) D.sinais.push('Capacitor');
    if (tem(/(^|\/)eas\.json$/)) D.sinais.push('Expo / EAS');
    if (tem(/(^|\/)(manifest\.json|manifest\.webmanifest)$/)) D.sinais.push('PWA (manifest)');
    if (tem(/(^|\/)(sw|service-worker)\.js$/)) D.sinais.push('service worker');
    if (tem(/(^|\/)android\/app\/build\.gradle$/)) D.sinais.push('projeto Android');
    if (tem(/(^|\/)\.git\//)) D.sinais.push('histórico Git');

    // apps: pastas com package.json ou index.html (no máximo 3 níveis)
    const pastasApp = new Set();
    for (const a of arqs) {
      const m = /^(.*?)(?:\/)?(package\.json|index\.html)$/.exec(a.caminho);
      if (!m || /node_modules|\/dist\/|\/build\//.test(a.caminho)) continue;
      const p = m[1];
      if (p.split('/').length <= 3) pastasApp.add(p);
    }
    for (const p of [...pastasApp].sort()) {
      const pre = p ? p + '/' : '';
      const pk = mapa.get(pre + 'package.json');
      let pkg = null; if (pk) { try { pkg = JSON.parse(texto(pk)); } catch {} }
      const deps = pkg ? Object.assign({}, pkg.dependencies, pkg.devDependencies) : {};
      const tipo = [];
      if (deps.expo) tipo.push('Expo (app de celular)');
      if (deps.react && !deps.expo) tipo.push('React');
      if (deps.vite) tipo.push('Vite');
      if (deps.express || deps.fastify || deps.hono || deps.koa) tipo.push('SERVIDOR');
      if (deps['@capacitor/core']) tipo.push('Capacitor');
      if (!pkg && mapa.has(pre + 'index.html')) tipo.push('HTML');
      const pronto = ['dist/index.html', 'build/index.html', 'www/index.html'].map((x) => pre + x).find((x) => mapa.has(x)) || (!pkg && mapa.has(pre + 'index.html') ? pre + 'index.html' : null);
      D.apps.push({ pasta: p || '(raiz)', nome: (pkg && pkg.name) || p.split('/').pop() || 'raiz', tipo: tipo.join(' · ') || '—', pronto: pronto || null, catalogo: pk ? /"catalog:/.test(texto(pk)) : false });
    }

    // index.html: examina todos (até 12)
    const idx = arqs.filter((a) => /(^|\/)index\.html?$/i.test(a.caminho) && !/node_modules/.test(a.caminho)).slice(0, 12);
    for (const a of idx) D.indexes.push(examinarIndex(a.caminho, texto(a.e), mapa));

    // varre texto: chaves, lacre, servidor
    const RE_CHAVE = /\b(AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_\-]{20,}|sk-(?:ant-|proj-)?[0-9A-Za-z_\-]{20,}|gsk_[0-9A-Za-z]{20,}|ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}|xox[bp]-[0-9A-Za-z\-]{20,})\b/g;
    for (const a of arqs) {
      if (!TEXTO.test(a.caminho) || a.e.data.length > 3e6 || /node_modules|\.min\.js$/.test(a.caminho)) continue;
      const t = texto(a.e);
      let m; RE_CHAVE.lastIndex = 0;
      while ((m = RE_CHAVE.exec(t)) && D.chaves.length < 50) {
        const linha = t.slice(0, m.index).split('\n').length;
        if (/exemplo|example|placeholder|xxxx|\.\.\./i.test(t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 10))) continue;
        D.chaves.push({ caminho: a.caminho, linha, valor: mascara(m[0]) });
      }
      if (/Cross-Origin-Embedder-Policy/i.test(t)) D.lacre.push(a.caminho);
      if (/\b(require\(['"](express|http)['"]\)|from ['"]express['"]|app\.listen\(|createServer\()/.test(t)) D.servidor.push(a.caminho);
    }
    D.expo = D.apps.some((a) => /Expo/.test(a.tipo));
    return D;
  }

  // ── Consertar caminhos (/assets → ./assets) numa cópia ──────────────────────
  async function consertarCaminhos(id) {
    const p = await pegar(id || (ativo && ativo.id));
    const entradas = await entradasDe(p.id);
    let mudou = 0;
    const novas = entradas.map((e) => {
      if (!/\.(html?|css)$/i.test(e.name)) return e;
      const t = texto(e);
      const nivel = e.name.split('/').length - 1 - (raizComum(entradas.map((x) => x.name)) ? 1 : 0);
      const pre = nivel > 0 ? '../'.repeat(nivel) : './';
      let n = t.replace(/(\s(?:src|href)\s*=\s*["'])\/(?!\/)/gi, (m0, a) => { mudou++; return a + pre; });
      if (/\.css$/i.test(e.name)) n = n.replace(/url\(\s*(["']?)\/(?!\/)/gi, (m0, q) => { mudou++; return 'url(' + q + pre; });
      return n === t ? e : { name: e.name, data: new TextEncoder().encode(n) };
    });
    // GitHub Pages: 404.html = cópia do index (as "rotas" do app voltam a abrir) e .nojekyll
    const raiz = raizComum(entradas.map((x) => x.name));
    const idx = novas.find((e) => e.name === raiz + 'index.html');
    let extras = 0;
    if (idx && !novas.some((e) => e.name === raiz + '404.html')) { novas.push({ name: raiz + '404.html', data: idx.data }); extras++; }
    if (idx && !novas.some((e) => e.name === raiz + '.nojekyll')) { novas.push({ name: raiz + '.nojekyll', data: new Uint8Array(0) }); extras++; }
    if (!mudou && !extras) { SK.toast('Nada para consertar: os caminhos já estão certos.'); return null; }
    const zip = await SK.zip.write(novas);
    const reg = await guardar(p.nome + ' (caminhos consertados)', zip, 'conserto', { de: p.id });
    SK.toast('Pronto: ' + mudou + ' caminho(s) consertados' + (extras ? ' + 404.html para o GitHub Pages' : '') + ', numa CÓPIA. O original ficou intacto.', 'ok');
    return reg;
  }

  SK.projeto = {
    listar, escolher, apagar, importarArquivos, diagnostico, consertarCaminhos, arquivoZip, entradasDe, pegar,
    get ativo() { return ativo; },
    async iniciar() { const id = SK.pref.get('ativo', null); if (id) await escolher(id).catch(() => escolher(null)); else SK.emit('projeto', null); },
  };
})(window.SK);

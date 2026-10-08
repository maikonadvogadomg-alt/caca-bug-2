/* =========================================================================
   Caça-Bug — 40-ferramentas.js
   Abre cada ferramenta (Cirurgião, Raio-X, Triagem, Perito…) DENTRO do app,
   sem mexer no jeito delas funcionarem:
   - entrega o projeto ativo automaticamente (não precisa importar de novo);
   - faz "baixar" funcionar dentro delas (no celular e no APK);
   - "📌 Guardar relatório" guarda o resultado na aba 📋 Relatórios.
   Cada ferramenta fica em ferramentas/<nome>.js e se registra em
   window.CB_FERRAMENTAS (dá para acrescentar outras depois).
   A ferramenta continua aberta quando você troca de aba (não perde o que fez).
   ========================================================================= */
(function (SK) {
  'use strict';
  const REG = () => window.CB_FERRAMENTAS || [];
  const abertas = new Map(); // id -> { frame, alimentado }
  let atual = null;

  // Entra no começo de cada ferramenta: faz "baixar" passar pelo app
  const KIT = '<script>(function(){var H;try{H=parent.SK}catch(e){}if(!H||!H.download)return;' +
    'function baixar(n,d){var b=(d&&typeof d.size==="number"&&typeof d.slice==="function")?d:new Blob([d]);H.download(n||"arquivo",b);}' +
    'window.claude=window.claude||{use:function(n){return Promise.resolve(n==="downloads"?{save:function(o){baixar(o.filename,o.data);return Promise.resolve();}}:null);}};' +
    'var G={},C=URL.createObjectURL;URL.createObjectURL=function(o){var u=C.apply(URL,arguments);try{if(o&&typeof o.size==="number")G[u]=o;}catch(e){}return u;};' +
    'function tenta(a){var h=a.href||"";if(!a.hasAttribute("download"))return false;var n=a.getAttribute("download")||h.split("/").pop()||"arquivo";' +
    'if(G[h]){baixar(n,G[h]);return true;}if(h.indexOf("data:")===0){fetch(h).then(function(r){return r.blob();}).then(function(b){baixar(n,b);});return true;}return false;}' +
    'var K=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(tenta(this))return;return K.apply(this,arguments);};' +
    'document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[download]");if(a&&tenta(a)){e.preventDefault();e.stopPropagation();}},true);' +
    '})();<\/script>';

  function comKit(html) {
    const i = html.search(/<head[^>]*>/i);
    if (i < 0) return KIT + html;
    const f = html.indexOf('>', i) + 1;
    return html.slice(0, f) + KIT + html.slice(f);
  }

  function lista() { return REG(); }
  function porId(id) { return REG().find((f) => f.id === id); }

  /** Espera a ferramenta ficar pronta (o __hub aparece depois que ela carrega). */
  function esperarHub(frame, ms) {
    return new Promise((ok) => {
      const t0 = Date.now();
      (function olha() {
        let h = null;
        try { h = frame.contentWindow && frame.contentWindow.__hub; } catch {}
        if (h) return ok(h);
        if (Date.now() - t0 > (ms || 15000)) return ok(null);
        setTimeout(olha, 150);
      })();
    });
  }

  function criarFrame(f) {
    const host = SK.$('#ferr-host');
    const frame = document.createElement('iframe');
    frame.className = 'ferr-frame';
    frame.title = f.nome;
    frame.setAttribute('allow', 'clipboard-read; clipboard-write; microphone; camera; fullscreen');
    frame.srcdoc = comKit(f.html);
    host.appendChild(frame);
    const reg = { frame, alimentado: null };
    abertas.set(f.id, reg);
    return reg;
  }

  async function alimentar(id, forcar) {
    const f = porId(id), reg = abertas.get(id), P = SK.projeto.ativo;
    if (!f || !reg || !f.alimenta || !P) return;
    if (!forcar && reg.alimentado === P.id) return;
    const hub = await esperarHub(reg.frame);
    if (!hub || !hub.abrir) { SK.toast('Esta ferramenta não recebeu o projeto sozinha: use o botão de importar dela.', 'error'); return; }
    const arq = await SK.projeto.arquivoZip(P.id);
    try { await hub.abrir(arq, 'A'); reg.alimentado = P.id; SK.toast('Projeto "' + P.nome + '" entregue ao ' + f.nome + '.'); }
    catch (e) { SK.toast('Não consegui entregar o projeto: ' + e.message, 'error'); }
  }

  async function abrir(id) {
    const f = porId(id);
    if (!f) return;
    SK.app.irPara('ferramenta');
    atual = id;
    SK.$('#ferr-titulo').textContent = f.icone + ' ' + f.nome;
    SK.$('#ferr-mandar').hidden = !f.alimenta;
    for (const [k, r] of abertas) r.frame.hidden = k !== id;
    const reg = abertas.get(id) || criarFrame(f);
    reg.frame.hidden = false;
    if (f.alimenta && SK.projeto.ativo) alimentar(id);
  }

  /** Raio-X com duas versões (A e B) para ver a diferença linha por linha. */
  async function abrirComparacao(idA, idB) {
    await abrir('raio-x');
    const reg = abertas.get('raio-x');
    const hub = await esperarHub(reg.frame);
    if (!hub) { SK.toast('O Raio-X não carregou (ele precisa de internet na primeira vez).', 'error'); return; }
    await hub.abrir(await SK.projeto.arquivoZip(idA), 'A');
    await hub.abrir(await SK.projeto.arquivoZip(idB), 'B');
    reg.alimentado = null;
    SK.toast('Raio-X: versão A e versão B carregadas. Veja a aba "Comparar" dele.');
  }

  async function guardarRelatorio() {
    const f = porId(atual), reg = abertas.get(atual);
    if (!f || !reg) return;
    let texto = '';
    try { const h = reg.frame.contentWindow.__hub; if (h && h.relatorio) texto = String(await h.relatorio() || ''); } catch {}
    if (!texto.trim()) {
      let corpo = '';
      try { corpo = reg.frame.contentDocument.body.innerText || ''; } catch {}
      if (!corpo.trim()) { SK.toast('Ainda não há resultado para guardar nesta ferramenta.', 'error'); return; }
      const ok = await SK.confirm('Esta ferramenta ainda não gerou um relatório próprio. Guardar o TEXTO DA TELA como está?', { okText: 'Guardar a tela' });
      if (!ok) return;
      texto = corpo;
    }
    const P = SK.projeto.ativo;
    await SK.relatorios.guardar({ ferramenta: f.icone + ' ' + f.nome, projeto: P ? P.id : null, projetoNome: P ? P.nome : '(sem projeto)', texto });
  }

  function montarLista(box) {
    const P = SK.projeto.ativo;
    box.innerHTML = (P ? '<p class="muted">As ferramentas recebem o projeto <b>' + SK.esc(P.nome) + '</b> sozinhas.</p>' : '<p class="aviso">Nenhum projeto escolhido: as ferramentas abrem vazias (você importa dentro delas). Para elas receberem sozinhas, escolha um projeto na aba 📁 Projetos.</p>') +
      '<div class="grade">' + lista().map((f) => '<button class="cartao-ferr" data-ferr="' + f.id + '"><span class="ic">' + f.icone + '</span><b>' + SK.esc(f.nome) + '</b><span class="muted small">' + SK.esc(f.desc) + '</span>' + (abertas.has(f.id) ? '<span class="tag">aberta</span>' : '') + '</button>').join('') + '</div>' +
      '<p class="muted small">As ferramentas buscam alguns componentes na internet na primeira vez (leitor de .zip). Depois de abertas, continuam abertas enquanto o app estiver aberto.</p>';
    box.querySelectorAll('[data-ferr]').forEach((b) => b.onclick = () => abrir(b.dataset.ferr));
  }

  SK.ferramentas = { lista, abrir, abrirComparacao, alimentar: () => alimentar(atual, true), guardarRelatorio, montarLista, comKit, get atual() { return atual; } };
})(window.SK);

/* =========================================================================
   Caça-Bug — 99-app.js
   Liga tudo: abas de baixo, tela de Projetos e tela de Diagnóstico.
   ========================================================================= */
(function (SK) {
  'use strict';
  const $ = (s) => SK.$(s);
  let aba = 'projetos', anterior = 'ferramentas';

  function irPara(nome) {
    if (nome !== 'ferramenta' && aba !== 'ferramenta') anterior = aba;
    if (nome === 'ferramenta' && aba !== 'ferramenta') anterior = aba;
    aba = nome;
    SK.$$('.tela').forEach((t) => (t.hidden = t.dataset.tela !== nome));
    SK.$$('#abas [data-aba]').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome || (nome === 'ferramenta' && b.dataset.aba === 'ferramentas')));
    document.body.classList.toggle('modo-ferramenta', nome === 'ferramenta');
    if (nome === 'projetos') telaProjetos();
    if (nome === 'diagnostico') telaDiagnostico();
    if (nome === 'ferramentas') SK.ferramentas.montarLista($('#tela-ferramentas'));
    if (nome === 'comparar') SK.comparar.montar($('#tela-comparar'));
    if (nome === 'relatorios') SK.relatorios.montar($('#tela-relatorios'));
  }

  // ── Projetos ────────────────────────────────────────────────────────────────
  async function telaProjetos() {
    const box = $('#tela-projetos');
    const L = await SK.projeto.listar();
    const P = SK.projeto.ativo;
    box.innerHTML =
      '<div class="card"><h3>Importar um projeto</h3>' +
      '<p class="muted small">Um .zip, arquivos soltos (ex.: um HTML) ou uma pasta inteira. Fica guardado neste aparelho. Cada versão que você importar vira um projeto separado (bom para comparar).</p>' +
      '<div class="row wrap"><button class="btn primary" id="imp-zip">📦 .zip</button><button class="btn" id="imp-arq">📄 Arquivos</button><button class="btn" id="imp-pasta">📁 Pasta</button></div></div>' +
      (L.length ? '<h3 class="sub">Guardados (' + L.length + ')</h3><div class="stack">' + L.map((p) =>
        '<div class="card proj' + (P && P.id === p.id ? ' ativo' : '') + '" data-id="' + p.id + '"><div class="row"><b class="grow">' + SK.esc(p.nome) + '</b>' + (P && P.id === p.id ? '<span class="tag">em uso</span>' : '') + '</div>' +
        '<div class="muted small">' + SK.fmt(p.nArquivos) + ' arquivos · ' + SK.bytes(p.tamanho) + ' · ' + new Date(p.data).toLocaleString('pt-BR') + (p.origem === 'conserto' ? ' · cópia consertada' : '') + '</div>' +
        '<div class="row wrap"><button class="btn small primary" data-a="usar">Usar este</button><button class="btn small" data-a="diag">🩺 Diagnóstico</button><button class="btn small" data-a="baixar">⤓ .zip</button><button class="btn small" data-a="mandar">📤 Drive…</button><button class="btn small" data-a="renomear">Renomear</button><button class="btn small danger" data-a="apagar">Apagar</button></div></div>').join('') + '</div>'
        : '<div class="vazio">Nenhum projeto guardado ainda.</div>');
    $('#imp-zip').onclick = () => escolherArquivos('.zip', false, false);
    $('#imp-arq').onclick = () => escolherArquivos('', true, false);
    $('#imp-pasta').onclick = () => escolherArquivos('', true, true);
    box.querySelectorAll('.proj').forEach((el) => el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = el.dataset.id, reg = L.find((x) => x.id === id);
      try {
        if (b.dataset.a === 'usar') { await SK.projeto.escolher(id); telaProjetos(); SK.toast('Em uso: ' + reg.nome); }
        if (b.dataset.a === 'diag') { await SK.projeto.escolher(id); irPara('diagnostico'); }
        if (b.dataset.a === 'baixar') SK.download(reg.nome + '.zip', await SK.projeto.arquivoZip(id));
        if (b.dataset.a === 'mandar') SK.compartilhar(reg.nome + '.zip', await SK.projeto.arquivoZip(id), 'application/zip');
        if (b.dataset.a === 'renomear') { const n = await SK.prompt('Novo nome:', reg.nome); if (n && n.trim()) { const p = await SK.projeto.pegar(id); p.nome = n.trim(); await SK.db.put('projetos', p); if (SK.projeto.ativo && SK.projeto.ativo.id === id) await SK.projeto.escolher(id); telaProjetos(); } }
        if (b.dataset.a === 'apagar') { if (await SK.confirm('Apagar "' + reg.nome + '" deste aparelho? (Os relatórios dele continuam guardados.)', { okText: 'Apagar', danger: true })) { await SK.projeto.apagar(id); telaProjetos(); } }
      } catch (er) { SK.toast(er.message, 'error'); }
    }));
  }
  function escolherArquivos(accept, multiplo, pasta) {
    const inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept; inp.multiple = multiplo;
    if (pasta) inp.setAttribute('webkitdirectory', '');
    inp.onchange = async () => {
      try { const r = await SK.projeto.importarArquivos(inp.files, pasta); if (r) { SK.toast('Guardado: ' + r.nome + ' (' + SK.fmt(r.nArquivos) + ' arquivos)', 'ok'); irPara('diagnostico'); } }
      catch (e) { SK.toast(e.message, 'error'); }
    };
    inp.click();
  }

  // ── Diagnóstico ─────────────────────────────────────────────────────────────
  let ultimoDiag = null;
  async function telaDiagnostico() {
    const box = $('#tela-diagnostico');
    const P = SK.projeto.ativo;
    if (!P) { box.innerHTML = '<div class="vazio">Escolha ou importe um projeto na aba 📁 Projetos.</div>'; return; }
    box.innerHTML = '<p class="muted">⏳ Examinando ' + SK.esc(P.nome) + '…</p>';
    let D;
    try { D = await SK.projeto.diagnostico(P.id); } catch (e) { box.innerHTML = '<p class="erro">❌ ' + SK.esc(e.message) + '</p>'; return; }
    ultimoDiag = { P, D };
    const tipos = Object.entries(D.tipos).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + v).join(' · ');
    const temAbs = D.indexes.some((x) => x.problemas.some((p) => /barra no começo/.test(p)));
    let s = '<div class="card"><h3>' + SK.esc(P.nome) + '</h3><p class="muted small">' + SK.fmt(D.nArquivos) + ' arquivos · ' + SK.bytes(D.total) + (D.raiz ? ' · pasta de dentro: ' + SK.esc(D.raiz) : '') + '</p>' +
      '<p class="small">' + SK.esc(tipos) + '</p>' + (D.sinais.length ? '<p>' + D.sinais.map((x) => '<span class="tag">' + SK.esc(x) + '</span>').join(' ') + '</p>' : '') + '</div>';
    if (D.apps.length) s += '<div class="card"><h3>Apps dentro do projeto (' + D.apps.length + ')</h3><div class="tabela-rolar"><table class="tab"><tr><th>Pasta</th><th>Tipo</th><th>Site pronto?</th></tr>' +
      D.apps.map((a) => '<tr><td>' + SK.esc(a.pasta) + (a.catalogo ? ' <span class="tag laranja" title="package.json com catalog: — só funciona no Replit">catalog:</span>' : '') + '</td><td>' + SK.esc(a.tipo) + '</td><td>' + (a.pronto ? '✅ ' + SK.esc(a.pronto.replace(a.pasta === '(raiz)' ? '' : a.pasta + '/', '')) : '—') + '</td></tr>').join('') + '</table></div>' +
      '<p class="muted small">"Site pronto" = tem a pasta dist/ (ou build/) com index.html: é essa que abre pelo index e vira APK. Sem ela, o projeto é só código-fonte.</p></div>';
    s += '<div class="card"><h3>Abre pelo index?</h3>' + (D.indexes.length ? D.indexes.map((x) =>
      '<div class="idx"><code>' + SK.esc(x.caminho) + '</code>' +
      x.problemas.map((p) => '<div class="linha ruim">❌ ' + SK.esc(p) + '</div>').join('') +
      x.avisos.map((p) => '<div class="linha meio">⚠️ ' + SK.esc(p) + '</div>').join('') +
      x.ok.map((p) => '<div class="linha bom">✅ ' + SK.esc(p) + '</div>').join('') + '</div>').join('') : (D.expo ? '<p class="linha meio">ℹ️ É um app Expo (React Native): não abre pelo index. Ele vira APK pela EAS (npm run apk / eas build), não pelo 📦 APK do Mini SK.</p>' : '<p class="linha ruim">❌ Não tem nenhum index.html. Sem ele não abre como página nem vira APK pelo Mini SK.</p>')) +
      (temAbs ? '<button class="btn primary" id="diag-consertar">🔧 Consertar caminhos (numa cópia)</button>' : '') + '</div>';
    if (D.lacre.length) s += '<div class="card"><h3>🔒 Lacre do terminal real (COOP/COEP)</h3><p class="small">Aparece em: ' + D.lacre.map((c) => '<code>' + SK.esc(c) + '</code>').join(', ') + '</p><p class="muted small">É o que faz o terminal de verdade (Node) funcionar. Só funciona aberto como site (https ou localhost). Não tire se você usa o terminal.</p></div>';
    if (D.servidor.length) s += '<div class="card"><h3>🖥️ Precisa de servidor</h3><p class="small">' + D.servidor.slice(0, 8).map((c) => '<code>' + SK.esc(c) + '</code>').join(', ') + (D.servidor.length > 8 ? '…' : '') + '</p><p class="muted small">Essas partes só funcionam com o servidor rodando (no computador). No celular/APK, só a parte de tela.</p></div>';
    s += '<div class="card"><h3>🔑 Chaves e senhas no código</h3>' + (D.chaves.length ? '<p class="linha ruim">❌ ' + D.chaves.length + ' encontrada(s). Tire antes de mandar para o GitHub ou para alguém:</p><ul class="lista">' + D.chaves.map((k) => '<li><code>' + SK.esc(k.caminho) + '</code> linha ' + k.linha + ' — ' + SK.esc(k.valor) + '</li>').join('') + '</ul>' : '<p class="linha bom">✅ Nenhuma chave encontrada.</p>') + '</div>';
    s += '<div class="row wrap"><button class="btn primary" id="diag-guardar">📌 Guardar relatório</button><button class="btn" id="diag-ferr">🧰 Abrir as ferramentas</button></div>';
    box.innerHTML = s;
    const bc = $('#diag-consertar'); if (bc) bc.onclick = async () => { try { await SK.projeto.consertarCaminhos(P.id); telaDiagnostico(); } catch (e) { SK.toast(e.message, 'error'); } };
    $('#diag-guardar').onclick = () => SK.relatorios.guardar({ ferramenta: '🩺 Diagnóstico rápido', projeto: P.id, projetoNome: P.nome, texto: textoDiag(P, D) });
    $('#diag-ferr').onclick = () => irPara('ferramentas');
  }
  function textoDiag(P, D) {
    const L = ['DIAGNÓSTICO RÁPIDO — ' + P.nome, SK.fmt(D.nArquivos) + ' arquivos, ' + SK.bytes(D.total), 'Sinais: ' + (D.sinais.join(', ') || '—'), ''];
    if (D.apps.length) { L.push('APPS DENTRO DO PROJETO'); for (const a of D.apps) L.push('  - ' + a.pasta + ': ' + a.tipo + ' · site pronto: ' + (a.pronto || 'não') + (a.catalogo ? ' · catalog: (só Replit)' : '')); L.push(''); }
    L.push('ABRE PELO INDEX?');
    if (!D.indexes.length) L.push(D.expo ? '  ℹ️ App Expo: vira APK pela EAS, não pelo index' : '  ❌ Não tem index.html');
    for (const x of D.indexes) { L.push('  ' + x.caminho); x.problemas.forEach((p) => L.push('    ❌ ' + p)); x.avisos.forEach((p) => L.push('    ⚠️ ' + p)); x.ok.forEach((p) => L.push('    ✅ ' + p)); }
    if (D.lacre.length) L.push('', 'LACRE (COOP/COEP — terminal real): ' + D.lacre.join(', '));
    if (D.servidor.length) L.push('', 'PRECISA DE SERVIDOR: ' + D.servidor.join(', '));
    L.push('', 'CHAVES NO CÓDIGO: ' + (D.chaves.length ? '' : 'nenhuma'));
    for (const k of D.chaves) L.push('  - ' + k.caminho + ' linha ' + k.linha + ' — ' + k.valor);
    return L.join('\n');
  }

  // ── Topo: projeto em uso ────────────────────────────────────────────────────
  SK.on('projeto', (P) => { $('#topo-proj').textContent = P ? P.nome : 'nenhum projeto'; if (aba === 'diagnostico') telaDiagnostico(); });

  function iniciar() {
    SK.$$('#abas [data-aba]').forEach((b) => b.onclick = () => irPara(b.dataset.aba));
    $('#topo-proj').onclick = () => irPara('projetos');
    $('#ferr-voltar').onclick = () => irPara(anterior === 'ferramenta' ? 'ferramentas' : anterior);
    $('#ferr-guardar').onclick = () => SK.ferramentas.guardarRelatorio();
    $('#ferr-mandar').onclick = () => SK.ferramentas.alimentar();
    SK.projeto.iniciar().then(() => irPara(SK.projeto.ativo ? 'diagnostico' : 'projetos'));
  }
  SK.app = { irPara };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window.SK);

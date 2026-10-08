/* =========================================================================
   Caça-Bug — 50-relatorios.js
   📋 Relatórios guardados: cada análise fica salva no aparelho, com data,
   ferramenta e projeto. Não some quando você sai da ferramenta.
   Abrir · copiar · baixar · mandar (Drive/WhatsApp) · ouvir · apagar.
   "Baixar todos" junta tudo num .zip.
   ========================================================================= */
(function (SK) {
  'use strict';

  async function guardar({ ferramenta, projeto, projetoNome, texto }) {
    const r = { id: SK.uid(), data: Date.now(), ferramenta, projeto: projeto || '-', projetoNome: projetoNome || '', texto: String(texto || '') };
    await SK.db.put('relatorios', r);
    SK.toast('📌 Relatório guardado (aba 📋 Relatórios).', 'ok');
    SK.emit('relatorios');
    return r;
  }
  async function listar() { return (await SK.db.all('relatorios')).sort((a, b) => b.data - a.data); }
  const nomeArq = (r) => (r.ferramenta.replace(/[^\wÀ-ú]+/g, ' ').trim() + ' - ' + r.projetoNome + ' - ' + new Date(r.data).toISOString().slice(0, 16).replace(/[T:]/g, '-')).replace(/[^\w\-. À-ú]+/g, '_').slice(0, 120) + '.txt';
  const cabecalho = (r) => r.ferramenta + '\nProjeto: ' + r.projetoNome + '\nGuardado em: ' + new Date(r.data).toLocaleString('pt-BR') + '\n' + '─'.repeat(50) + '\n';

  let falando = false;
  function ouvir(t) {
    if (!('speechSynthesis' in window)) { SK.toast('Este aparelho não lê em voz alta aqui.', 'error'); return; }
    speechSynthesis.cancel();
    if (falando) { falando = false; return; }
    falando = true;
    const pedacos = t.replace(/[═─•]+/g, ' ').match(/[\s\S]{1,1500}(\n|$)/g) || [t];
    pedacos.forEach((p, i) => { const u = new SpeechSynthesisUtterance(p); u.lang = 'pt-BR'; if (i === pedacos.length - 1) u.onend = () => { falando = false; }; speechSynthesis.speak(u); });
  }

  async function montar(box) {
    const L = await listar();
    if (!L.length) { box.innerHTML = '<div class="vazio">Nenhum relatório guardado ainda. Dentro de uma ferramenta, toque em <b>📌 Guardar relatório</b>.</div>'; return; }
    box.innerHTML = '<div class="row wrap"><button class="btn" id="rel-zip">⤓ Baixar todos (.zip)</button><button class="btn" id="rel-zip-share">📤 Mandar todos (Drive…)</button></div>' +
      '<div class="stack">' + L.map((r) => '<div class="card rel" data-id="' + r.id + '"><div class="row"><b class="grow">' + SK.esc(r.ferramenta) + '</b><span class="muted small">' + new Date(r.data).toLocaleString('pt-BR') + '</span></div>' +
        '<div class="muted small">' + SK.esc(r.projetoNome) + ' · ' + SK.fmt(r.texto.length) + ' letras</div>' +
        '<div class="row wrap"><button class="btn small" data-a="ver">Abrir</button><button class="btn small" data-a="ouvir">🔊 Ouvir</button><button class="btn small" data-a="copiar">Copiar</button><button class="btn small" data-a="baixar">⤓ Baixar</button><button class="btn small" data-a="mandar">📤 Drive…</button><button class="btn small danger" data-a="apagar">Apagar</button></div>' +
        '<pre class="rel-texto" hidden></pre></div>').join('') + '</div>';
    const porId = new Map(L.map((r) => [r.id, r]));
    box.querySelectorAll('.rel').forEach((el) => el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const r = porId.get(el.dataset.id), t = cabecalho(r) + r.texto;
      switch (b.dataset.a) {
        case 'ver': { const pre = SK.$('.rel-texto', el); pre.hidden = !pre.hidden; if (!pre.textContent) pre.textContent = t; b.textContent = pre.hidden ? 'Abrir' : 'Fechar'; break; }
        case 'ouvir': ouvir(t); break;
        case 'copiar': SK.copy(t); break;
        case 'baixar': SK.download(nomeArq(r), t); break;
        case 'mandar': SK.compartilhar(nomeArq(r), new Blob([t], { type: 'text/plain' }), 'text/plain'); break;
        case 'apagar': if (await SK.confirm('Apagar este relatório?', { okText: 'Apagar', danger: true })) { await SK.db.del('relatorios', r.id); montar(box); } break;
      }
    }));
    const zipTodos = async () => SK.zip.write(L.map((r) => ({ name: nomeArq(r), data: cabecalho(r) + r.texto })));
    SK.$('#rel-zip', box).onclick = async () => SK.download('relatorios-caca-bug.zip', await zipTodos());
    SK.$('#rel-zip-share', box).onclick = async () => SK.compartilhar('relatorios-caca-bug.zip', await zipTodos(), 'application/zip');
  }

  SK.relatorios = { guardar, listar, montar };
})(window.SK);

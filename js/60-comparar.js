/* =========================================================================
   Caça-Bug — 60-comparar.js
   ⚖️ Comparar versões: escolha 2 ou mais projetos guardados e veja
     - a tabela de RECURSOS por versão (IA, voz, PDF, Word, DJEN…) ✓ / —
     - arquivos: só numa, só na outra, mudaram, iguais
     - funções, rotas e telas que existem numa versão e faltam na outra
   Serve para saber o que dá para APROVEITAR de cada versão.
   ========================================================================= */
(function (SK) {
  'use strict';
  const dec = new TextDecoder();
  const TEXTO = /\.(html?|js|mjs|cjs|jsx|ts|tsx|json|css|md|txt|yml|yaml|vue|svelte|py|java|kt)$/i;
  const IGNORAR = /(^|\/)(node_modules|\.git|dist|build|\.expo|\.cache|\.local|\.replit-artifact)\/|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|\.min\.(js|css)$|\.map$/;

  // Recursos que interessam para decidir o que aproveitar
  const RECURSOS = [
    ['🤖 IA (chat)', /openai|anthropic|generativelanguage|groq\.com|openrouter|ollama|\/chat\/completions|gemini/i],
    ['🗣️ Ler em voz (TTS)', /speechSynthesis|expo-speech|SpeechSynthesisUtterance/],
    ['🎤 Ditado por voz', /SpeechRecognition|webkitSpeechRecognition|expo-speech-recognition/],
    ['📄 Ler PDF', /pdfjs|pdf\.js|getDocument\(|pdf-parse/i],
    ['🧾 Gerar PDF', /jspdf|pdfmake|pdf-lib|html2pdf|window\.print\(/i],
    ['📝 Word (.docx)', /docx|mammoth|\.docx/i],
    ['📊 Planilha (Excel)', /xlsx|sheetjs|exceljs/i],
    ['🗜️ ZIP', /jszip|JSZip|fflate|adm-zip/],
    ['🔍 OCR (ler imagem)', /tesseract/i],
    ['🐙 GitHub', /api\.github\.com|octokit/i],
    ['⚖️ DJEN / comunicações', /djen|comunicaapi|comunica\.pje/i],
    ['🏦 BCB / índices', /api\.bcb\.gov\.br|bcdata|sgs\./i],
    ['🧮 Cálculo judicial', /juros|correção|correcao|honor[aá]rios|INPC|IPCA|SELIC/i],
    ['🗄️ Banco online', /supabase|firebase|neon\.tech|postgres|DATABASE_URL|mongodb/i],
    ['💾 Guarda no aparelho', /indexedDB|localStorage|AsyncStorage|expo-sqlite/],
    ['📷 Câmera', /getUserMedia|expo-camera|capture=/],
    ['📱 PWA / offline', /serviceWorker|manifest\.json|webmanifest/],
    ['🖥️ Servidor (Express)', /express\(|from ['"]express['"]|require\(['"]express['"]\)|app\.listen\(/],
    ['💻 Terminal', /xterm|WebContainer|@webcontainer|child_process/],
    ['🔁 Replit', /\.replit|REPL_ID|REPLIT_|replit\.dev|@replit/],
  ];

  function raizComum(nomes) {
    const p = nomes.map((n) => n.split('/'));
    if (!p.length || p.some((x) => x.length < 2)) return '';
    return p.every((x) => x[0] === p[0][0]) ? p[0][0] + '/' : '';
  }
  async function indice(id) {
    const reg = await SK.projeto.pegar(id);
    const entradas = await SK.projeto.entradasDe(id);
    const raiz = raizComum(entradas.map((e) => e.name));
    const arquivos = new Map(); // caminho -> { tam, hash, texto }
    const funcs = new Map(), rotas = new Map(), telas = new Map();
    const rec = new Set();
    for (const e of entradas) {
      const c = e.name.slice(raiz.length);
      if (!c || IGNORAR.test(c)) continue;
      const ehTexto = TEXTO.test(c) && e.data.length < 4e6;
      const t = ehTexto ? dec.decode(e.data) : '';
      arquivos.set(c, { tam: e.data.length, hash: SK.zip.crc32(e.data), texto: t });
      if (!ehTexto) continue;
      for (const [nome, re] of RECURSOS) if (!rec.has(nome) && re.test(t)) rec.add(nome);
      let m;
      const reF = /(?:function\s+([A-Za-z_$][\w$]{2,})\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]{2,})\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
      while ((m = reF.exec(t))) { const n = m[1] || m[2]; if (!funcs.has(n)) funcs.set(n, c); }
      const reR = /\b(?:app|router|r)\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
      while ((m = reR.exec(t))) { const k = m[1].toUpperCase() + ' ' + m[2]; if (!rotas.has(k)) rotas.set(k, c); }
      const reT = /<title>([^<]{2,80})<\/title>|<Route\s[^>]*path=["']([^"']+)["']|Tabs\.Screen\s+name=["']([^"']+)["']|<h1[^>]*>([^<]{3,60})<\/h1>/g;
      while ((m = reT.exec(t))) { const k = (m[1] || m[2] || m[3] || m[4]).trim(); if (k && !telas.has(k)) telas.set(k, c); }
    }
    return { id, nome: reg.nome, data: reg.data, arquivos, funcs, rotas, telas, rec };
  }

  function difLinhas(a, b) {
    // conta linhas novas/removidas (aproximado, por "saco de linhas")
    const ca = new Map(); for (const l of a.split('\n')) { const k = l.trim(); if (k) ca.set(k, (ca.get(k) || 0) + 1); }
    let mais = 0, menos = 0;
    const cb = new Map(); for (const l of b.split('\n')) { const k = l.trim(); if (k) cb.set(k, (cb.get(k) || 0) + 1); }
    for (const [k, n] of cb) mais += Math.max(0, n - (ca.get(k) || 0));
    for (const [k, n] of ca) menos += Math.max(0, n - (cb.get(k) || 0));
    return { mais, menos };
  }
  const soEm = (A, B) => [...A.keys()].filter((k) => !B.has(k)).sort();

  async function comparar(ids) {
    const V = [];
    for (const id of ids) V.push(await indice(id));
    const R = { versoes: V.map((v) => ({ id: v.id, nome: v.nome, nArq: v.arquivos.size, nFunc: v.funcs.size })), recursos: [], pares: [] };
    const todos = RECURSOS.map(([n]) => n).filter((n) => V.some((v) => v.rec.has(n)));
    R.recursos = todos.map((n) => ({ nome: n, tem: V.map((v) => v.rec.has(n)) }));
    // comparação detalhada: a primeira contra cada uma das outras
    const A = V[0];
    for (const B of V.slice(1)) {
      const mudaram = [];
      let iguais = 0;
      for (const [c, a] of A.arquivos) {
        const b = B.arquivos.get(c);
        if (!b) continue;
        if (a.hash === b.hash) { iguais++; continue; }
        mudaram.push(Object.assign({ caminho: c }, a.texto || b.texto ? difLinhas(a.texto, b.texto) : { mais: 0, menos: 0 }));
      }
      mudaram.sort((x, y) => (y.mais + y.menos) - (x.mais + x.menos));
      R.pares.push({
        a: A.nome, b: B.nome,
        soA: soEm(A.arquivos, B.arquivos), soB: soEm(B.arquivos, A.arquivos), mudaram, iguais,
        funcSoA: soEm(A.funcs, B.funcs).map((n) => ({ n, c: A.funcs.get(n) })), funcSoB: soEm(B.funcs, A.funcs).map((n) => ({ n, c: B.funcs.get(n) })),
        rotaSoA: soEm(A.rotas, B.rotas), rotaSoB: soEm(B.rotas, A.rotas),
        telaSoA: soEm(A.telas, B.telas), telaSoB: soEm(B.telas, A.telas),
      });
    }
    return R;
  }

  function textoRelatorio(R) {
    const L = [];
    L.push('COMPARAÇÃO DE VERSÕES — Caça-Bug');
    L.push('Data: ' + new Date().toLocaleString('pt-BR'));
    L.push('Versões: ' + R.versoes.map((v, i) => (i + 1) + ') ' + v.nome + ' (' + v.nArq + ' arquivos, ' + v.nFunc + ' funções)').join('  '));
    L.push('', 'RECURSOS POR VERSÃO');
    for (const r of R.recursos) L.push('  ' + r.nome.padEnd(26) + r.tem.map((t) => (t ? '✓' : '—')).join('   '));
    for (const p of R.pares) {
      L.push('', '═'.repeat(60), p.a + '  ×  ' + p.b, '═'.repeat(60));
      L.push('Arquivos iguais: ' + p.iguais + ' · mudaram: ' + p.mudaram.length + ' · só na 1ª: ' + p.soA.length + ' · só na 2ª: ' + p.soB.length);
      const bloco = (titulo, lista, fmt) => { if (!lista.length) return; L.push('', titulo + ' (' + lista.length + ')'); for (const x of lista) L.push('  - ' + (fmt ? fmt(x) : x)); };
      bloco('Só em ' + p.a + ' — arquivos', p.soA);
      bloco('Só em ' + p.b + ' — arquivos', p.soB);
      bloco('Mudaram (linhas + / −)', p.mudaram, (m) => m.caminho + '  (+' + m.mais + ' / −' + m.menos + ')');
      bloco('Funções que só ' + p.a + ' tem', p.funcSoA, (f) => f.n + '  [' + f.c + ']');
      bloco('Funções que só ' + p.b + ' tem', p.funcSoB, (f) => f.n + '  [' + f.c + ']');
      bloco('Rotas de servidor só em ' + p.a, p.rotaSoA);
      bloco('Rotas de servidor só em ' + p.b, p.rotaSoB);
      bloco('Telas/títulos só em ' + p.a, p.telaSoA);
      bloco('Telas/títulos só em ' + p.b, p.telaSoB);
    }
    return L.join('\n');
  }

  // ── Tela ─────────────────────────────────────────────────────────────────────
  let ultimo = null;
  async function montar(box) {
    const lista = await SK.projeto.listar();
    if (lista.length < 2) {
      box.innerHTML = '<div class="vazio">Para comparar, guarde pelo menos <b>2 versões</b> na aba 📁 Projetos (importe os .zip de cada versão).</div>';
      return;
    }
    box.innerHTML =
      '<p class="muted">Marque as versões (a <b>primeira marcada</b> é a base; as outras são comparadas com ela).</p>' +
      '<div class="stack" id="cmp-lista">' + lista.map((p) => '<label class="chk-linha"><input type="checkbox" value="' + p.id + '"> <span><b>' + SK.esc(p.nome) + '</b><br><span class="muted small">' + SK.fmt(p.nArquivos) + ' arquivos · ' + new Date(p.data).toLocaleDateString('pt-BR') + '</span></span></label>').join('') + '</div>' +
      '<div class="row wrap"><button class="btn primary" id="cmp-ir">⚖️ Comparar</button><button class="btn" id="cmp-rx">🩻 Ver linha por linha no Raio-X</button></div>' +
      '<div id="cmp-res" class="stack"></div>';
    const ordem = [];
    box.querySelectorAll('#cmp-lista input').forEach((c) => c.addEventListener('change', () => {
      const i = ordem.indexOf(c.value); if (c.checked && i < 0) ordem.push(c.value); if (!c.checked && i >= 0) ordem.splice(i, 1);
    }));
    SK.$('#cmp-ir', box).onclick = async () => {
      if (ordem.length < 2) { SK.toast('Marque pelo menos 2 versões.', 'error'); return; }
      const res = SK.$('#cmp-res', box);
      res.innerHTML = '<p class="muted">⏳ Comparando…</p>';
      try { ultimo = await comparar(ordem.slice(0, 6)); res.innerHTML = html(ultimo); ligar(res); }
      catch (e) { res.innerHTML = '<p class="erro">❌ ' + SK.esc(e.message) + '</p>'; }
    };
    SK.$('#cmp-rx', box).onclick = () => {
      if (ordem.length !== 2) { SK.toast('Para o Raio-X, marque exatamente 2 versões.', 'error'); return; }
      SK.ferramentas.abrirComparacao(ordem[0], ordem[1]);
    };
  }

  function html(R) {
    const cab = '<tr><th>Recurso</th>' + R.versoes.map((v, i) => '<th title="' + SK.esc(v.nome) + '">' + (i + 1) + '</th>').join('') + '</tr>';
    const linhas = R.recursos.map((r) => {
      const dif = r.tem.some((t) => t) && !r.tem.every((t) => t);
      return '<tr' + (dif ? ' class="dif"' : '') + '><td>' + SK.esc(r.nome) + '</td>' + r.tem.map((t) => '<td class="c">' + (t ? '✓' : '—') + '</td>').join('') + '</tr>';
    }).join('');
    let s = '<div class="card"><h3>Recursos por versão</h3><p class="muted small">' + R.versoes.map((v, i) => (i + 1) + ' = ' + SK.esc(v.nome)).join(' · ') + '. Linhas em destaque: existe numa e falta noutra.</p><div class="tabela-rolar"><table class="tab">' + cab + linhas + '</table></div></div>';
    for (const p of R.pares) {
      const det = (titulo, lista, fmt, aberto) => lista.length ? '<details' + (aberto ? ' open' : '') + '><summary>' + titulo + ' <b>(' + lista.length + ')</b></summary><ul class="lista">' + lista.slice(0, 400).map((x) => '<li>' + (fmt ? fmt(x) : SK.esc(x)) + '</li>').join('') + (lista.length > 400 ? '<li class="muted">… e mais ' + (lista.length - 400) + ' (veja no relatório completo)</li>' : '') + '</ul></details>' : '';
      s += '<div class="card"><h3>' + SK.esc(p.a) + ' × ' + SK.esc(p.b) + '</h3>' +
        '<p class="muted small">Iguais: ' + p.iguais + ' · mudaram: ' + p.mudaram.length + ' · só na 1ª: ' + p.soA.length + ' · só na 2ª: ' + p.soB.length + '</p>' +
        det('🟢 Funções que só a 2ª tem (o que ela tem a mais)', p.funcSoB, (f) => '<code>' + SK.esc(f.n) + '</code> <span class="muted small">' + SK.esc(f.c) + '</span>', true) +
        det('🟠 Funções que só a 1ª tem (o que a 2ª perdeu)', p.funcSoA, (f) => '<code>' + SK.esc(f.n) + '</code> <span class="muted small">' + SK.esc(f.c) + '</span>', true) +
        det('Telas/títulos só na 2ª', p.telaSoB) + det('Telas/títulos só na 1ª', p.telaSoA) +
        det('Rotas de servidor só na 2ª', p.rotaSoB) + det('Rotas de servidor só na 1ª', p.rotaSoA) +
        det('Arquivos só na 2ª', p.soB) + det('Arquivos só na 1ª', p.soA) +
        det('Arquivos que mudaram (+ linhas novas / − linhas tiradas)', p.mudaram, (m) => SK.esc(m.caminho) + ' <span class="muted small">+' + m.mais + ' / −' + m.menos + '</span>') +
        '</div>';
    }
    s += '<div class="row wrap"><button class="btn primary" data-a="guardar">📌 Guardar relatório</button><button class="btn" data-a="copiar">Copiar</button><button class="btn" data-a="baixar">⤓ Baixar .txt</button></div>';
    return s;
  }
  function ligar(res) {
    res.querySelectorAll('[data-a]').forEach((b) => b.onclick = async () => {
      const t = textoRelatorio(ultimo);
      const nome = 'comparacao-' + ultimo.versoes.map((v) => v.nome).join('-x-').replace(/[^\w\-]+/g, '_').slice(0, 80) + '.txt';
      if (b.dataset.a === 'copiar') SK.copy(t);
      if (b.dataset.a === 'baixar') SK.download(nome, t);
      if (b.dataset.a === 'guardar') { await SK.relatorios.guardar({ ferramenta: '⚖️ Comparar versões', projeto: ultimo.versoes[0].id, projetoNome: ultimo.versoes.map((v) => v.nome).join(' × '), texto: t }); }
    });
  }

  SK.comparar = { montar, comparar, textoRelatorio, RECURSOS };
})(window.SK);

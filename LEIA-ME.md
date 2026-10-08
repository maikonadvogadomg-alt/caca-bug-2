# 🐞 Caça-Bug — versão 1 (primeira parte)

App separado, só para **achar e entender erros**: projetos do Replit, versões antigas, e também a perícia de documentos.
Funciona sozinho (não depende do Mini SK). Abre pelo **index.html**, funciona **sem internet** e pode virar **APK** pelo botão 📦 APK do Mini SK.

## As 5 abas (embaixo)

| Aba | O que faz |
|---|---|
| 📁 **Projetos** | Importa um **.zip**, arquivos soltos ou uma **pasta**. Fica guardado no aparelho. Cada versão que você importar vira um projeto separado. Dá para renomear, baixar o .zip e mandar para o Drive. |
| 🩺 **Diagnóstico** | Em segundos diz: que tipo de projeto é, **quais apps tem dentro** (a pasta `artifacts/` do Replit), se tem **site pronto** (dist), se **abre pelo index** e por quê, o **lacre** do terminal real, se **precisa de servidor** e se tem **chave/senha esquecida** no código. |
| 🧰 **Ferramentas** | Cirurgião, Raio-X, Triagem e Perito de Metadados, **inteiras**, dentro do app. Elas **recebem o projeto sozinhas** — não precisa importar de novo em cada uma. |
| ⚖️ **Comparar** | Marque 2 ou mais versões. Mostra a **tabela de recursos** (IA, voz, PDF, Word, DJEN, BCB…) com ✓ por versão, e o que **uma tem e a outra não**: funções, telas, rotas e arquivos. Para ver linha por linha, manda as duas para o Raio-X. |
| 📋 **Relatórios** | Tudo que você guardar com **📌 Guardar relatório** fica aqui, com data. Abrir, 🔊 ouvir, copiar, baixar, mandar para o Drive. "Baixar todos" junta num .zip. |

## Consertos automáticos
- **🔧 Consertar caminhos** (no Diagnóstico): troca `/assets/...` por `./assets/...`, que é o motivo mais comum de um site "rodar no Netlify mas não abrir pelo index". Faz numa **cópia** — o original fica intacto.

## O que foi conferido
Testado num navegador Chromium, abrindo pelo index (como arquivo):
- importar .zip, diagnóstico, conserto de caminhos (o conteúdo do zip consertado foi conferido);
- Cirurgião, Raio-X e Triagem recebendo o projeto sozinhos;
- detecção "🚨 Replit" do Cirurgião e o relatório dele guardado;
- comparação de duas versões e o relatório guardado e baixado.

**Ainda não foi testado num celular de verdade.**

## Bônus (defeitos das ferramentas antigas que foram corrigidos AQUI dentro)
- Raio-X e Triagem **não baixavam nada** fora do site onde foram feitas ("Baixar não está disponível nesta tela"). Aqui baixam.
- Triagem: o aviso "conversa de exemplo" **nunca sumia**. Aqui some.
- Leitor de .zip e comparador de texto vão **junto** (pasta `lib/`): não precisam de internet.

## Próximas partes (uma de cada vez)
1. **⚙️ Configurar para APK (EAS)**: importar o projeto → nome, conta (owner), slug, projectId → baixar `app.json` e `eas.json` certos (junta os geradores que você tem).
2. **🐙 Mandar para o GitHub** (projeto ou relatórios).
3. **Mandar para o Mini SK** um projeto consertado.

## Para quem for mexer no código
- `js/00-core.js` e `js/20-zip.js` são a mesma base do Mini SK.
- Cada ferramenta está em `ferramentas/*.js`, gerada a partir do HTML original por `ferramentas/montar.py`. Para atualizar uma ferramenta: troque o HTML original e rode o montar de novo.
- Para acrescentar ferramenta nova: um arquivo em `ferramentas/` que faça `CB_FERRAMENTAS.push({ id, nome, icone, desc, alimenta, html })` e, dentro do HTML, `window.__hub = { abrir(arquivoZip), relatorio() }`.
- Licenças das bibliotecas em `lib/` (JSZip: MIT/GPLv3; jsdiff: BSD).

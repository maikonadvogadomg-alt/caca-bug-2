# Monta ferramentas/*.js do Caça-Bug a partir dos HTML originais (sem mexer neles).
import json, re
H='/home/claude/'
def fim_body(s, extra):
    i=s.lower().rfind('</body>')
    return s[:i]+extra+s[i:] if i>=0 else s+extra
def inserir_antes(s, alvo, extra):
    assert alvo in s, alvo[:60]
    return s.replace(alvo, extra+alvo, 1)

F=[]
# Cirurgião
s=open(H+'cirurgiao/index.html').read()
s=s.replace('Cirurgião de Código 4.4','Cirurgião de Código 4.5').replace('Cirurgião 4.4','Cirurgião 4.5')
s=fim_body(s,"<script>window.__hub={abrir:function(f){return carregarFiles([f]);},relatorio:function(){try{return R?relatorio(itensFiltrados()):'';}catch(e){return '';}}};</script>")
F.append(dict(id='cirurgiao',nome='Cirurgião',icone='🩻',desc='Marcas do Replit, bugs, dependências, chaves, terminal',alimenta=True,html=s))
# Raio-X
s=open(H+'raio-x.html').read()
s=inserir_antes(s,"['A', 'B'].forEach(k => {","window.__hub={abrir:function(f,slot){return loadZip(slot==='B'?'B':'A',f);},relatorio:function(){return (S.A||S.B)?reportMD(S):'';}};\n")
F.append(dict(id='raio-x',nome='Raio-X',icone='🔬',desc='Mapa do projeto, rotas, segredos; compara A × B linha por linha',alimenta=True,html=s))
# Triagem
s=open(H+'triagem.html').read()
s=s.replace('.banner{border:1px solid var(--line)','[hidden]{display:none!important}\n.banner{border:1px solid var(--line)',1)  # o aviso de exemplo nunca sumia
s=inserir_antes(s,"async function importFiles(fileList){","window.__hub={abrir:function(f){return importFiles([f]);}};\n")
F.append(dict(id='triagem',nome='Triagem',icone='🧩',desc='Organiza e divide um HTML grande em módulos (pastas)',alimenta=True,html=s))
# Perito
s=open(H+'perito/perito-metadados.html').read()
s=fim_body(s,"<script>window.__hub={relatorio:function(){try{var t=textoRelatorio();return /\\S/.test(t)?t:'';}catch(e){return '';}}};</script>")
F.append(dict(id='perito',nome='Perito de Metadados',icone='🕵️',desc='PDF e fotos de prova: datas, edição, assinatura, GPS (seus documentos, não o projeto)',alimenta=False,html=s))

for f in F:
    # bibliotecas da internet -> cópia que vai junto no app (funciona offline e no APK)
    f['html']=f['html'].replace('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js','lib/jszip.min.js').replace('https://cdnjs.cloudflare.com/ajax/libs/jsdiff/5.2.0/diff.min.js','lib/diff.min.js')

    nome={'cirurgiao':'cirurgiao','raio-x':'raio-x','triagem':'triagem','perito':'perito'}[f['id']]
    js='/* Ferramenta do Caça-Bug — gerada a partir do HTML original (não edite aqui; edite o original e monte de novo). */\n'
    js+='(window.CB_FERRAMENTAS = window.CB_FERRAMENTAS || []).push('+json.dumps(f,ensure_ascii=False).replace('</script','<\\/script')+');\n'
    open(H+'cacabug/ferramentas/'+nome+'.js','w').write(js)
    print(nome, len(js))

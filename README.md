<p align="center">
  <b>Português</b> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <img src="docs/icon.svg" width="96" height="96" alt="Ícone do Embaralhar de Verdade">
</p>

<h1 align="center">Embaralhar de Verdade</h1>

<p align="center">
  Extensão de navegador que toca playlists do YouTube Music <b>inteiras</b> e embaralhadas de verdade,<br>
  sem cortar músicas e sem alterar a playlist original.
</p>

---

## O problema

O aleatório do YouTube Music não toca a playlist inteira. Ao apertar o botão de aleatório, ele monta a fila com só uma parte das músicas e o resto nunca aparece. Em playlists grandes, você acaba ouvindo sempre as mesmas.

## O que a extensão faz

- **Embaralhar:** lê a playlist inteira, sorteia a ordem, começa a tocar na hora e coloca **todas** as outras músicas no "A seguir". Depois disso é o próprio YouTube Music que toca: próxima, anterior e a fila funcionam normalmente.
- **Salvar cópia embaralhada:** faz o mesmo sorteio, mas em vez de tocar cria uma playlist nova com o nome que você escolher, privada, não listada ou pública.
- **Embaralhar a fila:** embaralha o "A seguir" que já está tocando. A música atual continua tocando e todas as outras vêm depois, numa ordem sorteada.
- **Salvar fila como playlist:** cria uma playlist nova com as músicas da fila, na ordem em que estão.
- **A playlist original nunca é alterada.**
- Funciona com qualquer playlist: as suas, as de outras pessoas e Músicas curtidas.
- Músicas indisponíveis e repetidas ficam de fora.
- Aguenta playlists grandes: a música começa na hora e a fila é preenchida em lotes enquanto ela toca.
- Em português ou inglês, conforme o idioma do navegador.

## Instalação

Funciona no Chrome 111 ou mais novo e em navegadores baseados nele, como Edge, Brave e Opera.

Os arquivos para instalar ficam na página de [Releases](https://github.com/congio/embaralhar/releases/latest). Não é preciso baixar o repositório inteiro.

### Chrome, Edge, Brave, Opera

1. Baixe o arquivo `embaralhar-X.Y.Z-chrome.zip` da [versão mais recente](https://github.com/congio/embaralhar/releases/latest) e extraia. Vai aparecer uma pasta `embaralhar`.
2. No navegador, abra `seu_navegador://extensions`.
3. Ligue o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta **`embaralhar`** extraída.
5. Abra uma playlist em [music.youtube.com](https://music.youtube.com).

Não apague nem mova essa pasta depois de instalar: o navegador carrega a extensão a partir dela. Para atualizar, baixe a versão nova, substitua a pasta e clique em recarregar a extensão.

Se a página do YouTube Music já estava aberta, recarregue ela depois de instalar.

## Como usar

1. Abra uma playlist no YouTube Music.
2. Clique na **bolinha vermelha** no canto inferior direito da página e escolha **Embaralhar**.
3. A música começa e o "A seguir" recebe a playlist inteira embaralhada. O progresso aparece ao lado da bolinha.

Para guardar uma ordem sorteada, use **Salvar cópia embaralhada**: escolha o nome e quem pode ver, e a playlist nova é criada na sua conta.

Com música tocando, a bolinha também aparece fora das páginas de playlist. No menu dela, **Embaralhar a fila** sorteia a ordem do "A seguir" e **Salvar fila como playlist** guarda a fila numa playlist nova.

> Depois de embaralhar, não aperte o aleatório do próprio YouTube Music. Ele corta a fila de novo.

### Janela da extensão

Clicando no ícone da extensão na barra do navegador:

- **Extensão ligada:** liga e desliga a extensão. Desligada, ela some da página por completo.
- **Tema desta janela:** Automático (segue o navegador), Claro ou Escuro.

## Idioma

A extensão mostra os textos em português quando o navegador está em português, e em inglês em qualquer outro idioma. Os textos ficam na pasta `extension/_locales`, um arquivo por idioma.

## Como funciona

A extensão roda só em `music.youtube.com` e usa a sua sessão já logada no site, do mesmo jeito que a própria página faz:

1. Lê todas as músicas da playlist aberta, pulando as indisponíveis e as repetidas.
2. Sorteia a ordem com `crypto.getRandomValues` (embaralhamento de Fisher-Yates), então cada ordem possível tem a mesma chance.
3. **Embaralhar:** toca a primeira música sorteada e insere as outras no "A seguir" logo depois dela.
   **Salvar cópia:** cria uma playlist nova e adiciona as músicas na ordem sorteada.
4. **Embaralhar a fila:** lê o "A seguir", mantém a música atual no topo e coloca as outras numa ordem sorteada.
   **Salvar fila como playlist:** cria uma playlist nova com as músicas da fila, na ordem em que estão.

| Arquivo | Função |
| --- | --- |
| `extension/content.js` | Roda dentro da página: lê a playlist, embaralha, monta a fila, cria a cópia e desenha a bolinha. |
| `extension/bridge.js` | Repassa pra página a chave de ativar e os textos no idioma do navegador. |
| `extension/popup.html`, `popup.css`, `popup.js` | Janela da extensão. |
| `extension/_locales` | Textos em cada idioma. |
| `extension/manifest.json` | Configuração da extensão. |

## Privacidade

- A única permissão pedida é `storage`, usada para guardar as configurações da janela da extensão (extensão ligada e tema).
- A extensão não coleta, não guarda e não envia dados para nenhum lugar fora do `music.youtube.com`.
- Não existe servidor, conta ou rastreamento.

## Limitações

- A extensão usa a comunicação interna do site do YouTube Music, que não é oficial. Se o Google mudar o site, ela pode parar de funcionar até ser atualizada. Se isso acontecer, [abra uma issue](https://github.com/congio/embaralhar/issues).
- Só dá para salvar cópias na conta logada no navegador.

## Publicar uma versão nova

1. Suba o número de `version` em `extension/manifest.json` e registre a mudança no `CHANGELOG.md` e no `CHANGELOG.en.md`.
2. Compacte a pasta `extension` renomeada para `embaralhar` (com a pasta dentro do zip) como `embaralhar-X.Y.Z-chrome.zip`.
3. Crie uma release no GitHub com a tag `vX.Y.Z` e anexe o `embaralhar-X.Y.Z-chrome.zip`.

## Problemas

Se algo der errado, aparece um aviso ao lado da bolinha. Para mais detalhes, aperte **F12**, abra a aba **Console** e procure as mensagens que começam com `[Embaralhar de Verdade]`. Inclua essas mensagens ao [abrir uma issue](https://github.com/congio/embaralhar/issues).

## Licença

[MIT](LICENSE) © 2026 Congio

Este projeto não tem ligação com o Google nem com o YouTube. YouTube Music é marca registrada da Google LLC.
/**
 * Popula o blog com artigos completos para cada categoria.
 * Uso: pnpm --filter @blog/api exec tsx scripts/seed-content.ts
 *
 * Idempotente: pula posts cujo slug já existe. Gera contentHtml e
 * contentJson (Tiptap) a partir de uma única fonte, passa o HTML pela
 * sanitização real do app e calcula tempo de leitura. A coluna
 * search_vector (FTS) é gerada automaticamente pelo Postgres.
 */
import { PrismaClient, PostStatus, Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizePostHtml, readingTimeMin } from '../src/common/utils/sanitize';
import { slugify } from '../src/common/utils/slugify';

// ── .env ─────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

// ── DSL de conteúdo ──────────────────────────────────────────────────────────
type Mark = { type: 'bold' | 'italic' | 'code' | 'link'; attrs?: Record<string, unknown> };
type Run = { text: string; marks?: Mark[] };
type Inline = string | Run;
type Block =
  | { t: 'h'; level: 2 | 3; runs: Inline[] }
  | { t: 'p'; runs: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'quote'; runs: Inline[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'hr' };

const b = (text: string): Run => ({ text, marks: [{ type: 'bold' }] });
const i = (text: string): Run => ({ text, marks: [{ type: 'italic' }] });
const c = (text: string): Run => ({ text, marks: [{ type: 'code' }] });
const a = (text: string, href: string): Run => ({ text, marks: [{ type: 'link', attrs: { href } }] });

const h2 = (...runs: Inline[]): Block => ({ t: 'h', level: 2, runs });
const h3 = (...runs: Inline[]): Block => ({ t: 'h', level: 3, runs });
const p = (...runs: Inline[]): Block => ({ t: 'p', runs });
const ul = (...items: Inline[][]): Block => ({ t: 'ul', items });
const ol = (...items: Inline[][]): Block => ({ t: 'ol', items });
const quote = (...runs: Inline[]): Block => ({ t: 'quote', runs });
const code = (lang: string, text: string): Block => ({ t: 'code', lang, text });
const hr = (): Block => ({ t: 'hr' });

const asRun = (x: Inline): Run => (typeof x === 'string' ? { text: x } : x);

// ── Serialização → Tiptap JSON ───────────────────────────────────────────────
function inlineJson(runs: Inline[]) {
  return runs.map((x) => {
    const r = asRun(x);
    const node: Record<string, unknown> = { type: 'text', text: r.text };
    if (r.marks?.length) {
      node.marks = r.marks.map((m) =>
        m.type === 'link'
          ? { type: 'link', attrs: { href: (m.attrs as { href: string }).href, target: '_blank', rel: 'noopener noreferrer nofollow', class: null } }
          : { type: m.type },
      );
    }
    return node;
  });
}

function toJson(blocks: Block[]) {
  const content = blocks.map((blk) => {
    switch (blk.t) {
      case 'h':
        return { type: 'heading', attrs: { level: blk.level }, content: inlineJson(blk.runs) };
      case 'p':
        return { type: 'paragraph', content: inlineJson(blk.runs) };
      case 'ul':
      case 'ol':
        return {
          type: blk.t === 'ul' ? 'bulletList' : 'orderedList',
          ...(blk.t === 'ol' ? { attrs: { start: 1 } } : {}),
          content: blk.items.map((it) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: inlineJson(it) }],
          })),
        };
      case 'quote':
        return { type: 'blockquote', content: [{ type: 'paragraph', content: inlineJson(blk.runs) }] };
      case 'code':
        return { type: 'codeBlock', attrs: { language: blk.lang || null }, content: [{ type: 'text', text: blk.text }] };
      case 'hr':
        return { type: 'horizontalRule' };
    }
  });
  return { type: 'doc', content };
}

// ── Serialização → HTML ──────────────────────────────────────────────────────
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(runs: Inline[]): string {
  return runs
    .map((x) => {
      const r = asRun(x);
      let html = esc(r.text);
      for (const m of r.marks ?? []) {
        if (m.type === 'bold') html = `<strong>${html}</strong>`;
        else if (m.type === 'italic') html = `<em>${html}</em>`;
        else if (m.type === 'code') html = `<code>${html}</code>`;
        else if (m.type === 'link') html = `<a href="${esc((m.attrs as { href: string }).href)}">${html}</a>`;
      }
      return html;
    })
    .join('');
}

function toHtml(blocks: Block[]): string {
  return blocks
    .map((blk) => {
      switch (blk.t) {
        case 'h':
          return `<h${blk.level}>${inlineHtml(blk.runs)}</h${blk.level}>`;
        case 'p':
          return `<p>${inlineHtml(blk.runs)}</p>`;
        case 'ul':
          return `<ul>${blk.items.map((it) => `<li><p>${inlineHtml(it)}</p></li>`).join('')}</ul>`;
        case 'ol':
          return `<ol>${blk.items.map((it) => `<li><p>${inlineHtml(it)}</p></li>`).join('')}</ol>`;
        case 'quote':
          return `<blockquote><p>${inlineHtml(blk.runs)}</p></blockquote>`;
        case 'code':
          return `<pre><code class="language-${blk.lang}">${esc(blk.text)}</code></pre>`;
        case 'hr':
          return '<hr>';
      }
    })
    .join('');
}

// ── Artigos ──────────────────────────────────────────────────────────────────
interface Article {
  category: string; // slug
  title: string;
  excerpt: string;
  body: Block[];
}

const articles: Article[] = [
  // ─────────────────────────── TECNOLOGIA ───────────────────────────
  {
    category: 'tecnologia',
    title: 'O que são LLMs e como eles realmente funcionam',
    excerpt:
      'Uma explicação honesta sobre modelos de linguagem: tokens, atenção, janela de contexto e por que eles às vezes inventam respostas.',
    body: [
      p(
        'Modelos de linguagem grandes (',
        b('LLMs'),
        ', do inglês ',
        i('Large Language Models'),
        ') deixaram de ser assunto de laboratório e viraram parte do dia a dia de quem escreve código, texto ou e-mail. Mas por trás da conversa fluida existe uma mecânica surpreendentemente simples de descrever — e entendê-la muda a forma como você usa a ferramenta.',
      ),
      h2('A ideia central: prever a próxima palavra'),
      p(
        'No fundo, um LLM faz uma coisa só: dado um texto, ele estima qual é o próximo pedaço de texto mais provável. Só isso. Toda a aparência de raciocínio emerge de fazer essa previsão muito bem, bilhões de vezes, sobre uma quantidade gigantesca de texto.',
      ),
      p(
        'Esse "pedaço de texto" não é exatamente uma palavra. O modelo trabalha com ',
        b('tokens'),
        ' — fragmentos que podem ser uma palavra inteira, parte de uma palavra ou até um sinal de pontuação. A frase "programação assíncrona" pode virar algo como ',
        c('program'),
        ', ',
        c('ação'),
        ', ',
        c(' assín'),
        ', ',
        c('crona'),
        '. É por isso que limites de modelos são medidos em tokens, não em caracteres ou palavras.',
      ),
      h2('Atenção: o mecanismo que mudou tudo'),
      p(
        'A arquitetura que tornou os LLMs viáveis se chama ',
        b('Transformer'),
        ', apresentada em 2017. Seu ingrediente-chave é o mecanismo de ',
        i('atenção'),
        ': para cada token, o modelo pesa a relevância de todos os outros tokens da entrada. Isso permite capturar dependências longas — entender que o "ele" no fim de um parágrafo se refere ao sujeito lá do começo.',
      ),
      quote(
        'Atenção não é magia: é uma soma ponderada. O que impressiona é que, com dados e escala suficientes, essas ponderações passam a codificar gramática, fatos e até estilo.',
      ),
      h2('Janela de contexto: a memória de trabalho'),
      p(
        'Tudo que o modelo "vê" de uma vez cabe na ',
        b('janela de contexto'),
        ' — o número máximo de tokens que ele processa em uma única passagem. Se a conversa cresce além disso, o começo é esquecido. Modelos modernos têm janelas de dezenas ou centenas de milhares de tokens, mas o princípio permanece: fora da janela, não existe.',
      ),
      p('Na prática, isso significa três coisas para quem usa a ferramenta:'),
      ul(
        [b('Contexto é tudo.'), ' Instruções claras no início da conversa influenciam todas as respostas seguintes.'],
        [b('Documentos gigantes precisam de estratégia.'), ' Resumir ou recuperar só os trechos relevantes costuma funcionar melhor do que despejar tudo.'],
        [b('Conversas longas degradam.'), ' Quando o começo sai da janela, o modelo perde o fio.'],
      ),
      h2('Por que eles "alucinam"'),
      p(
        'O modelo não consulta um banco de fatos — ele gera o texto mais plausível. Quando a resposta plausível também é verdadeira, ótimo. Quando não, temos uma ',
        b('alucinação'),
        ': uma afirmação confiante e incorreta. Não é um bug pontual; é uma consequência direta de como o modelo funciona.',
      ),
      p('Algumas formas de reduzir o problema:'),
      ol(
        ['Peça fontes e verifique-as — a existência de uma citação não garante que ela seja real.'],
        ['Forneça o material de referência no próprio prompt, em vez de confiar na memória do modelo.'],
        ['Desconfie de precisão excessiva: datas, números e nomes próprios são onde o erro mais aparece.'],
      ),
      h2('O que isso muda para você'),
      p(
        'Entender que um LLM é um previsor de tokens — poderoso, mas sem acesso à verdade — transforma a ferramenta de "oráculo" em "assistente". Ela acelera rascunhos, explica conceitos e sugere caminhos; a responsabilidade pela verificação continua sendo humana. É exatamente essa combinação que a torna útil sem ser perigosa.',
      ),
    ],
  },
  {
    category: 'tecnologia',
    title: 'Monólito ou microsserviços? O trade-off que ninguém te conta',
    excerpt:
      'Microsserviços resolvem problemas de organização e escala — mas cobram um preço em complexidade. Um guia honesto para decidir.',
    body: [
      p(
        'Poucas decisões de arquitetura geram tanto debate quanto a escolha entre um ',
        b('monólito'),
        ' e uma malha de ',
        b('microsserviços'),
        '. A verdade desconfortável é que não existe resposta universal — existe um trade-off, e ignorá-lo custa caro dos dois lados.',
      ),
      h2('O que cada um realmente é'),
      p(
        'Um ',
        b('monólito'),
        ' é uma aplicação única: um código-base, um processo, um deploy. Já uma arquitetura de ',
        b('microsserviços'),
        ' quebra o sistema em serviços independentes, cada um com seu deploy, seu banco e, muitas vezes, seu time. A diferença fundamental não é técnica — é ',
        i('organizacional'),
        '.',
      ),
      h2('O que microsserviços resolvem de verdade'),
      ul(
        [b('Escala de times.'), ' Vinte engenheiros pisando no mesmo código-base geram atrito. Serviços separados permitem que times trabalhem e façam deploy de forma independente.'],
        [b('Escala seletiva.'), ' Se só o processamento de pagamentos precisa de mais máquinas, você escala apenas esse serviço, não o sistema inteiro.'],
        [b('Isolamento de falhas.'), ' Um serviço que cai não necessariamente derruba os outros — se a arquitetura for pensada para isso.'],
      ),
      h2('O que eles cobram em troca'),
      p('Cada fronteira de serviço vira uma chamada de rede, e a rede é lenta, falha e mente. Você troca chamadas de função por:'),
      ul(
        [b('Latência e falhas parciais.'), ' O que era instantâneo agora pode expirar, repetir ou chegar fora de ordem.'],
        [b('Consistência distribuída.'), ' Sem um banco único, manter dados coerentes entre serviços vira um problema de engenharia por si só.'],
        [b('Observabilidade obrigatória.'), ' Rastrear um bug que atravessa cinco serviços exige logs, métricas e tracing distribuído desde o dia um.'],
      ),
      quote(
        'Microsserviços não deixam seu sistema mais simples. Eles movem a complexidade do código para a operação — e essa conta chega para todo mundo.',
      ),
      h2('A regra prática'),
      p(
        'Uma heurística que envelhece bem: ',
        b('comece com um monólito bem organizado'),
        '. Separe o código em módulos com fronteiras claras internamente. Quando um módulo específico gritar por deploy independente, escala própria ou um time dedicado, extraia-o para um serviço. Deixe a dor real puxar a extração, não a moda.',
      ),
      p(
        'O antipadrão mais caro que existe é o ',
        i('monólito distribuído'),
        ': serviços separados que, na prática, precisam ser alterados e implantados juntos. Você paga o preço dos microsserviços e não recebe nenhum dos benefícios.',
      ),
      h2('Perguntas para decidir'),
      ol(
        ['Seu gargalo é técnico (escala) ou humano (times demais no mesmo código)?'],
        ['Você já tem observabilidade e automação de deploy maduras?'],
        ['As fronteiras entre domínios estão claras, ou ainda estão mudando toda semana?'],
      ),
      p(
        'Se as fronteiras ainda mudam, dividir cedo demais congela decisões que você ainda não entende. Nesse caso, um monólito modular não é dívida técnica — é a escolha madura.',
      ),
    ],
  },
  // ─────────────────────────── TUTORIAIS ───────────────────────────
  {
    category: 'tutoriais',
    title: 'Configurando um ambiente Node.js do zero em 2026',
    excerpt:
      'Do gerenciador de versões ao linter: um passo a passo para deixar seu ambiente de desenvolvimento Node.js sólido e reprodutível.',
    body: [
      p(
        'Um bom ambiente de desenvolvimento economiza horas de dor de cabeça. Este guia monta um setup Node.js moderno, reprodutível e pronto para trabalhar em equipe — sem passos mágicos que só funcionam na sua máquina.',
      ),
      h2('1. Gerencie versões do Node com um version manager'),
      p(
        'Nunca instale o Node direto do site em uma máquina de trabalho. Use um gerenciador de versões — assim você troca de versão por projeto sem conflito. No macOS/Linux, o ',
        c('nvm'),
        ' é o padrão; no Windows, o ',
        c('fnm'),
        ' ou o ',
        c('nvm-windows'),
        '.',
      ),
      code('bash', '# instala e usa a versão LTS mais recente\nnvm install --lts\nnvm use --lts\n\n# fixa a versão do projeto num arquivo\nnode --version > .nvmrc'),
      p(
        'O arquivo ',
        c('.nvmrc'),
        ' versiona a escolha: quem clonar o projeto roda ',
        c('nvm use'),
        ' e entra na mesma versão que você.',
      ),
      h2('2. Escolha um gerenciador de pacotes'),
      p(
        'O ',
        c('npm'),
        ' vem junto com o Node e resolve a maioria dos casos. Mas o ',
        c('pnpm'),
        ' se tornou popular por ser mais rápido e economizar disco — ele compartilha os pacotes entre projetos em vez de duplicá-los.',
      ),
      code('bash', '# habilita o pnpm via corepack (já incluído no Node)\ncorepack enable\ncorepack prepare pnpm@latest --activate\n\npnpm init'),
      quote(
        'Escolha um gerenciador e padronize no time. Misturar npm e pnpm no mesmo repositório gera lockfiles conflitantes e instalações imprevisíveis.',
      ),
      h2('3. TypeScript desde o início'),
      p('Mesmo em projetos pequenos, tipagem estática pega erros antes de você rodar o código. Instale e gere a configuração:'),
      code('bash', 'pnpm add -D typescript @types/node\npnpm exec tsc --init'),
      p('No ', c('tsconfig.json'), ', comece com opções estritas — é muito mais fácil começar rígido do que apertar depois:'),
      code('json', '{\n  "compilerOptions": {\n    "strict": true,\n    "target": "ES2022",\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "outDir": "dist",\n    "noUncheckedIndexedAccess": true\n  }\n}'),
      h2('4. Linter e formatador'),
      p(
        'Um ',
        b('linter'),
        ' (ESLint) pega padrões problemáticos; um ',
        b('formatador'),
        ' (Prettier) elimina discussões sobre estilo. Juntos, mantêm o código consistente entre pessoas diferentes.',
      ),
      code('bash', 'pnpm add -D eslint prettier\npnpm exec eslint --init'),
      h2('5. Padronize com scripts'),
      p('Deixe os comandos do dia a dia no ', c('package.json'), ' para todo mundo rodar o mesmo:'),
      code('json', '{\n  "scripts": {\n    "dev": "tsx watch src/index.ts",\n    "build": "tsc",\n    "lint": "eslint .",\n    "format": "prettier --write ."\n  }\n}'),
      h2('6. Não esqueça o .gitignore'),
      p('Antes do primeiro commit, evite versionar o que não deve entrar no repositório:'),
      code('bash', '# .gitignore\nnode_modules/\ndist/\n.env\n*.log'),
      p(
        'Com version manager, TypeScript estrito, lint, format e scripts padronizados, seu ambiente está pronto — e, mais importante, ',
        b('reproduzível'),
        '. Qualquer pessoa clona o repositório e chega ao mesmo estado que o seu em poucos comandos.',
      ),
    ],
  },
  {
    category: 'tutoriais',
    title: 'Git na prática: os comandos que você usa todo dia',
    excerpt:
      'Um guia direto dos comandos de Git que resolvem 90% do trabalho diário — e como sair das enrascadas mais comuns sem pânico.',
    body: [
      p(
        'Git é enorme, mas o uso diário cabe num punhado de comandos. Este guia foca no que você realmente repete todo dia — e no que fazer quando algo dá errado, que é onde o pânico costuma bater.',
      ),
      h2('O ciclo básico'),
      p('Quase todo trabalho segue o mesmo ritmo: alterar, revisar, agrupar e registrar.'),
      code('bash', '# o que mudou?\ngit status\ngit diff\n\n# agrupa as mudanças que vão no commit\ngit add arquivo.ts\n\n# registra com uma mensagem clara\ngit commit -m "Corrige cálculo de frete para pedidos internacionais"'),
      p(
        'Escreva mensagens no ',
        b('imperativo'),
        ' e explicando o ',
        i('porquê'),
        ', não o ',
        i('o quê'),
        '. O diff já mostra o que mudou; a mensagem deve dizer a intenção.',
      ),
      h2('Branches: trabalhe sem medo'),
      p('Nunca desenvolva direto na branch principal. Crie uma branch por tarefa:'),
      code('bash', '# cria e já muda para a nova branch\ngit switch -c feature/login-social\n\n# volta para a principal\ngit switch main\n\n# lista as branches\ngit branch'),
      quote(
        'Branches são baratas em Git. Crie uma para cada tarefa, por menor que seja — isso mantém seu trabalho isolado e fácil de descartar se der errado.',
      ),
      h2('Sincronizando com o remoto'),
      code('bash', '# traz as novidades do remoto sem mesclar\ngit fetch\n\n# traz e integra na sua branch atual\ngit pull\n\n# envia sua branch para o remoto\ngit push -u origin feature/login-social'),
      h2('Merge ou rebase?'),
      p(
        'Ambos integram mudanças de uma branch em outra, mas contam histórias diferentes. O ',
        c('merge'),
        ' preserva o histórico real, criando um commit de junção. O ',
        c('rebase'),
        ' reescreve seus commits como se tivessem nascido a partir do topo atual, deixando a linha do tempo reta.',
      ),
      ul(
        [b('Use rebase'), ' na sua branch local, antes de compartilhar, para um histórico limpo.'],
        [b('Use merge'), ' para integrar trabalho já compartilhado — reescrever histórico público confunde todo mundo.'],
      ),
      p('A regra de ouro: ', b('nunca faça rebase de commits que já foram enviados e que outras pessoas podem ter baixado.')),
      h2('Saindo de enrascadas'),
      h3('Commitei na branch errada'),
      code('bash', '# desfaz o último commit, mantendo as mudanças no diretório\ngit reset --soft HEAD~1\n# agora troque de branch e commite de novo'),
      h3('Preciso desfazer mudanças não commitadas'),
      code('bash', '# descarta alterações de um arquivo (irreversível!)\ngit restore arquivo.ts\n\n# guarda tudo temporariamente sem commitar\ngit stash\ngit stash pop  # traz de volta depois'),
      h3('Quero ver o que aconteceu'),
      code('bash', '# histórico compacto\ngit log --oneline --graph --decorate\n\n# quem alterou cada linha de um arquivo\ngit blame arquivo.ts'),
      p(
        'Domine esses comandos e você resolve a esmagadora maioria do trabalho diário com Git. O resto — ',
        c('cherry-pick'),
        ', ',
        c('bisect'),
        ', ',
        c('reflog'),
        ' — você aprende quando precisar, e aí já terá a base para entender o que está acontecendo.',
      ),
    ],
  },
  // ─────────────────────────── CARREIRA ───────────────────────────
  {
    category: 'carreira',
    title: 'Como montar um portfólio de dev que gera entrevistas',
    excerpt:
      'Recrutadores olham portfólios por segundos. Veja como transformar projetos em prova concreta de competência — e o que evitar.',
    body: [
      p(
        'Um bom portfólio não é uma galeria de projetos — é uma prova de que você resolve problemas de verdade. A diferença entre um portfólio que gera entrevistas e um que passa despercebido raramente está na quantidade de projetos, e quase sempre na forma como eles são apresentados.',
      ),
      h2('Menos projetos, mais profundidade'),
      p(
        'Três projetos bem-feitos valem mais do que doze pela metade. Um clone de to-do list a mais não diz nada; um projeto que resolve um problema real, com decisões justificadas, diz muito. Prefira ',
        b('profundidade a volume'),
        '.',
      ),
      quote(
        'O recrutador não quer ver que você sabe seguir um tutorial. Quer ver que você toma decisões, lida com trade-offs e termina o que começa.',
      ),
      h2('O README é o seu vendedor'),
      p('A maioria das pessoas não vai rodar seu código — vai ler o README. Trate-o como a página de vendas do projeto. Um bom README responde, em segundos:'),
      ul(
        [b('O que é'), ' e qual problema resolve, em uma frase.'],
        [b('Como rodar'), ' — comandos exatos, sem passos "óbvios" omitidos.'],
        [b('Quais decisões você tomou'), ' e por quê (banco, arquitetura, bibliotecas).'],
        [b('Um link ou print'), ' do projeto funcionando, para quem não vai clonar.'],
      ),
      h2('Coloque no ar'),
      p(
        'Um projeto que roda em produção comunica algo que nenhum print comunica: que você levou a coisa até o fim. Deploy de front-end é gratuito em várias plataformas; APIs e bancos têm camadas gratuitas suficientes para um portfólio. Um link que abre e funciona vale mais que mil linhas de descrição.',
      ),
      h2('Cuide do histórico de commits'),
      p(
        'Recrutadores técnicos abrem seu repositório. Um histórico com mensagens claras e commits coerentes mostra maturidade; um único commit gigante chamado "final" mostra o contrário. Você não precisa de um histórico perfeito — precisa de um que conte a história do desenvolvimento.',
      ),
      h2('Escreva sobre o que construiu'),
      p(
        'Um parágrafo explicando por que você escolheu determinada abordagem — e o que faria diferente hoje — demonstra a capacidade de reflexão que empresas procuram em pessoas sênior. É também o que diferencia você de alguém que apenas copiou um tutorial.',
      ),
      h2('O que evitar'),
      ol(
        ['Projetos abandonados no meio, sem README e sem deploy.'],
        ['Copiar um tutorial e apresentá-lo como projeto autoral — recrutadores reconhecem na hora.'],
        ['Focar só no visual e esconder o código; e o inverso, código bom sem nenhuma forma de ver funcionando.'],
      ),
      p(
        'No fim, o portfólio responde a uma única pergunta na cabeça de quem contrata: ',
        i('"essa pessoa consegue entregar?"'),
        ' Cada projeto, README e deploy é uma evidência a favor. Construa poucas evidências, mas fortes.',
      ),
    ],
  },
  {
    category: 'carreira',
    title: 'Da júnior à sênior: o que realmente muda',
    excerpt:
      'Senioridade não é sobre saber mais sintaxe. É sobre autonomia, impacto e julgamento — veja o que separa os níveis de verdade.',
    body: [
      p(
        'Existe um mito de que virar sênior é uma questão de acumular anos ou decorar mais tecnologias. Na prática, a diferença entre níveis tem muito pouco a ver com quantidade de conhecimento técnico — e muito a ver com ',
        b('autonomia, julgamento e impacto'),
        '.',
      ),
      h2('Júnior: aprender a executar'),
      p(
        'No começo, o trabalho é entregar tarefas bem definidas com apoio. Espera-se que você faça perguntas, cometa erros e aprenda com eles. O foco é técnico: entender o código-base, as ferramentas e como transformar uma tarefa clara em código que funciona.',
      ),
      p('O que mais acelera nessa fase:'),
      ul(
        ['Fazer perguntas cedo, em vez de travar por horas em silêncio.'],
        ['Ler código dos outros — é onde se aprende como o sistema realmente funciona.'],
        ['Levar o feedback de code review a sério, sem levar para o pessoal.'],
      ),
      h2('Pleno: executar com autonomia'),
      p(
        'A pessoa de nível pleno recebe um problema, não uma solução. Ela quebra o problema em partes, identifica riscos e entrega sem precisar de supervisão constante. A pergunta deixa de ser "como faço isso?" e passa a ser "essa é a coisa certa a fazer?".',
      ),
      quote(
        'A transição de júnior para pleno acontece quando você para de precisar que alguém transforme problemas em tarefas — você mesmo faz isso.',
      ),
      h2('Sênior: multiplicar impacto'),
      p(
        'A grande virada da senioridade é que seu impacto deixa de ser medido pelo que ',
        i('você'),
        ' entrega e passa a incluir o que você ',
        i('permite que os outros'),
        ' entreguem. Isso se manifesta de várias formas:',
      ),
      ul(
        [b('Julgamento técnico.'), ' Saber quando escolher a solução simples e "chata" em vez da elegante e arriscada.'],
        [b('Comunicação.'), ' Explicar decisões técnicas para quem não é técnico e alinhar pessoas em torno de um plano.'],
        [b('Mentoria.'), ' Elevar o time — uma boa revisão de código ensina, não só aponta erros.'],
        [b('Visão de sistema.'), ' Enxergar como uma mudança afeta o produto, o prazo e a manutenção futura, não só o arquivo aberto.'],
      ),
      h2('O que não muda de nível'),
      p(
        'Curiosidade e humildade acompanham todos os níveis. As pessoas sênior mais respeitadas continuam dizendo "não sei" com naturalidade — a diferença é que sabem exatamente como descobrir. Senioridade não é ter todas as respostas; é saber fazer as perguntas certas e assumir a responsabilidade pelo resultado.',
      ),
      h2('Como acelerar a transição'),
      ol(
        ['Assuma problemas maiores do que você acha que consegue — é onde o crescimento mora.'],
        ['Escreva e comunique: documentos, propostas e explicações treinam o músculo mais escasso na área.'],
        ['Pense no impacto, não na tarefa: pergunte sempre qual problema de negócio aquilo resolve.'],
      ),
      p(
        'No fim, os títulos variam de empresa para empresa, mas a trajetória é consistente: de executar tarefas, para resolver problemas, para multiplicar o impacto de um time inteiro. Foque nisso, e os títulos vêm atrás.',
      ),
    ],
  },
];

// ── Inserção ─────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function uniqueSlug(base: string): Promise<string | null> {
  const existing = await prisma.post.findUnique({ where: { slug: base } });
  return existing ? null : base; // null = já existe, pula (idempotência por título)
}

async function main() {
  const author = await prisma.profile.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!author) {
    console.error('Nenhum admin encontrado. Rode o seed principal primeiro.');
    process.exit(1);
  }

  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  let created = 0;
  let skipped = 0;
  // Espaça as datas de publicação para uma ordenação natural na home.
  let offsetHours = 0;

  for (const art of articles) {
    const categoryId = catBySlug.get(art.category);
    if (!categoryId) {
      console.warn(`categoria '${art.category}' não existe — pulando "${art.title}"`);
      continue;
    }

    const slug = await uniqueSlug(slugify(art.title));
    if (!slug) {
      console.log(`• já existe: "${art.title}"`);
      skipped++;
      continue;
    }

    const html = sanitizePostHtml(toHtml(art.body));
    const json = toJson(art.body);
    const publishedAt = new Date(Date.now() - offsetHours * 3600_000);
    offsetHours += 8;

    await prisma.post.create({
      data: {
        authorId: author.id,
        title: art.title,
        slug,
        excerpt: art.excerpt,
        contentJson: json as unknown as Prisma.InputJsonValue,
        contentHtml: html,
        categoryId,
        readingTimeMin: readingTimeMin(html),
        status: PostStatus.PUBLISHED,
        publishedAt,
      },
    });
    console.log(`✓ criado: [${art.category}] "${art.title}" (${readingTimeMin(html)} min)`);
    created++;
  }

  console.log(`\nConcluído: ${created} criado(s), ${skipped} pulado(s).`);
  await prisma.$disconnect();
}

void main();

function obterTexto(items) {
  return items.map(item => {
    const j = item.json || {};

    if (typeof j.text === 'string') return j.text;
    if (typeof j.data === 'string') return j.data;
    if (typeof j.content === 'string') return j.content;
    if (typeof j.body === 'string') return j.body;
    if (typeof j.output === 'string') return j.output;

    return JSON.stringify(j);
  }).join('\n\n');
}

function limparTexto(texto) {
  return String(texto || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([A-Za-zÀ-ÿ])/g, '$1$2')
    .replace(/ENEM20\d{2}/g, '')
    .replace(/–LC\s*•.*?AZUL–/gi, '')
    .replace(/LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS E REDAÇÃO\s*\|\s*1ºDIA\|CADERNO1\|AZUL/gi, '')
    .replace(/CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS\s*\|\s*1ºDIA\|CADERNO1\|AZUL/gi, '')
    .replace(/www\.portalselecao\.ufu\.br/gi, '')
    .replace(/Processo Seletivo UFU\/.*?TIPO\s*\d+/gi, '')
    .replace(/FMRP\d+\s*\|\s*\d+[-–][^\n]*Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/VNSP\d+\s*\|\s*\d+[-–][^\n]*Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/Página\s+\d+\s+de\s+\d+/gi, '')
    .replace(/Página\s+\d+/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cortarAnexosEGabaritos(texto) {
  const minTabela = Math.floor(texto.length * 0.82);
  const cortes = [
    { re: /\nPró-Reitoria de Graduação\s*-\s*UFMS/i, minPos: 0 },
    { re: /\nEDITAL UFMS\/PROGRAD/i, minPos: 0 },
    { re: /\nANEXO I\s*[–-]\s*DO GABARITO/i, minPos: 0 },
    { re: /\nDO GABARITO DEFINITIVO/i, minPos: 0 },
    { re: /\nGABARITO DEFINITIVO/i, minPos: 0 },
    { re: /\nGABARITO\s+OFICIAL/i, minPos: 0 },
    { re: /\nCLASSIFICA(?:Ç|c)(?:Ã|ã|A)?O\s+PERI(?:Ó|ó|O)DICA/i, minPos: minTabela },
  ];

  let fim = texto.length;

  for (const { re, minPos } of cortes) {
    const m = texto.match(re);
    if (m && m.index >= minPos) fim = Math.min(fim, m.index);
  }

  return texto.slice(0, fim).trim();
}

function normalizarOrdinaisQuebrados(texto) {
  return String(texto || '')
    .replace(/(\d{1,2})\s*\n\s*o\b/gi, '$1º')
    .replace(/(\d{1,2})\s*\n\s*a\b/gi, '$1ª');
}

function removerMarcadoresDecorativos(texto) {
  return texto
    .replace(/^\s*q\s*u\s*e\s*s\s*t\s*[ãa]\s*o\s*$/gim, '')
    .replace(/^\s*questão\s*$/gim, '')
    .replace(/^\s*\d+\s*$/gm, linha => {
      const n = Number(linha.trim());
      if (n > 120) return '';
      return linha;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function obterSecaoAntes(textoAntes) {
  const secoes = [
    'Questões de 01 a 05 (opção inglês)',
    'Questões de 01 a 05 (opção Espanhol)',
    'Linguagens, Códigos e suas Tecnologias',
    'Ciências Humanas e suas Tecnologias',
    'Língua estrangeira moderna – Espanhol',
    'Língua estrangeira moderna - Espanhol',
    'Língua Estrangeira moderna - Inglês',
    'Língua Estrangeira moderna – Inglês',
    'Língua Portuguesa',
    'Matemática e suas Tecnologias',
    'Ciências da Natureza e suas Tecnologias',
    'Ciências Humanas e suas Tecnologias',
    'Biologia',
    'Física',
    'Química',
    'Geografia',
    'História',
    'Filosofia',
    'Sociologia',
    'Literatura',
    'Espanhol',
    'Inglês',
    'Matemática'
  ];

  let achada = null;
  let posicao = -1;
  const base = textoAntes.toLowerCase();

  for (const secao of secoes) {
    const idx = base.lastIndexOf(secao.toLowerCase());
    if (idx > posicao) {
      posicao = idx;
      achada = secao;
    }
  }

  return achada;
}

function encontrarInicioTextoBase(texto) {
  const gatilhos = [
    /Texto para as Questões?\s+de\s+\d+\s+a\s+\d+/i,
    /Texto para as Questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /TEXTO PARA AS QUESTÕES?\s+\d+\s*,?\s*\d*\s*(?:E|e)?\s*\d*/i,
    /Para responder às questões?\s+de\s+\d+\s+a\s+\d+/i,
    /Para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /As questões?\s+\d+\s+e\s+\d+\s+referem-se/i,
    /As questões?\s+\d+\s+a\s+\d+\s+referem-se/i,
    /Leia o texto para responder às questões?\s+de\s+\d+\s+a\s+\d+/i,
    /Leia o texto para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /Leia o excerto para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /Leia o poema .*? para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /Leia o trecho .*? para responder às questões?\s+de\s+\d+\s+a\s+\d+/i,
    /Examine .*? para responder às questões?\s+de\s+\d+\s+a\s+\d+/i,
    /Examine .*? para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i,
    /Read Text .*? to answer questions?\s+\d+\s*(?:and|e|a)\s*\d+/i,
    /Read the text .*? to answer questions?\s+\d+\s*(?:and|e|a)\s*\d+/i,
    /Read the comic .*? to answer questions?\s+\d+\s*(?:and|e|a)\s*\d+/i,
    /Read Text .*? to answer question\s+\d+/i,
    /Read the comic to answer questions?\s+\d+\s*(?:and|e|a)\s*\d+/i,
    /examine o gráfico para responder às questões?\s+de\s+\d+\s+a\s+\d+/i,
    /examine o gráfico para responder às questões?\s+\d+\s*(?:e|a)\s*\d+/i
  ];

  let menor = -1;

  for (const gatilho of gatilhos) {
    const match = texto.match(gatilho);
    if (match && match.index >= 0) {
      if (menor === -1 || match.index < menor) menor = match.index;
    }
  }

  return menor;
}

function separarTextoBaseCompartilhado(bloco) {
  const idx = encontrarInicioTextoBase(bloco);

  if (idx > 0) {
    return {
      blocoQuestao: bloco.slice(0, idx).trim(),
      textoBaseProximo: bloco.slice(idx).trim()
    };
  }

  return {
    blocoQuestao: bloco,
    textoBaseProximo: ''
  };
}

function normalizarAlternativas(bloco) {
  return String(bloco || '')
    .replace(/\s+(\([A-E]\)|[A-E]\)|\[[A-E]\]|[A-E]\.)\s+/g, '\n$1 ')
    .replace(/(?:^|\n)\s*([A-E])\s*\n+/g, '\n$1) ')
    .replace(/(?:^|\n)\s*([A-E])\s{2,}/g, '\n$1) ')
    .trim();
}

function separarAlternativas(bloco) {
  bloco = normalizarAlternativas(bloco);

  const regexAlternativa = /\n?(\(([A-E])\)|([A-E])\)|\[([A-E])\]|([A-E])\.)\s+/g;
  const marcadores = [...bloco.matchAll(regexAlternativa)];

  const alternativas = {};

  if (marcadores.length < 2) {
    return {
      enunciado: bloco.trim(),
      alternativas
    };
  }

  const enunciado = bloco.slice(0, marcadores[0].index).trim();

  for (let i = 0; i < marcadores.length; i++) {
    const letra =
      marcadores[i][2] ||
      marcadores[i][3] ||
      marcadores[i][4] ||
      marcadores[i][5];

    const inicio = marcadores[i].index + marcadores[i][0].length;
    const fim = i + 1 < marcadores.length ? marcadores[i + 1].index : bloco.length;

    alternativas[letra] = bloco
      .slice(inicio, fim)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    enunciado,
    alternativas
  };
}

function retirarTextoBaseDeAlternativas(alternativas) {
  let textoBaseProximo = '';

  for (const letra of Object.keys(alternativas)) {
    const valor = alternativas[letra];
    const idx = encontrarInicioTextoBase(valor);

    if (idx > 0) {
      textoBaseProximo = valor.slice(idx).trim();
      alternativas[letra] = valor.slice(0, idx).trim();
    }
  }

  return {
    alternativas,
    textoBaseProximo
  };
}

function limparFinal(texto) {
  return String(texto || '')
    .replace(/ENEM20\d{2}/g, '')
    .replace(/\s*FMRP\d+\s*\|\s*\d+[-–][^\n]*Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/\s*VNSP\d+\s*\|\s*\d+[-–][^\n]*Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/\s*Confidencial até o momento da aplicação\.?/gi, '')
    .replace(/\s*Processo Seletivo UFU\/.*?TIPO\s*\d+/gi, '')
    .replace(/\s*Página\s+\d+\s+de\s+\d+/gi, '')
    .replace(/\s*Página\s+\d+/gi, '')
    .replace(/\s*q\s*u\s*e\s*s\s*t\s*[ãa]\s*o\s*$/gi, '')
    .replace(/\s+QUESTÃO\s*$/gi, '')
    .replace(/\s+Quest(?:ão|ao)\s+\d{1,3}\s*\.?\s*$/gi, '')
    .replace(/\s+Read (?:Text|the)[^.]*to answer questions?\s+\d+[^.]*\.?\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function linhaPareceInicioEnunciado(linha) {
  const t = String(linha || '').trim();
  if (!t || t.length < 10) return false;
  if (/^[A-Z]{1,2}[+\-]?\d*$/.test(t)) return false;
  if (/^I{1,4}\d+/.test(t)) return false;
  if (/^[A-Z0-9+\-–]{2,12}$/.test(t) && !/[a-zà-ÿ]{3,}/i.test(t)) return false;
  if (/^\d+\s+[a-zà-ÿ]{3,}/.test(t)) return false;
  if (/^(?:Para responder|Leia o|Read Text|Read the|Analise o|examine o|When Tinder)/i.test(t)) {
    return false;
  }
  if (/^["'""«(\[]/.test(t)) return t.length >= 12;
  return /^(?:[A-ZÀ-ÿ"([]|O |A |No |Na |Depreende|Consid|Analis|Examin|The |In |When |Pelo )/.test(t);
}

function contextoPermiteNumeroQuestao(texto, indexMatch, numStr) {
  const num = Number(numStr);
  if (num < 1 || num > 120) return false;
  const depois = texto.slice(indexMatch);
  const m = depois.match(/^\d{1,2}\s*\n([^\n]+)/);
  if (!m) return false;
  const linha = m[1].trim();
  if (/^[ªº°oa]\b/i.test(linha)) return false;
  return linhaPareceInicioEnunciado(linha);
}

function marcadorDentroDeAlternativa(texto, index) {
  const antes = texto.slice(Math.max(0, index - 500), index);
  const alts = [...antes.matchAll(/\(([A-E])\)/g)];
  if (!alts.length) return false;
  const ultima = alts[alts.length - 1];
  const trecho = antes.slice(ultima.index + ultima[0].length);
  return !/(?:^|\n)\s*Quest(?:ão|ao)\s+\d/i.test(trecho);
}

function marcadorOrdinalReferencia(texto, index, raw) {
  const depois = texto.slice(index, index + 80);
  if (/^\d{1,2}\s*\n\s*[ªº°]/i.test(depois)) return true;
  if (/^\d{1,2}[ªº°]/i.test(String(raw || '').trim())) return true;
  const ctx = texto.slice(Math.max(0, index - 8), index + 12);
  return /\d{1,2}[ªº°]\s/i.test(ctx);
}

function extrairMarcadores(texto) {
  texto = removerMarcadoresDecorativos(texto);

  const regex = /(?:^|\n)\s*(?:q\s*u\s*e\s*s\s*t\s*[ãa]\s*o\s*(\d{1,3})|QUESTÃO\s+(\d{1,3})|Quest(?:ão|ao)\s+(\d{1,3})|Q(?:uestão)?\.?\s*(\d{1,3})\b|(\d{2})\s*[-–]\s+)/gi;

  const marcadores = [...texto.matchAll(regex)]
    .map(m => ({
      numero: Number(m[1] || m[2] || m[3] || m[4] || m[5]),
      index: m.index,
      fimCabecalho: m.index + m[0].length,
      raw: m[0].trim()
    }))
    .filter(m => Number.isFinite(m.numero) && m.numero >= 1 && m.numero <= 120);

  const reSolo = /(?:^|\n)(\d{1,2})\s*\n/g;
  let m;
  while ((m = reSolo.exec(texto)) !== null) {
    const inicio = m.index + (m[0].startsWith('\n') ? 1 : 0);
    if (!contextoPermiteNumeroQuestao(texto, inicio, m[1])) continue;
    const jaTem = marcadores.some(
      x => Math.abs(x.index - inicio) < 5 && x.numero === Number(m[1])
    );
    if (jaTem) continue;
    marcadores.push({
      numero: Number(m[1]),
      index: inicio,
      fimCabecalho: m.index + m[0].length,
      raw: m[1]
    });
  }

  marcadores.sort((a, b) => a.index - b.index);

  return filtrarMarcadoresEspurios(texto, marcadores);
}

function filtrarMarcadoresEspurios(texto, marcadores) {
  return marcadores.filter((m, i) => {
    const prox = marcadores[i + 1];
    const fim = prox ? prox.index : texto.length;
    const bloco = texto.slice(m.fimCabecalho, fim).trim();

    if (bloco.length < 20) return false;
    if (/^Quest(?:ão|ao)\s+\d+\s*$/i.test(bloco)) return false;

    const soLixo =
      /^[A-Z0-9+\-–—\s]{1,40}$/.test(bloco.replace(/\n/g, ' ')) &&
      !/\([A-E]\)/.test(bloco);
    if (soLixo) return false;

    return true;
  });
}

function blocoPareceTextoBase(bloco) {
  const t = String(bloco || '').trim();
  return /^(?:Para responder(?:\s+às|\s+a)\s+quest(?:ões|oes)|Leia o (?:texto|trecho|poema)|Read (?:Text|the)|Analise o gr[aá]fico|examine o gr[aá]fico|When Tinder)/i.test(t);
}

function blocoPareceQuestao(bloco) {
  const b = limparFinal(bloco);
  if (b.length < 20) return false;

  const normalizado = normalizarAlternativas(b);

  const temAlternativa =
    /(?:^|\s)(\([A-E]\)|[A-E]\)|\[[A-E]\]|[A-E]\.)\s+/.test(normalizado);

  const temPerguntaOuComando =
    /\?|assinale|indique|considere|according|based on|de acordo|é correto|correta|correto|alternativa|preench|complete|responda|answer|considerando|com base|no texto|o texto|a partir|será o|ser[aá] o|é igual a|equivale/i.test(b);

  return temAlternativa || temPerguntaOuComando;
}

function detectarIdiomaOuOpcao(secao, numero, textoAntes) {
  const base = textoAntes.toLowerCase();

  const idxIng = base.lastIndexOf('questões de 01 a 05 (opção inglês)');
  const idxEsp = base.lastIndexOf('questões de 01 a 05 (opção espanhol)');

  if (numero >= 1 && numero <= 5) {
    if (idxIng > idxEsp) return 'ingles';
    if (idxEsp > idxIng) return 'espanhol';
  }

  if (secao && /ingl[eê]s/i.test(secao)) return 'ingles';
  if (secao && /espanhol/i.test(secao)) return 'espanhol';

  return null;
}

function reordenarSeNumeracaoUnica(questoes) {
  const numeros = questoes.map(q => q.numero);
  const unicos = new Set(numeros);

  if (unicos.size === numeros.length) {
    return questoes
      .sort((a, b) => a.numero - b.numero)
      .map((q, idx) => ({
        ...q,
        indice_global: idx + 1
      }));
  }

  return questoes.map((q, idx) => ({
    ...q,
    indice_global: idx + 1
  }));
}

function criarBlocoAuditoria(marcador, bloco, texto, textoBasePendente) {
  const textoAntes = texto.slice(0, marcador.index);
  const secao = obterSecaoAntes(textoAntes);

  return {
    indice_global: null,
    numero: marcador.numero,
    marcador_original: marcador.raw,
    secao,
    opcao_lingua_estrangeira: detectarIdiomaOuOpcao(secao, marcador.numero, textoAntes),
    enunciado: limparFinal(bloco),
    alternativas: {},
    quantidade_alternativas: 0,
    texto_base_anterior: textoBasePendente || null,
    valido: false,
    alerta: 'Bloco detectado, mas não parece questão completa. Mantido para auditoria.'
  };
}

function consolidarSaida(questoes) {
  const saida = [];

  for (const q of questoes) {
    if (!q.valido) {
      if (blocoPareceTextoBase(q.enunciado)) continue;
      const duplicataValida = questoes.some(x => x.valido && x.numero === q.numero);
      if (duplicataValida) continue;
      if (q.enunciado.length < 25) continue;
    }
    saida.push(q);
  }

  return saida;
}

function normalizarOrdinaisDeQuestaoEmTextoCompartilhado(texto) {
  return String(texto || '').replace(
    /(?:^|\n)(\d{1,2})[ªº°]\s+(?=(?:excerto|tipo|frase|figura|gr[aá]fico|charge|[áa]rea|heredograma|Observa|[Dd]epreende|[Cc]onsidere|[Ee]m\s+\d{4}|[Uu]m\s+cladograma|[Aa]nalise|[Mm]ercado|[Pp]elo\s menos))/gm,
    '\nQuestão $1\n'
  );
}

function extrairQuestoes(texto) {
  texto = cortarAnexosEGabaritos(limparTexto(texto));
  texto = normalizarOrdinaisQuebrados(texto);
  texto = normalizarOrdinaisDeQuestaoEmTextoCompartilhado(texto);
  texto = removerMarcadoresDecorativos(texto);

  const marcadores = extrairMarcadores(texto);
  const questoes = [];

  let textoBasePendente = '';

  for (let i = 0; i < marcadores.length; i++) {
    const marcador = marcadores[i];
    const proximo = marcadores[i + 1];

    const inicio = marcador.fimCabecalho;
    const fim = proximo ? proximo.index : texto.length;

    let bloco = texto.slice(inicio, fim).trim();

    bloco = bloco
      .split(/\nPROPOSTA DE REDAÇÃO\b/i)[0]
      .split(/\nREDAÇÃO\b/i)[0]
      .split(/\nORIENTAÇÃO GERAL\b/i)[0]
      .split(/\nREDAÇÃO – FOLHA DE RASCUNHO\b/i)[0]
      .trim();

    if (!bloco) continue;

    if (blocoPareceTextoBase(bloco)) {
      textoBasePendente = bloco.trim();
      continue;
    }

    if (!blocoPareceQuestao(bloco)) {
      questoes.push(criarBlocoAuditoria(marcador, bloco, texto, textoBasePendente));
      continue;
    }

    const separadoAntes = separarTextoBaseCompartilhado(bloco);
    bloco = separadoAntes.blocoQuestao;

    const resultado = separarAlternativas(bloco);
    const alternativasProcessadas = retirarTextoBaseDeAlternativas(resultado.alternativas);

    const alternativasLimpas = {};
    for (const letra of Object.keys(alternativasProcessadas.alternativas)) {
      const valorLimpo = limparFinal(alternativasProcessadas.alternativas[letra]);
      if (valorLimpo) alternativasLimpas[letra] = valorLimpo;
    }

    const textoBaseDetectado =
      separadoAntes.textoBaseProximo ||
      alternativasProcessadas.textoBaseProximo ||
      '';

    const textoAntes = texto.slice(0, marcador.index);
    const secao = obterSecaoAntes(textoAntes);

    questoes.push({
      indice_global: questoes.length + 1,
      numero: marcador.numero,
      marcador_original: marcador.raw,
      secao,
      opcao_lingua_estrangeira: detectarIdiomaOuOpcao(secao, marcador.numero, textoAntes),
      enunciado: limparFinal(
        resultado.enunciado
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      ),
      alternativas: alternativasLimpas,
      quantidade_alternativas: Object.keys(alternativasLimpas).length,
      texto_base_anterior: textoBasePendente || null,
      valido: Object.keys(alternativasLimpas).length >= 4
    });

    textoBasePendente = textoBaseDetectado;
  }

  return consolidarSaida(reordenarSeNumeracaoUnica(questoes));
}

function detectarTotalQuestoesEsperado(texto) {
  const patterns = [
    /(\d{1,3})\s*quest(?:ões|oes)\s*objetivas/i,
    /(\d{1,3})\s*quest(?:ões|oes)\s*(?:de\s+m[úu]ltipla|objetivas)?/i,
    /prova\s+(?:com\s+)?(\d{1,3})\s*quest/i,
    /total\s+(?:de\s+)?(\d{1,3})\s*quest/i,
    /(?:s[ãa]o|ser[aã]o)\s+(\d{1,3})\s*quest(?:ões|oes)/i,
  ];

  for (const p of patterns) {
    const m = String(texto || '').match(p);
    if (m) {
      const n = Number(m[1]);
      if (n >= 20 && n <= 200) return n;
    }
  }

  return null;
}

function textoAindaFragmentado(texto) {
  return (
    /FAC\s*\n\s*UL|FACUL\s*\n\s*DAD|E\s*\n\s*D\s*\n|ME\s*\n\s*DIC/i.test(texto) ||
    /FACULDAD\s*\n\s*E\s*\n\s*D/i.test(texto)
  );
}

function precisaSanitizacaoPorCobertura(texto, questoes) {
  const validas = questoes.filter(q => q.valido);
  const unicos = new Set(validas.map(q => q.numero));
  const esperado = detectarTotalQuestoesEsperado(texto);

  if (textoAindaFragmentado(texto)) return true;

  if (validas.length >= 10 && unicos.size < validas.length * 0.92) return true;

  if (esperado && unicos.size < Math.floor(esperado * 0.85)) return true;

  const maxNum = validas.length ? Math.max(...validas.map(q => q.numero)) : 0;
  if (maxNum >= 40 && unicos.size < Math.floor(maxNum * 0.85)) return true;

  if (maxNum >= 20) {
    let faltando = 0;
    for (let n = 1; n <= maxNum; n++) {
      if (!unicos.has(n)) faltando++;
    }
    const limiteFaltas = esperado
      ? Math.max(3, Math.floor((esperado || maxNum) * 0.12))
      : Math.floor(maxNum * 0.12);
    if (faltando > limiteFaltas) return true;
  }

  const ordinaisNoEnunciado = validas.filter(q =>
    /^\d{1,2}[ªº°]\s/.test(String(q.enunciado || '').trim())
  ).length;
  if (ordinaisNoEnunciado >= 3) return true;

  return false;
}

const entrada = $input.first().json || {};
const jaSanitizado = entrada.sanitizado === true;

const textoOriginal = obterTexto($input.all());
const questoes = extrairQuestoes(textoOriginal);
const totalValidas = questoes.filter(q => q.valido).length;
const numerosUnicosValidos = new Set(questoes.filter(q => q.valido).map(q => q.numero)).size;
const totalEsperado = detectarTotalQuestoesEsperado(textoOriginal);

if (questoes.length === 0) {
  return [{
    json: {
      erro: true,
      tipo_erro: 'SEM_QUESTOES_EXTRAIDAS',
      precisa_sanitizacao: true,
      total_questoes: 0,
      total_validas: 0,
      mensagem: 'Nenhuma questão extraída. Encaminhar para o sanitizador antes de tentar novamente.',
      texto_original: textoOriginal
    }
  }];
}

if (totalValidas === 0) {
  return [{
    json: {
      erro: true,
      tipo_erro: 'SEM_QUESTOES_VALIDAS',
      precisa_sanitizacao: true,
      total_questoes: questoes.length,
      total_validas: 0,
      mensagem: 'Questões foram detectadas, mas nenhuma parece válida. Encaminhar para sanitização.',
      questoes_detectadas: questoes,
      texto_original: textoOriginal
    }
  }];
}

if (!jaSanitizado && precisaSanitizacaoPorCobertura(textoOriginal, questoes)) {
  return [{
    json: {
      erro: true,
      tipo_erro: 'COBERTURA_INCOMPLETA',
      precisa_sanitizacao: true,
      total_questoes: questoes.length,
      total_validas: totalValidas,
      numeros_unicos_validos: numerosUnicosValidos,
      total_esperado: totalEsperado,
      mensagem: 'Extração parcial detectada na 1ª passagem. Encaminhar para sanitização e nova extração.',
      texto_original: textoOriginal
    }
  }];
}

return questoes.map(q => ({
  json: {
    ...q,
    erro: false,
    precisa_sanitizacao: false
  }
}));
// Cole no nó "Sanitizar Texto" (Code) do workflow PDF's — n8n
const item = $input.first().json;
const bruto =
  item.texto_original ??
  item.text ??
  item.data ??
  '';

function ehNumeroQuestao(t) {
  return /^\d{1,3}$/.test(t) && Number(t) >= 1 && Number(t) <= 120;
}

function ehInicioAlternativa(t) {
  return /^[([]?\s*[A-E]\s*[)\].]/i.test(t);
}

function ehMarcadorBanca(t) {
  return /^\d{2,3}\s*[-–.]/.test(t) || /^\d{2,3}-[A-Za-zÀ-ÿ]/.test(t);
}

function ehFragmentoPdf(t) {
  t = String(t || '').trim();
  if (!t) return false;
  if (ehNumeroQuestao(t)) return false;
  if (ehInicioAlternativa(t)) return false;
  if (ehMarcadorBanca(t)) return false;
  if (/^qu\s*e\s*s\s*t\s*[ãa]\s*o\s*$/i.test(t.replace(/\s+/g, ''))) return false;
  if (t.length > 14) return false;
  if (/[.!?]./.test(t)) return false;
  if (/[,;:].+/.test(t) && t.length > 10) return false;
  if (!/^[\p{L}\p{N}\s.\-º°%'"]+$/u.test(t)) return false;
  return true;
}

function smartJoin(acc, frag) {
  const partes = String(frag).trim().split(/\s+/).filter(Boolean);
  let out = acc;

  for (const p of partes) {
    if (!out) {
      out = p;
      continue;
    }

    if (p.length === 1 && /^[Dd]$/.test(p) && /[Ee]$/.test(out)) {
      out = out + ' D';
      continue;
    }
    if (p.length === 1 && /^[Ee]$/.test(p) && /\sD$/.test(out)) {
      out = out + 'E';
      continue;
    }

    const ult = out.slice(-1);
    const colar =
      p.length <= 3 &&
      /[A-Za-zÀ-ÿ0-9]/.test(ult) &&
      /[A-Za-zÀ-ÿ0-9]/.test(p[0]) &&
      !/^[AEIOU]$/i.test(p) &&
      !/\s$/.test(out);

    out = colar ? out + p : out + ' ' + p;
  }

  return out;
}

function reunirFragmentos(texto) {
  const linhas = String(texto || '').replace(/\r/g, '\n').split('\n');
  const out = [];
  let buf = '';

  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = '';
    }
  };

  for (const linha of linhas) {
    const t = linha.trim();
    if (!t) {
      flush();
      out.push('');
      continue;
    }
    if (ehFragmentoPdf(t)) {
      buf = smartJoin(buf, t);
    } else {
      flush();
      out.push(linha);
    }
  }

  flush();
  return out.join('\n');
}

function normalizarOrdinaisQuebrados(texto) {
  return String(texto || '')
    .replace(/(\d{1,2})\s*\n\s*o\b/gi, '$1º')
    .replace(/(\d{1,2})\s*\n\s*a\b/gi, '$1ª');
}

function linhaPareceInicioEnunciado(linha) {
  const t = String(linha || '').trim();
  if (!t || t.length < 10) return false;

  // Fragmento químico / símbolo isolado (H, O, N, C, Rh+, etc.)
  if (/^[A-Z]{1,2}[+\-]?\d*$/.test(t)) return false;
  if (/^[IVXLC]+[-–]\d+$/.test(t)) return false;
  if (/^I{1,4}\d+/.test(t)) return false;
  if (/^[A-Z0-9+\-–]{2,12}$/.test(t) && !/[a-zà-ÿ]{3,}/i.test(t)) return false;

  // Nota de rodapé: "1 estrugir", "2 ridicularia"
  if (/^\d+\s+[a-zà-ÿ]{3,}/.test(t)) return false;

  // Cabeçalho de texto-base compartilhado (não é enunciado)
  if (/^(?:Para responder|Leia o|Read Text|Read the|Analise o|examine o|Observe o|When Tinder|Leia o texto)/i.test(t)) {
    return false;
  }

  // Trecho citado (ex.: Q9 FAMEP — "a realidade é que...")
  if (/^["'""«(\[]/.test(t)) return t.length >= 12;

  return /^(?:[A-ZÀ-ÿ"([]|O |A |Os |As |No |Na |Nos |Nas |De |Do |Da |Em |Um |Uma |Se |Com |Em |Depreende|Consid|Analis|Examin|Original|According|The |In |When |Pelo )/.test(t);
}

function contextoPermiteMarcadorQuestao(texto, indexMatch, numStr) {
  const num = Number(numStr);
  if (num < 1 || num > 80) return false;

  const antes = texto.slice(Math.max(0, indexMatch - 250), indexMatch);
  const depois = texto.slice(indexMatch);

  const m = depois.match(/^\d{1,2}\s*\n([^\n]+)/);
  if (!m) return false;

  const linhaSeguinte = m[1].trim();
  if (!linhaPareceInicioEnunciado(linhaSeguinte)) return false;
  if (/^[ªº°oa]\b/i.test(linhaSeguinte)) return false;

  // Número de página antes de cabeçalho FMRP
  if (/^\d{1,2}\s*\n\s*FMRP/i.test(depois)) return false;

  // Dentro de fórmula química: "(C " ou "C " no fim do contexto anterior
  if (/\(\s*[A-Z]?\s*$/.test(antes.trim())) return false;

  // Referência cruzada "questões de NN a NN" no contexto imediato
  if (/quest(?:ões|oes)\s+de\s+\d+\s+a\s+\d+/i.test(antes.slice(-120) + linhaSeguinte)) {
    return false;
  }

  return true;
}

function normalizarMarcadoresQuestao(texto) {
  texto = String(texto || '')
    .replace(
      /q\s*u\s*e\s*s\s*t\s*[ãaá]\s*o\s*\n+\s*(\d{1,3})/gi,
      '\nQuestão $1\n'
    );

  let out = '';
  const re = /(?:^|\n)(\d{1,2})\s*\n/g;
  let last = 0;
  let m;

  while ((m = re.exec(texto)) !== null) {
    const inicio = m.index + (m[0].startsWith('\n') ? 1 : 0);
    out += texto.slice(last, inicio);

    if (contextoPermiteMarcadorQuestao(texto, inicio, m[1])) {
      out += `\nQuestão ${Number(m[1])}\n`;
    } else {
      out += m[0];
    }

    last = m.index + m[0].length;
  }

  out += texto.slice(last);

  return out
    .replace(/(?:^|\n)\s*q\s*u\s*e\s*s\s*t\s*[ãa]\s*o\s*(?=\n)/gim, '\n');
}

function normalizarAlternativasQuebradas(texto) {
  return String(texto || '')
    .replace(/\n\(([A-E])\)\s*\n(?!\()/g, '\n($1) ')
    .replace(/(?:^|\n)([A-E])\)\s+(?=[A-Za-zÀ-ÿ("(])/g, '\n($1) ');
}

function normalizarOrdinaisDeQuestaoEmTextoCompartilhado(texto) {
  return String(texto || '').replace(
    /(?:^|\n)(\d{1,2})[ªº°]\s+(?=(?:excerto|tipo|frase|figura|gr[aá]fico|charge|[áa]rea|heredograma|Observa|[Dd]epreende|[Cc]onsidere|[Ee]m\s+\d{4}|[Uu]m\s+cladograma|[Aa]nalise|[Mm]ercado|[Pp]elo\s menos))/gm,
    '\nQuestão $1\n'
  );
}

function cortarLixoFinal(texto) {
  // "Classificação Periódica" aparece nas instruções da capa — só cortar no final do PDF
  const minTabela = Math.floor(texto.length * 0.82);
  const cortes = [
    { re: /\nGABARITO\s+OFICIAL/i, minPos: 0 },
    { re: /\nDO\s+GABARITO/i, minPos: 0 },
    { re: /\nCLASSIFICA(?:Ç|c)(?:Ã|ã|A)?O\s+PERI(?:Ó|ó|O)DICA/i, minPos: minTabela },
    { re: /\nTabela\s+Peri(?:ó|o)dica/i, minPos: minTabela },
  ];

  let fim = texto.length;
  for (const { re, minPos } of cortes) {
    const m = texto.match(re);
    if (m && m.index >= minPos) fim = Math.min(fim, m.index);
  }

  return texto.slice(0, fim).trim();
}

function limparCabecalhosRepetidos(texto) {
  return texto
    .replace(/(?:^|\n)\d{2,3}[-–.]?[Cc]onhec\w*\s*/gi, '\n')
    .replace(/(?:^|\n)FMRP\d+\s*\|\s*\d{2,3}[-–][^\n]*/gi, '\n')
    .replace(/(?:^|\n)VNSP\d+\s*\|\s*\d{2,3}[-–][^\n]*/gi, '\n')
    .replace(/Confidencial[^\n]*/gi, '')
    .replace(/P[aá]gina\s+\d+(\s+de\s+\d+)?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizarTextoExtraido(texto) {
  let t = String(texto || '');
  t = t.replace(/\u00a0/g, ' ');
  t = t.replace(/([A-Za-zÀ-ÿ])-\s*\n\s*([A-Za-zÀ-ÿ])/g, '$1$2');
  t = reunirFragmentos(t);
  t = normalizarOrdinaisQuebrados(t);
  t = normalizarOrdinaisDeQuestaoEmTextoCompartilhado(t);
  t = normalizarMarcadoresQuestao(t);
  t = normalizarAlternativasQuebradas(t);
  t = limparCabecalhosRepetidos(t);
  t = cortarLixoFinal(t);
  t = t.replace(/[^\S\n]+/g, ' ');
  return t.trim();
}

const text = sanitizarTextoExtraido(bruto);

return [{
  json: {
    text,
    sanitizado: true,
    chars_antes: bruto.length,
    chars_depois: text.length,
  },
}];

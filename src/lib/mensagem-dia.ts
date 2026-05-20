/** Mensagem bíblica motivacional — muda a cada dia (UTC). */

export interface MensagemDia {
  texto: string;
  referencia: string;
}

const MENSAGENS: MensagemDia[] = [
  {
    texto: "Tudo posso naquele que me fortalece.",
    referencia: "Filipenses 4:13",
  },
  {
    texto: "Porque eu bem sei os planos que tenho para vocês — planos de prosperá-los e não de fazê-los mal, para dar-lhes esperança e um futuro.",
    referencia: "Jeremias 29:11",
  },
  {
    texto: "O Senhor é a minha luz e a minha salvação; de quem terei medo?",
    referencia: "Salmos 27:1",
  },
  {
    texto: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento.",
    referencia: "Provérbios 3:5",
  },
  {
    texto: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.",
    referencia: "Isaías 41:10",
  },
  {
    texto: "Entregue o seu caminho ao Senhor; confie nele, e ele agirá.",
    referencia: "Salmos 37:5",
  },
  {
    texto: "A paz deixo convosco; a minha paz vos dou. Não vo-la dou como o mundo a dá.",
    referencia: "João 14:27",
  },
  {
    texto: "Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei.",
    referencia: "Mateus 11:28",
  },
  {
    texto: "O choro pode durar uma noite, mas a alegria vem pela manhã.",
    referencia: "Salmos 30:5",
  },
  {
    texto: "Se Deus é por nós, quem será contra nós?",
    referencia: "Romanos 8:31",
  },
  {
    texto: "Lança sobre o Senhor o teu cuidado, e ele te susterá.",
    referencia: "Salmos 55:22",
  },
  {
    texto: "Aquietai-vos e sabei que eu sou Deus.",
    referencia: "Salmos 46:10",
  },
  {
    texto: "O amor nunca falha.",
    referencia: "1 Coríntios 13:8",
  },
  {
    texto: "Buscai primeiro o Reino de Deus, e todas estas coisas vos serão acrescentadas.",
    referencia: "Mateus 6:33",
  },
  {
    texto: "Deus não nos deu espírito de covardia, mas de poder, de amor e de equilíbrio.",
    referencia: "2 Timóteo 1:7",
  },
  {
    texto: "Ainda que eu ande pelo vale da sombra da morte, não temerei mal algum, porque tu estás comigo.",
    referencia: "Salmos 23:4",
  },
  {
    texto: "Eis que faço novas todas as coisas.",
    referencia: "Apocalipse 21:5",
  },
  {
    texto: "Com Deus faremos proezas; ele pisará os nossos adversários.",
    referencia: "Salmos 108:13",
  },
  {
    texto: "O Senhor é bom, um refúgio em tempos de angústia. Ele protege os que nele confiam.",
    referencia: "Naum 1:7",
  },
  {
    texto: "Não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente.",
    referencia: "Romanos 12:2",
  },
  {
    texto: "A tua palavra é lâmpada para os meus pés e luz para o meu caminho.",
    referencia: "Salmos 119:105",
  },
  {
    texto: "Posso todas as coisas naquele que me fortalece.",
    referencia: "Filipenses 4:13",
  },
  {
    texto: "O Senhor lutará por vocês; tão somente mantenham-se tranquilos.",
    referencia: "Êxodo 14:14",
  },
  {
    texto: "Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos!",
    referencia: "Filipenses 4:4",
  },
  {
    texto: "Porque para Deus nada é impossível.",
    referencia: "Lucas 1:37",
  },
  {
    texto: "O coração do homem pode fazer planos, mas a resposta certa vem do Senhor.",
    referencia: "Provérbios 16:1",
  },
  {
    texto: "Sede fortes e corajosos. Não temais, nem vos atemorizeis.",
    referencia: "Deuteronômio 31:6",
  },
  {
    texto: "Em paz me deito e logo pego em sono, porque só tu, Senhor, me fazes repousar seguro.",
    referencia: "Salmos 4:8",
  },
  {
    texto: "O fruto do Espírito é amor, alegria, paz, paciência, bondade, fidelidade.",
    referencia: "Gálatas 5:22",
  },
  {
    texto: "Não se turbe o vosso coração; credes em Deus, crede também em mim.",
    referencia: "João 14:1",
  },
  {
    texto: "Cada dia tem bastante a sua própria preocupação — confie um passo de cada vez.",
    referencia: "Mateus 6:34",
  },
];

/** Índice estável pelo dia (muda à meia-noite UTC). */
function indiceDoDia(date = new Date()): number {
  const inicio = Date.UTC(date.getUTCFullYear(), 0, 0);
  const hoje = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const diaDoAno = Math.floor((hoje - inicio) / 86_400_000);
  return diaDoAno % MENSAGENS.length;
}

export function getMensagemDoDia(date = new Date()): MensagemDia {
  return MENSAGENS[indiceDoDia(date)]!;
}

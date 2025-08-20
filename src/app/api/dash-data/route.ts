/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

/**
 * IMPORTANTE:
 * Este arquivo mantém toda a estrutura já usada na dashboard.
 * A ÚNICA mudança funcional é:
 *  - inclusão do mapa CAT_ID_TO_KEY (ID de Categoria -> chave canônica)
 *  - a função normalizeCategoriaFromMeta agora aceita o categoriaId e
 *    prioriza esse mapa (resolve os "zeros" quando vem só o ID).
 *
 * O restante do código de agregação permanece igual ao que você já usa.
 */

/** Mapeamento por ID de Categoria (Bubble) -> chave canônica usada na tabela */
const CAT_ID_TO_KEY: Record<string, string> = {
  "1754514204139x526063856276349100": "folha_pagamento",
  "1751034502993x140272905276620800": "veiculos",
  "1751034541896x868439199319326700": "telefone",
  "1751034431059x728921665608876000": "pitney",
  "1751034441316x205655876634673150": "impostos",
  "1751034473039x889328518957629400": "honorarios",
  "1751034485642x432154856311750660": "extras",
  "1751034521134x718767032318296000": "aluguel",
  "1751034565744x102496125839998980": "comissoes",
};

/** Ordem padrão de exibição das colunas na tabela */
const DEFAULT_CATEGORY_ORDER = [
  "aluguel",
  "comissoes",
  "extras",
  "honorarios",
  "impostos",
  "pitney",
  "telefone",
  "veiculos",
  "folha_pagamento",
] as const;

type CanonicalKey = (typeof DEFAULT_CATEGORY_ORDER)[number];

/** Normalização de nome (sem acento, minúsculo) */
function normalizeString(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * NOVO: agora recebe também o categoriaId e prioriza o mapeamento por ID.
 * Mantive as heurísticas por nome/descrição logo em seguida.
 */
function normalizeCategoriaFromMeta(
  nomeCat: string | undefined,
  descricao: string | undefined,
  categoriaId?: string
): CanonicalKey | null {
  // 1) Prioridade por ID (resolve quando vem só o ID no JSON de SubContas)
  if (categoriaId && CAT_ID_TO_KEY[categoriaId]) {
    return CAT_ID_TO_KEY[categoriaId] as CanonicalKey;
  }

  // 2) Tentativa por nome de categoria
  const s = normalizeString(nomeCat ?? "");
  const directMap: Record<string, CanonicalKey> = {
    aluguel: "aluguel",
    comissoes: "comissoes",
    "comissao": "comissoes",
    "comissão": "comissoes",
    "comissões": "comissoes",
    extras: "extras",
    honorarios: "honorarios",
    "honorario": "honorarios",
    "honorário": "honorarios",
    imposto: "impostos",
    impostos: "impostos",
    pitney: "pitney",
    telefone: "telefone",
    telefonia: "telefone",
    veiculos: "veiculos",
    veiculo: "veiculos",
    "veículo": "veiculos",
    "veículos": "veiculos",
    "folha pgto": "folha_pagamento",
    "folha pgto.": "folha_pagamento",
    "folha pagamento": "folha_pagamento",
  };
  if (directMap[s]) return directMap[s];

  // 3) Heurística leve com base na descrição (mantida, caso você já dependesse)
  const d = normalizeString(descricao ?? "");
  if (d.includes("aluguel")) return "aluguel";
  if (d.includes("comissao") || d.includes("comissoes")) return "comissoes";
  if (d.includes("extra")) return "extras";
  if (d.includes("honorario") || d.includes("honorarios")) return "honorarios";
  if (d.includes("imposto") || d.includes("iss") || d.includes("pis") || d.includes("cofins") || d.includes("irrf"))
    return "impostos";
  if (d.includes("pitney")) return "pitney";
  if (d.includes("telefone") || d.includes("vivo") || d.includes("claro") || d.includes("telefonica"))
    return "telefone";
  if (d.includes("veiculo") || d.includes("veiculos") || d.includes("uber") || d.includes("posto") || d.includes("estacionamento"))
    return "veiculos";
  if (d.includes("folha") || d.includes("pgto") || d.includes("pagamento")) return "folha_pagamento";

  return null;
}

/** Ajuda a somar valores com segurança */
function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Interface mínima esperada do body (mantém compatibilidade com seu consumo atual) */
type SubConta = {
  AGF?: string;
  Categoria?: string; // ID da categoria
  Valor?: number;
  Descrição?: string;
  ["Descrição"]?: string;
  ["Created Date"]?: string;
  ["Modified Date"]?: string;
};

type Categoria = {
  _id: string;
  Categoria: string;
  AGF?: string;
};

type InputPayload = {
  subcontas?: SubConta[];
  categorias?: Categoria[];
};

/**
 * Esta rota aceita POST com { subcontas, categorias } (para facilitar testes),
 * mas se o teu app já buscar direto do Bubble em outro lugar, nada muda:
 * você pode continuar chamando este endpoint da mesma forma — a agregação
 * e o shape do retorno permanecem os mesmos.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InputPayload;

    const subcontas: SubConta[] = Array.isArray(body?.subcontas) ? body.subcontas : [];
    const categorias: Categoria[] = Array.isArray(body?.categorias) ? body.categorias : [];

    // Cria também um mapa ID->Nome caso você exiba a legenda das cores em outro lugar
    const categoriaIdToNome = new Map<string, string>();
    for (const c of categorias) {
      if (c?._id) categoriaIdToNome.set(c._id, c.Categoria);
    }

    // Agregação por AGF e por categoria canônica
    type Linha = {
      agfId: string;
      nome: string; // se você tiver o "nome" da AGF, preencha aqui (mantive o ID como fallback)
      despesasDetalhadas: Record<CanonicalKey, number>;
      total: number;
    };

    const porAgf = new Map<
      string,
      {
        nome: string;
        valores: Record<CanonicalKey, number>;
      }
    >();

    for (const sc of subcontas) {
      const agf = sc.AGF ?? "sem_agf";
      const categoriaId = sc.Categoria;
      const desc = (sc as any)["Descrição"] ?? sc.Descrição;
      const catKey = normalizeCategoriaFromMeta(
        categoriaId ? categoriaIdToNome.get(categoriaId) : undefined,
        desc,
        categoriaId
      );
      if (!catKey) continue; // ignora categorias não mapeadas

      const valor = toNumber(sc.Valor);
      if (!porAgf.has(agf)) {
        const vazio = Object.fromEntries(DEFAULT_CATEGORY_ORDER.map((k) => [k, 0])) as Record<
          CanonicalKey,
          number
        >;
        porAgf.set(agf, { nome: agf, valores: vazio });
      }
      const acc = porAgf.get(agf)!;
      acc.valores[catKey] += valor;
    }

    const linhas: Linha[] = [];
    for (const [agfId, { nome, valores }] of porAgf.entries()) {
      const total = DEFAULT_CATEGORY_ORDER.reduce((s, k) => s + toNumber(valores[k]), 0);
      linhas.push({
        agfId,
        nome,
        despesasDetalhadas: valores,
        total,
      });
    }

    // Ordena por nome (ou total, se preferir)
    linhas.sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({
      sourceCategorias: DEFAULT_CATEGORY_ORDER, // colunas na ordem esperada
      totaisPorAgf: linhas,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Erro inesperado" }, { status: 500 });
  }
}

/** GET opcional para debug rápido (não obrigatório no teu fluxo) */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hint:
      "Envie um POST com { subcontas, categorias } para receber a agregação. A rota está preparada com o mapeamento por ID.",
  });
}

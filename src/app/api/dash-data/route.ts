import { NextResponse } from 'next/server';

const BASE = process.env.BUBBLE_BASE_URL!;
const KEY  = process.env.BUBBLE_API_KEY!;

function enc(s: string) { return encodeURIComponent(s); }
function constraints(obj: any) { return encodeURIComponent(JSON.stringify(obj)); }

// --- NOVO: normaliza nome de AGF para usar como chave consistente ---
function normAgfName(s: string) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sem acentos (só por segurança)
    .replace(/\s+/g,' ') // colapsa múltiplos espaços
    .trim();
}

const MESES: Record<string, number> = {
  '1':1,'01':1,'jan':1,'janeiro':1,
  '2':2,'02':2,'fev':2,'fevereiro':2,
  '3':3,'03':3,'mar':3,'março':3,'marco':3,
  '4':4,'04':4,'abr':4,'abril':4,
  '5':5,'05':5,'mai':5,'maio':5,
  '6':6,'06':6,'jun':6,'junho':6,
  '7':7,'07':7,'jul':7,'julho':7,
  '8':8,'08':8,'ago':8,'agosto':8,
  '9':9,'09':9,'set':9,'setembro':9,
  '10':10,'out':10,'outubro':10,
  '11':11,'nov':11,'novembro':11,
  '12':12,'dez':12,'dezembro':12,
};

function parseAno(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  const s = (v?.display || v?.name || '').toString();
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function parseMes(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const key = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return MESES[key] ?? Number(v);
  }
  const s = (v?.display || v?.name || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return MESES[s] ?? 0;
}
function parseMesAnoStr(s: any): { mes: number; ano: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*([01]?\d)\s*\/\s*(\d{4})\s*$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  if (mes>=1 && mes<=12 && ano>1900) return { mes, ano };
  return null;
}
function parseValorBR(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.toString()
    .replace(/\s+/g,'')
    .replace(/[R$\u00A0]/g,'')
    .replace(/\./g,'')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Mapa de ID de Categoria (Bubble) -> chave canônica da tabela */
const CAT_ID_TO_KEY: Record<string, string> = {
  // AGF 1751032012715x423593633964884000
  "1754514204139x526063856276349100": "folha_pagamento",
  "1751034502993x140272905276620800": "veiculos",
  "1751034541896x868439199319326700": "telefone",
  "1751034431059x728921665608876000": "pitney",
  "1751034441316x205655876634673150": "impostos",
  "1751034473039x889328518957629400": "honorarios",
  "1751034485642x432154856311750660": "extras",
  "1751034521134x718767032318296000": "aluguel",
  "1751034565744x102496125839998980": "comissoes",

  // AGF 1752096538554x179551120588800000
  "1754070490704x231856758205448200": "aluguel",
  "1754070514400x329889315937845250": "comissoes",
  "1754070456208x252559865169575940": "extras",
  "1754070443985x667206317484277800": "honorarios",
  "1754070430759x682734868761149400": "impostos",
  "1754070420062x128183682507735040": "pitney",
  "1754070502210x652422025222553600": "telefone",
  "1754070474958x145718347264426000": "veiculos",
  "1755707826761x652862801132216600": "folha_pagamento",

  // AGF 1751494194789x272905751163116770
  "1755695251313x921435259610147000": "aluguel",
  "1755695225576x725117049811793400": "comissoes",
  "1755695134198x500541998866248700": "extras",
  "1755695100227x210629430516269020": "honorarios",
  "1755695074934x439006081075832060": "impostos",
  "1755695046174x268899668131042720": "pitney",
  "1755695193899x693528764351259500": "telefone",
  "1755695164261x607361797055734100": "veiculos",
  "1755695521004x217825384616417760": "folha_pagamento",
};

// normaliza categorias das SubContas para chaves fixas do front
function normalizeCategoriaFromMeta(nomeCat: string, descricao: string, categoriaId?: string): string {
  // Prioriza o ID de categoria quando disponível
  if (categoriaId && CAT_ID_TO_KEY[categoriaId]) {
    return CAT_ID_TO_KEY[categoriaId];
  }

  const raw = String(nomeCat || '').trim();
  const s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const direct: Record<string,string> = {
    'aluguel':'aluguel',
    'comissoes':'comissoes','comissão':'comissoes','comissao':'comissoes',
    'extras':'extras',
    'honorarios':'honorarios','honorário':'honorarios','honorario':'honorarios',
    'imposto':'impostos','impostos':'impostos',
    'pitney':'pitney',
    'telefone':'telefone','telefonia':'telefone',
    'veiculos':'veiculos','veículo':'veiculos','veiculo':'veiculos',
    'folha pgto':'folha_pagamento','folha pgto.':'folha_pagamento','folha pagamento':'folha_pagamento',
  };
  if (direct[s]) return direct[s];

  // Heurísticas por nome
  if (s.includes('alug')) return 'aluguel';
  if (s.includes('comis')) return 'comissoes';
  if (s.includes('honor')) return 'honorarios';
  if (s.includes('pitney')) return 'pitney';
  if (s.includes('telef')) return 'telefone';
  if (s.includes('veic')) return 'veiculos';
  if (s.includes('impost') || s === 'pis' || s === 'cofins' || s === 'irrf' || s.includes('iss')) return 'impostos';
  if (s.includes('folha') || s.includes('pgto') || s.includes('pagament')) return 'folha_pagamento';
  if (s.includes('extra')) return 'extras';

  // Heurísticas pela descrição (quando nome vier inesperado)
  const d = (descricao || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (/(pis|cofins|irrf|iss)/.test(d)) return 'impostos';
  if (/(uber|post[oa]|estaciona|motoboy|pedag|sem parar|km|combust)/.test(d)) return 'veiculos';
  if (/(vivo|claro|america\s*net|telefonica|tim|oi|celular|fixo)/.test(d)) return 'telefone';
  if (/(pitney|loca[çc][aã]o|manuten|tinta|material|servic)/.test(d)) return 'pitney';
  if (/(dr|doutor|m[ée]dico|advog|contab)/.test(d)) return 'honorarios';
  if (/(omega|unifisa|ewd|emilio|ghisso|comiss)/.test(d)) return 'comissoes';
  if (/(aluguel|shopping)/.test(d)) return 'aluguel';

  // fallback
  return 'extras';
}

async function bubbleGet<T>(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bubble GET ${path} -> ${res.status} ${body}`);
  }
  return (await res.json()) as { response: { results: T[]; count?: number } };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });

    // 1) AGFs da empresa
    const agfCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const agfsRes = await bubbleGet<{ _id: string; 'Nome da AGF'?: string; nome?: string; name?: string }>(
      `/api/1.1/obj/${enc('AGF')}?limit=200&constraints=${agfCons}`
    );
    const agfs = agfsRes.response.results.map(a => {
      const nomeRaw = (a as any)['Nome da AGF'] || (a as any).nome || (a as any).name || a._id;
      return { id: a._id, nome: normAgfName(nomeRaw) };
    });
    const agfIdToNome = new Map<string, string>(agfs.map(a => [a.id, a.nome]));
    const agfIds = agfs.map(a => a.id);

    // 2) Lançamentos Mensais (fonte oficial)
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGet<{
      _id: string;
      Ano: any;
      Mês: any;
      AGF: string | { _id: string };
      total_receita?: number;
      total_despesa?: number;
      resultado_final?: number;
      Data?: string;
    }>(`/api/1.1/obj/${enc('LançamentoMensal')}?limit=1000&constraints=${lmCons}`);

    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano) || parseAno((lm as any).Data?.split('/')[1]);
      const mes = parseMes((lm as any).Mês) || Number((lm as any).Data?.split('/')[0]);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfId || 'AGF');
      if (lm._id) lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
    }
    const lmIds = Array.from(lmIndex.keys());

    // 3) Categorias (id -> nome)
    const catRes = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string; Descrição?: string; descricao?: string }>(
      `/api/1.1/obj/${enc('Categoria Despesa')}?limit=2000`
    );
    const catIdToNome = new Map<string, string>(
      catRes.response.results.map(c => {
        const nome =
          (c as any).Categoria || (c as any).Nome || (c as any).name || (c as any).nome ||
          (c as any).Descrição || (c as any).descricao || '';
        return [c._id, String(nome)] as const;
      })
    );

    // 4) SubContas (detalhe das despesas por categoria)
    const scCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scRes = await bubbleGet<{
      _id: string;
      AGF: string | { _id: string };
      'LançamentoMesnal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'LançamentoMensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: any;
      Valor: number | string;
      Descrição?: string;
      descricao?: string;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=5000&constraints=${scCons}`);

    // (4b) Buscar categorias faltantes por ID (casos raros)
    const missingCatIds = Array.from(new Set(
      scRes.response.results
        .map(sc => (typeof (sc as any).Categoria === 'string' ? (sc as any).Categoria : null))
        .filter((id): id is string => !!id && !catIdToNome.has(id))
    ));
    for (const cid of missingCatIds) {
      try {
        const single = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string }>(
          `/api/1.1/obj/${enc('Categoria Despesa')}/${enc(cid)}`
        );
        const item = single.response.results?.[0] as any;
        const nome = item?.Categoria || item?.Nome || item?.name || item?.nome || '';
        if (nome) catIdToNome.set(cid, String(nome));
      } catch { /* ignora */ }
    }

    // (4c) Completa LMs que não vieram na busca principal
    const scLmIds = Array.from(new Set(
      scRes.response.results.map(sc => {
        const lmField =
          (sc as any)['LançamentoMesnal'] ??
          (sc as any)['LançamentoMensal'] ??
          (sc as any)['Lançamento Mensal'];
        return (typeof lmField === 'string') ? lmField : (lmField?._id || null);
      }).filter((id: any) => typeof id === 'string')
    )) as string[];

    const missingLmIds = scLmIds.filter(id => !lmIndex.has(id));
    for (const id of missingLmIds) {
      try {
        const single = await bubbleGet<any>(`/api/1.1/obj/${enc('LançamentoMensal')}/${enc(id)}`);
        const lm = single.response.results?.[0];
        if (!lm) continue;

        const ano = parseAno(lm.Ano) || parseAno(lm?.Data?.split?.('/')?.[1]);
        const mes = parseMes(lm.Mês) || Number(lm?.Data?.split?.('/')?.[0]);
        const agfId = typeof lm.AGF === 'string' ? lm.AGF : lm.AGF?._id;
        const agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfId || 'AGF');
        if (ano && mes) {
          lmIndex.set(id, { ano, mes, agfId, agfNome });
        }
      } catch { /* segue */ }
    }

    // 5) Balancete (objetos) – somente "Total"
    const balCons = constraints([
      { key: 'Lançamento Mensal', constraint_type: 'in', value: Array.from(lmIndex.keys()) },
      { key: 'Tipo de objeto',    constraint_type: 'equals', value: 'Total' },
    ]);
    const balRes = await bubbleGet<{
      _id: string;
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number | string;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`);

    // -------- AGREGAÇÃO --------
    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    const dados: Record<number, Record<number, Record<string, {
      receita: number;
      objetos: number;
      despesa_total: number;
      despesas: Record<string, number>;
      despesa_subcontas_total?: number;
    }>>> = {};

    const ensure = (ano: number, mes: number, agfNome: string) => {
      const key = normAgfName(agfNome); // --- NOVO: garante nome normalizado como chave ---
      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][key]) {
        dados[ano][mes][key] = {
          receita: 0,
          objetos: 0,
          despesa_total: 0,
          despesas: Object.fromEntries(categoriasDespesa.map(c => [c, 0]))
        };
      }
      return dados[ano][mes][key];
    };

    // 5.1) LM -> receita e despesa (oficiais)
    for (const lm of lmRes.response.results) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.receita       += Number((lm as any).total_receita || 0);
      entry.despesa_total += Number((lm as any).total_despesa || 0);
    }

    // 5.2) Objetos (Balancete – somente "Total")
    for (const b of balRes.response.results) {
      const lmField = (b as any)['Lançamento Mensal'];
      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (!meta) continue;
        ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
      } else if (typeof lmField === 'object' && lmField) {
        ano = parseAno((lmField as any).Ano);
        mes = parseMes((lmField as any).Mês);
        const aid = typeof (lmField as any).AGF === 'string' ? (lmField as any).AGF : (lmField as any).AGF?._id;
        agfNome = normAgfName(agfIdToNome.get(aid || '') || agfNome);
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.objetos += parseValorBR((b as any).Quantidade);
    }

    // 5.3) Despesas por categoria (SubContas)
    for (const sc of scRes.response.results) {
      const lmField =
        (sc as any)['LançamentoMesnal'] ??
        (sc as any)['LançamentoMensal'] ??
        (sc as any)['Lançamento Mensal'];

      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (meta) {
          ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
        } else {
          const parsed = parseMesAnoStr(lmField);
          if (parsed) { ano = parsed.ano; mes = parsed.mes; }
        }
      } else if (typeof lmField === 'object' && lmField) {
        ano = parseAno((lmField as any).Ano);
        mes = parseMes((lmField as any).Mês);
        const aid = typeof (lmField as any).AGF === 'string' ? (lmField as any).AGF : (lmField as any).AGF?._id;
        agfNome = normAgfName(agfIdToNome.get(aid || '') || agfNome);
      }

      // se vier AGF direto na SubConta, sobrescreve (normalizado)
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfNome);
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);

      // Categoria pode ser ID, texto ou objeto
      let nomeCategoria = '';
      const c = (sc as any).Categoria;
      if (c) {
        if (typeof c === 'string') nomeCategoria = catIdToNome.get(c) || '';
        else if (typeof c === 'object') {
          nomeCategoria = (c as any).Categoria || (c as any).Nome || (c as any).name || '';
        }
      }
      const descricao = (sc as any).Descrição ?? (sc as any).descricao ?? '';
      let categoria = normalizeCategoriaFromMeta(nomeCategoria, descricao, typeof c === 'string' ? c : undefined);

      // --- NOVO: garante que a chave exista entre as conhecidas ---
      if (!(['aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'] as const).includes(categoria as any)) {
        categoria = 'extras';
      }

      const valor = parseValorBR((sc as any).Valor);

      entry.despesas[categoria] = (entry.despesas[categoria] || 0) + valor;
      entry.despesa_subcontas_total = (entry.despesa_subcontas_total || 0) + valor;
    }

    // 5.4) Normalizações finais
    for (const anoStr of Object.keys(dados)) {
      const ano = Number(anoStr);
      for (const mesStr of Object.keys(dados[ano])) {
        const mes = Number(mesStr);
        for (const agfNome of Object.keys(dados[ano][mes])) {
          const d = dados[ano][mes][agfNome];
          d.receita = Number(d.receita || 0);
          d.objetos = Number(d.objetos || 0);
          d.despesa_total = Number(d.despesa_total || 0);
          for (const c of ['aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'])
            d.despesas[c] = Number(d.despesas[c] || 0);
          d.despesa_subcontas_total = Number(d.despesa_subcontas_total || 0);
        }
      }
    }

    return NextResponse.json({ agfs, categoriasDespesa, dados });
  } catch (e: any) {
    console.error('Erro na API:', e);
    return NextResponse.json({ error: e.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}

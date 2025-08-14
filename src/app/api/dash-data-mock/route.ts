import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'mocks', 'dash-mock.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(raw);
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro lendo mock' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function safe(value: string | undefined) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return value;
  }
}

export async function GET() {
  try {
    // 1) Modelli realmente presenti nel client Prisma a runtime
    const dmmf = (prisma as any)?._dmmf;
    const models = dmmf?.datamodel?.models?.map((m: any) => m.name) ?? [];
    const mappings = dmmf?.mappings?.modelOperations?.map((m: any) => m.model) ?? [];
    const hasEventItem = models.includes('EventItem') || mappings.includes('EventItem');

    // 2) Schema con cui è stato generato il client
    let clientSchemaPath = '';
    let clientSchema = '';
    try {
      clientSchemaPath = require.resolve('.prisma/client/schema.prisma', { paths: [process.cwd()] });
      clientSchema = fs.readFileSync(clientSchemaPath, 'utf8');
    } catch {
      try {
        clientSchemaPath = require.resolve('@prisma/client/schema.prisma', { paths: [process.cwd()] });
        clientSchema = fs.readFileSync(clientSchemaPath, 'utf8');
      } catch {}
    }

    // 3) Versione client
    const clientPkgPath = require.resolve('@prisma/client/package.json', { paths: [process.cwd()] });
    const clientVersion = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8')).version;

    // 4) DB in uso a runtime (offuscato)
    const dbUrl = safe(process.env.DATABASE_URL);

    return NextResponse.json({
      runtime: process.env.NODE_ENV,
      dbUrl,
      client: { version: clientVersion },
      clientSchemaPath,
      clientSchemaHasEventItem: /model\s+EventItem\b/.test(clientSchema),
      models,
      mappings,
      hasEventItem,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

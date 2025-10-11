import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function safe(value: string | undefined) {
  if (!value) return value;
  try {
    const url = new URL(value);
    // offusca credenziali
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return value;
  }
}

export async function GET() {
  try {
    // lista dei modelli presenti nel client a runtime
    const dmmf = (prisma as any)?._dmmf;
    const models = dmmf?.datamodel?.models?.map((m: any) => m.name) ?? [];
    const mappings = dmmf?.mappings?.modelOperations?.map((m: any) => m.model) ?? [];
    const hasEventItem = models.includes('EventItem') || mappings.includes('EventItem');

    // prova a leggere lo schema usato per generare il client
    let clientSchemaPath = '';
    let clientSchema = '';
    try {
      // percorso classico in Next/Node
      clientSchemaPath = require.resolve('.prisma/client/schema.prisma', { paths: [process.cwd()] });
      clientSchema = fs.readFileSync(clientSchemaPath, 'utf8');
    } catch {
      // fallback: prova il path nel pacchetto
      try {
        clientSchemaPath = require.resolve('@prisma/client/schema.prisma', { paths: [process.cwd()] });
        clientSchema = fs.readFileSync(clientSchemaPath, 'utf8');
      } catch {
        // ignore
      }
    }

    // quick info versione client/engine
    const clientPkgPath = require.resolve('@prisma/client/package.json', { paths: [process.cwd()] });
    const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
    const clientVersion = clientPkg.version;

    // datasource url a runtime
    const dbUrl = safe(process.env.DATABASE_URL);

    return NextResponse.json(
      {
        runtime: process.env.NODE_ENV,
        dbUrl,
        client: { version: clientVersion },
        clientSchemaPath,
        clientSchemaHasEventItem: /model\s+EventItem\b/.test(clientSchema),
        models,
        mappings,
        hasEventItem,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

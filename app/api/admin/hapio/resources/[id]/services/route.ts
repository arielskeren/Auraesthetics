import { NextRequest, NextResponse } from 'next/server';
import {
  listResourceAssociatedServices,
  associateResourceService,
  dissociateResourceService,
} from '@/lib/hapioClient';
import { listServices } from '@/lib/hapioClient';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const linkAll = searchParams.get('link_all') === 'true';

    // Optional admin shortcut: GET ?link_all=true will associate all Hapio services to this resource
    if (linkAll) {
      const resourceId = params.id;
      // Fetch all services (up to 100)
      const all = await listServices({ per_page: 100 });
      const targetServiceIds = (all.data || []).map((s: any) => s.id).filter(Boolean);

      const existing = await listResourceAssociatedServices(resourceId);
      const already = new Set(existing.map((e) => e.service_id));

      const associated: string[] = [];
      const alreadyLinked: string[] = [];
      const failed: Array<{ serviceId: string; error: string }> = [];

      for (const serviceId of targetServiceIds) {
        if (already.has(serviceId)) {
          alreadyLinked.push(serviceId);
          continue;
        }
        try {
          await associateResourceService(resourceId, serviceId);
          associated.push(serviceId);
        } catch (err: any) {
          failed.push({ serviceId, error: err?.message || 'associate failed' });
        }
      }

      return NextResponse.json({
        resourceId,
        associated,
        alreadyLinked,
        failed,
        totalTargeted: targetServiceIds.length,
        mode: 'link_all_via_get',
      });
    }

    // Default: list current associations
    const services = await listResourceAssociatedServices(params.id);
    return NextResponse.json({ services, mode: 'list' });
  } catch (error: any) {
    console.error('[Hapio] Failed to list resource services', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve resource services';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}

/**
 * POST /api/admin/hapio/resources/[id]/services
 * Body:
 *  - serviceIds?: string[]  -> explicitly associate these IDs
 *  - link_all?: boolean     -> when true, fetch all Hapio services and associate any missing
 *
 * Returns: { associated: string[], alreadyLinked: string[], failed: Array<{serviceId:string,error:string}> }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resourceId = params.id;
    const body = await request.json().catch(() => ({}));
    const linkAll: boolean = Boolean(body?.link_all);
    let targetServiceIds: string[] = Array.isArray(body?.serviceIds) ? body.serviceIds : [];

    if (linkAll) {
      // Fetch all services from Hapio (up to 100 for now)
      const all = await listServices({ per_page: 100 });
      targetServiceIds = (all.data || []).map((s: any) => s.id).filter(Boolean);
    }

    if (!targetServiceIds || targetServiceIds.length === 0) {
      return NextResponse.json(
        { error: 'No serviceIds provided and link_all is not set' },
        { status: 400 }
      );
    }

    // Get current associations to avoid duplicate POSTs
    const existing = await listResourceAssociatedServices(resourceId);
    const already = new Set(existing.map((e) => e.service_id));

    const associated: string[] = [];
    const alreadyLinked: string[] = [];
    const failed: Array<{ serviceId: string; error: string }> = [];

    for (const serviceId of targetServiceIds) {
      if (already.has(serviceId)) {
        alreadyLinked.push(serviceId);
        continue;
      }
      try {
        await associateResourceService(resourceId, serviceId);
        associated.push(serviceId);
      } catch (err: any) {
        failed.push({ serviceId, error: err?.message || 'associate failed' });
      }
    }

    return NextResponse.json({
      resourceId,
      associated,
      alreadyLinked,
      failed,
      totalTargeted: targetServiceIds.length,
    });
  } catch (error: any) {
    console.error('[Hapio] Failed to associate resource services', error);
    const message =
      typeof error?.message === 'string' ? error.message : 'Failed to associate resource services';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}


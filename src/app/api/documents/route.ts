import {NextRequest, NextResponse} from 'next/server';
import {createSupabaseServerClient, requireAuth} from '@/lib/supabase/server';
import crypto from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const {searchParams} = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('documents')
      .select('id, filename, status, category, report_date, created_at, mime_type, size_bytes, patient_name_mismatch, review_status', {count: 'exact'})
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('created_at', {ascending: false})
      .range(offset, offset + limit - 1);
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const {data: documents, count, error} = await query;
    
    if (error) {
      return NextResponse.json({error: 'Failed to fetch documents'}, {status: 500});
    }
    
    return NextResponse.json({
      documents: documents || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    return NextResponse.json({error: 'Failed to fetch documents'}, {status: 500});
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const idempotencyKey = formData.get('idempotency_key') as string;
    
    if (!file) {
      return NextResponse.json({error: 'File is required'}, {status: 400});
    }
    
    if (!idempotencyKey) {
      return NextResponse.json({error: 'idempotency_key is required'}, {status: 400});
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Only PDF, JPG, and PNG files are accepted.',
        code: 'wrong_type',
      }, {status: 400});
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'File is over 10 MB.',
        code: 'file_too_large',
      }, {status: 400});
    }
    
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    
    // Compute SHA-256 for deduplication
    const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    
    // Check for duplicate
    const {data: existingDoc} = await supabase
      .from('documents')
      .select('id, status')
      .eq('owner_id', user.id)
      .eq('sha256_hash', hash)
      .is('deleted_at', null)
      .single();
    
    if (existingDoc) {
      return NextResponse.json({
        error: 'You have already uploaded this document.',
        code: 'duplicate',
        existing_document_id: existingDoc.id,
      }, {status: 409});
    }
    
    // Generate storage path: {user_id}/{document_id}/{filename}
    const documentId = crypto.randomUUID();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${documentId}/${safeFilename}`;
    
    // Upload to Supabase Storage
    const {error: uploadError} = await supabase.storage
      .from('medical-records')
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        upsert: false,
      });
    
    if (uploadError) {
      return NextResponse.json({
        error: 'Upload failed. Please try again.',
        code: 'upload_failed',
      }, {status: 500});
    }
    
    // Create document record
    const {data: document, error: dbError} = await supabase
      .from('documents')
      .insert({
        id: documentId,
        owner_id: user.id,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        sha256_hash: hash,
        status: 'uploaded',
        category: 'unclassified',
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();
    
    if (dbError || !document) {
      // Clean up storage on db failure
      await supabase.storage.from('medical-records').remove([storagePath]);
      return NextResponse.json({error: 'Failed to save document record'}, {status: 500});
    }
    
    return NextResponse.json({
      document_id: document.id,
      status: 'uploaded',
      idempotency_key: idempotencyKey,
    }, {status: 201});
    
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    console.error('Upload error:', err.name);
    return NextResponse.json({error: 'Upload failed'}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();
    
    const {searchParams} = new URL(request.url);
    const documentId = searchParams.get('id');
    
    if (!documentId) {
      return NextResponse.json({error: 'Document ID is required'}, {status: 400});
    }
    
    // Verify ownership and get storage path
    const {data: document} = await supabase
      .from('documents')
      .select('id, storage_path, status')
      .eq('id', documentId)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .single();
    
    if (!document) {
      return NextResponse.json({error: 'Document not found'}, {status: 404});
    }
    
    // Mark as deleting first (prevents concurrent operations)
    await supabase
      .from('documents')
      .update({status: 'deleting'})
      .eq('id', documentId)
      .eq('owner_id', user.id);
    
    // Delete cascaded data (RLS ensures owner_id match)
    await Promise.all([
      supabase.from('document_pages').delete().eq('document_id', documentId).eq('owner_id', user.id),
      supabase.from('lab_results').delete().eq('document_id', documentId).eq('owner_id', user.id),
      supabase.from('prescriptions').delete().eq('document_id', documentId).eq('owner_id', user.id),
      supabase.from('explanations').delete().eq('document_id', documentId).eq('owner_id', user.id),
      supabase.from('processing_jobs').delete().eq('document_id', documentId).eq('owner_id', user.id),
    ]);
    
    // Delete from storage
    await supabase.storage.from('medical-records').remove([document.storage_path]);
    
    // Soft delete the document record
    await supabase
      .from('documents')
      .update({deleted_at: new Date().toISOString()})
      .eq('id', documentId)
      .eq('owner_id', user.id);
    
    return NextResponse.json({status: 'deleted'});
    
  } catch (error) {
    const err = error as Error;
    if (err.message === 'Not authenticated') {
      return NextResponse.json({error: 'Not authenticated'}, {status: 401});
    }
    return NextResponse.json({error: 'Delete failed'}, {status: 500});
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bountyPubkey,
      companyWallet,
      title,
      description,
      requirements,
      deliverables,
      skillsRequired,
      category,
      deadline,
      prizeAmount,
    } = body;

    // Validate required fields
    if (!bountyPubkey || !companyWallet || !title || !description || !prizeAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert bounty metadata
    const { data: bounty, error } = await supabase
      .from('bounties')
      .insert({
        bounty_pubkey: bountyPubkey,
        company_wallet: companyWallet,
        title,
        description,
        requirements,
        deliverables,
        skills_required: skillsRequired || [],
        category: category || 'other',
        deadline,
        prize_amount: prizeAmount,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bounty metadata:', error);
      return NextResponse.json(
        { error: 'Failed to create bounty metadata' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, bounty },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in bounty API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bountyPubkey = searchParams.get('bountyPubkey');
    const companyWallet = searchParams.get('companyWallet');

    if (bountyPubkey) {
      // Get single bounty
      const { data: bounty, error } = await supabase
        .from('bounties')
        .select('*')
        .eq('bounty_pubkey', bountyPubkey)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Bounty not found' },
          { status: 404 }
        );
      }

      // Get submission count
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('bounty_id', bounty.id);

      return NextResponse.json({
        bounty: {
          ...bounty,
          submission_count: count || 0,
        },
      });
    }

    // Get all bounties or filter by company
    let query = supabase
      .from('bounties')
      .select('*')
      .order('created_at', { ascending: false });

    if (companyWallet) {
      query = query.eq('company_wallet', companyWallet);
    }

    const { data: bounties, error } = await query;

    if (error) {
      console.error('Error fetching bounties:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bounties' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bounties });
  } catch (error) {
    console.error('Error in bounty API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bountyPubkey,
      title,
      description,
      requirements,
      deliverables,
      skillsRequired,
      category,
    } = body;

    // Validate required fields
    if (!bountyPubkey) {
      return NextResponse.json(
        { error: 'Missing bountyPubkey' },
        { status: 400 }
      );
    }

    // Update bounty metadata
    const { data: bounty, error } = await supabase
      .from('bounties')
      .update({
        title,
        description,
        requirements,
        deliverables,
        skills_required: skillsRequired,
        category,
        updated_at: new Date().toISOString(),
      })
      .eq('bounty_pubkey', bountyPubkey)
      .select()
      .single();

    if (error) {
      console.error('Error updating bounty:', error);
      return NextResponse.json(
        { error: 'Failed to update bounty: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, bounty },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in PATCH bounty API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
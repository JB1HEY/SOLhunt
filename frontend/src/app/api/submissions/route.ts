import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bountyId,
      bountyPubkey,
      hunterWallet,
      description,
      githubUrl,
      demoUrl,
      videoUrl,
      files,
    } = body;

    // Validate required fields
    if (!bountyId || !hunterWallet || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if submission already exists
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('bounty_id', bountyId)
      .eq('hunter_wallet', hunterWallet)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already submitted to this bounty' },
        { status: 400 }
      );
    }

    // Insert submission
    const { data: submission, error } = await supabase
      .from('submissions')
      .insert({
        bounty_id: bountyId,
        hunter_wallet: hunterWallet,
        description,
        github_url: githubUrl,
        demo_url: demoUrl,
        video_url: videoUrl,
        files: files || [],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating submission:', error);
      return NextResponse.json(
        { error: 'Failed to create submission: ' + error.message },
        { status: 500 }
      );
    }

    // Create notification for bounty owner (if notifications table exists)
    try {
      const { data: bounty } = await supabase
        .from('bounties')
        .select('company_wallet, title')
        .eq('id', bountyId)
        .maybeSingle();

      if (bounty) {
        await supabase.from('notifications').insert({
          user_wallet: bounty.company_wallet,
          type: 'new_submission',
          title: 'New Submission Received',
          message: `Someone submitted work for "${bounty.title}"`,
          link: `/bounty/${bountyPubkey}?tab=submissions`,
        });
      }
    } catch (notifError) {
      // Don't fail if notifications fail
      console.log('Could not create notification (table may not exist):', notifError);
    }

    return NextResponse.json(
      {
        success: true,
        submission
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in submission API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bountyId = searchParams.get('bountyId');
    const hunterWallet = searchParams.get('hunterWallet');

    // First, get submissions without the join
    let query = supabase
      .from('submissions')
      .select('*');

    if (bountyId) {
      query = query.eq('bounty_id', bountyId);
    }

    if (hunterWallet) {
      query = query.eq('hunter_wallet', hunterWallet);
    }

    query = query.order('submitted_at', { ascending: false });

    const { data: submissions, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch submissions: ' + error.message },
        { status: 500 }
      );
    }

    // Now fetch profile data for each submission separately
    if (submissions && submissions.length > 0) {
      const wallets = [...new Set(submissions.map(s => s.hunter_wallet))];

      // Try to fetch profiles, but don't fail if table doesn't exist
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('wallet_address, name, avatar_url, bio, skills')
          .in('wallet_address', wallets);

        // Create a map of profiles by wallet
        const profileMap = new Map();
        if (profiles) {
          profiles.forEach(p => {
            profileMap.set(p.wallet_address, p);
          });
        }

        // Add profile data to submissions
        const submissionsWithProfiles = submissions.map(submission => ({
          ...submission,
          profiles: profileMap.get(submission.hunter_wallet) || null,
        }));

        return NextResponse.json({ submissions: submissionsWithProfiles });
      } catch (profileError) {
        console.log('Could not fetch profiles (table may not exist):', profileError);
        // Return submissions without profile data
        return NextResponse.json({ submissions });
      }
    }

    return NextResponse.json({ submissions: submissions || [] });
  } catch (error: any) {
    console.error('Error in submission API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, status } = body;

    if (!submissionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: submissionId and status' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        status,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', submissionId);

    if (error) {
      console.error('Error updating submission:', error);
      return NextResponse.json(
        { error: 'Failed to update submission: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}